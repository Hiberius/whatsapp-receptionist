/**
 * Fatturazione elettronica SDI tramite Fatture in Cloud API.
 *
 * Required env:
 * - FATTURE_IN_CLOUD_API_TOKEN
 * - FATTURE_IN_CLOUD_COMPANY_ID
 * - FATTURE_IN_CLOUD_BASE_URL (default: https://api-v2.fattureincloud.it)
 *
 * Riferimento API: https://developers.fattureincloud.it/api-reference
 *
 * Pattern factory consistente con il resto del codebase.
 */

import { z } from 'zod';

import { AppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';

// ---------- Schemas ----------

export const SdiCustomerSchema = z
  .object({
    name: z.string().min(1).max(200),
    vatNumber: z.string().regex(/^[0-9]{11}$/, 'P.IVA italiana = 11 cifre'),
    fiscalCode: z.string().optional(),
    sdiCode: z.string().optional(),
    pec: z.string().email().optional(),
    address: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      postalCode: z.string().min(1),
      province: z.string().length(2),
      country: z.string().length(2).default('IT'),
    }),
  })
  .strict();

export const SdiInvoiceLineSchema = z
  .object({
    description: z.string().min(1).max(500),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    vatRate: z.number().min(0).max(30),
    vatNature: z.string().optional(),
  })
  .strict();

export const SdiInvoiceRequestSchema = z
  .object({
    tenantId: z.string().uuid(),
    customer: SdiCustomerSchema,
    lines: z.array(SdiInvoiceLineSchema).min(1).max(100),
    paymentMethod: z.enum(['card', 'sepa_direct_debit', 'wire_transfer']),
    paidAt: z.string().datetime().optional(),
    notes: z.string().max(2000).optional(),
    stripePaymentIntentId: z.string().optional(),
  })
  .strict();

export type SdiInvoiceRequest = z.infer<typeof SdiInvoiceRequestSchema>;
export type SdiCustomer = z.infer<typeof SdiCustomerSchema>;

export interface SdiInvoiceCreated {
  externalId: string;
  invoiceNumber: string;
  pdfUrl: string;
  xmlUrl: string;
  sdiTransmittedAt?: Date;
  totalAmount: number;
  totalVat: number;
}

// ---------- Service ----------

export interface SdiInvoicingService {
  createElectronicInvoice(request: SdiInvoiceRequest): Promise<SdiInvoiceCreated>;
  getInvoicePdfUrl(externalId: string): Promise<string>;
  cancelInvoice(externalId: string, reason: string): Promise<void>;
}

interface SdiServiceConfig {
  apiToken: string;
  companyId: string;
  baseUrl: string;
  fetchFn?: typeof fetch;
}

class FattureInCloudService implements SdiInvoicingService {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: SdiServiceConfig) {
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async createElectronicInvoice(request: SdiInvoiceRequest): Promise<SdiInvoiceCreated> {
    const validated = SdiInvoiceRequestSchema.parse(request);

    const totalNet = validated.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const totalVat = validated.lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice * (line.vatRate / 100),
      0,
    );
    const totalAmount = totalNet + totalVat;

    const payload = {
      data: {
        type: 'invoice',
        e_invoice: true,
        ei_data: {
          payment_method: this.mapPaymentMethod(validated.paymentMethod),
        },
        entity: {
          name: validated.customer.name,
          vat_number: validated.customer.vatNumber,
          ...(validated.customer.fiscalCode !== undefined
            ? { tax_code: validated.customer.fiscalCode }
            : {}),
          ...(validated.customer.sdiCode !== undefined
            ? { ei_code: validated.customer.sdiCode }
            : {}),
          ...(validated.customer.pec !== undefined
            ? { certified_email: validated.customer.pec }
            : {}),
          address_street: validated.customer.address.street,
          address_city: validated.customer.address.city,
          address_postal_code: validated.customer.address.postalCode,
          address_province: validated.customer.address.province,
          country_iso: validated.customer.address.country,
        },
        items_list: validated.lines.map((line) => ({
          name: line.description,
          qty: line.quantity,
          net_price: line.unitPrice,
          vat: { value: line.vatRate },
        })),
        ...(validated.paidAt !== undefined ? { ei_status: 'paid' } : {}),
        ...(validated.notes !== undefined ? { notes: validated.notes } : {}),
      },
    };

    const response = await this.fetchFn(
      `${this.config.baseUrl}/c/${this.config.companyId}/issued_documents`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          status: response.status,
          tenantId: validated.tenantId,
        },
        'SDI invoice creation failed',
      );
      throw new AppError(
        'upstream_error',
        `Fatture in Cloud API error: ${response.status} ${errorText}`,
        { expose: false },
      );
    }

    const result = (await response.json()) as {
      data: {
        id: number;
        number: string;
        url: string;
        ei_xml_url?: string;
        ei_transmitted_at?: string;
      };
    };

    return {
      externalId: String(result.data.id),
      invoiceNumber: result.data.number,
      pdfUrl: result.data.url,
      xmlUrl: result.data.ei_xml_url ?? '',
      ...(result.data.ei_transmitted_at !== undefined
        ? { sdiTransmittedAt: new Date(result.data.ei_transmitted_at) }
        : {}),
      totalAmount,
      totalVat,
    };
  }

  async getInvoicePdfUrl(externalId: string): Promise<string> {
    const response = await this.fetchFn(
      `${this.config.baseUrl}/c/${this.config.companyId}/issued_documents/${externalId}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new AppError('not_found', 'Invoice not found', { expose: false });
    }

    const result = (await response.json()) as { data: { url: string } };
    return result.data.url;
  }

  async cancelInvoice(externalId: string, reason: string): Promise<void> {
    const response = await this.fetchFn(
      `${this.config.baseUrl}/c/${this.config.companyId}/issued_documents/${externalId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
        },
      },
    );

    if (!response.ok) {
      logger.error(
        {
          externalId,
          status: response.status,
        },
        'SDI invoice cancellation failed',
      );
      throw new AppError('upstream_error', `Failed to cancel invoice: ${reason}`, {
        expose: false,
      });
    }
  }

  private mapPaymentMethod(method: SdiInvoiceRequest['paymentMethod']): string {
    switch (method) {
      case 'card':
        return 'MP08'; // Carta di credito
      case 'sepa_direct_debit':
        return 'MP19'; // SEPA direct debit
      case 'wire_transfer':
        return 'MP05'; // Bonifico
    }
  }
}

// ---------- Factory ----------

export function createSdiInvoicingService(
  overrides?: Partial<SdiServiceConfig>,
): SdiInvoicingService {
  const apiToken = overrides?.apiToken ?? process.env.FATTURE_IN_CLOUD_API_TOKEN;
  const companyId = overrides?.companyId ?? process.env.FATTURE_IN_CLOUD_COMPANY_ID;
  const baseUrl =
    overrides?.baseUrl ??
    process.env.FATTURE_IN_CLOUD_BASE_URL ??
    'https://api-v2.fattureincloud.it';

  if (!apiToken || !companyId) {
    throw new AppError('internal', 'FATTURE_IN_CLOUD_API_TOKEN or COMPANY_ID not configured', {
      expose: false,
    });
  }

  return new FattureInCloudService({
    apiToken,
    companyId,
    baseUrl,
    ...(overrides?.fetchFn !== undefined ? { fetchFn: overrides.fetchFn } : {}),
  });
}
