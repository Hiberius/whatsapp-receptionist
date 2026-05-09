/* eslint-disable no-restricted-syntax -- Test fixtures: payload SDI/Acube
costruiti come literal JSON e castati a `Response`/tipi SDK per simulare il
provider HTTP esterno. */

import { describe, expect, it, vi } from 'vitest';

import { createSdiInvoicingService, type SdiInvoiceRequest } from '@/server/billing/sdi-invoicing';

const baseRequest: SdiInvoiceRequest = {
  tenantId: 'a1b2c3d4-e5f6-4789-a123-456789abcdef',
  customer: {
    name: 'Studio Demo Srl',
    vatNumber: '12345678901',
    sdiCode: '0000000',
    address: {
      street: 'Via Roma 1',
      city: 'Roma',
      postalCode: '00100',
      province: 'RM',
      country: 'IT',
    },
  },
  lines: [
    {
      description: 'Piano Professional - Maggio 2026',
      quantity: 1,
      unitPrice: 297,
      vatRate: 22,
    },
  ],
  paymentMethod: 'card',
};

describe('SdiInvoicingService', () => {
  it('crea una fattura elettronica e ritorna external id', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: 12345,
            number: 'FE/2026/00012',
            url: 'https://fic.example/pdf/12345.pdf',
            ei_xml_url: 'https://fic.example/xml/12345.xml',
            ei_transmitted_at: '2026-05-08T10:30:00Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const service = createSdiInvoicingService({
      apiToken: 'test-token',
      companyId: 'test-company',
      baseUrl: 'https://test.fattureincloud.test',
      fetchFn,
    });

    const result = await service.createElectronicInvoice(baseRequest);

    expect(result.externalId).toBe('12345');
    expect(result.invoiceNumber).toBe('FE/2026/00012');
    expect(result.totalAmount).toBeCloseTo(297 * 1.22, 2);
    expect(result.totalVat).toBeCloseTo(297 * 0.22, 2);
    expect(result.sdiTransmittedAt).toBeInstanceOf(Date);
  });

  it('lancia upstream_error se la API risponde con errore', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('Bad request', { status: 400 })) as unknown as typeof fetch;

    const service = createSdiInvoicingService({
      apiToken: 'test-token',
      companyId: 'test-company',
      baseUrl: 'https://test.fattureincloud.test',
      fetchFn,
    });

    await expect(service.createElectronicInvoice(baseRequest)).rejects.toMatchObject({
      code: 'upstream_error',
      status: 502,
    });
  });

  it('valida P.IVA italiana (11 cifre)', async () => {
    const service = createSdiInvoicingService({
      apiToken: 'test-token',
      companyId: 'test-company',
      baseUrl: 'https://test.fattureincloud.test',
      fetchFn: vi.fn() as unknown as typeof fetch,
    });

    await expect(
      service.createElectronicInvoice({
        ...baseRequest,
        customer: {
          ...baseRequest.customer,
          vatNumber: '123', // troppo corta
        },
      }),
    ).rejects.toThrow();
  });

  it('mappa paymentMethod ai codici SDI corretti', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { id: 1, number: 'FE/1', url: '', ei_xml_url: '' },
        }),
        { status: 200 },
      ),
    );

    const service = createSdiInvoicingService({
      apiToken: 'test-token',
      companyId: 'test-company',
      baseUrl: 'https://test.fattureincloud.test',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    await service.createElectronicInvoice({
      ...baseRequest,
      paymentMethod: 'sepa_direct_debit',
    });

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const init = firstCall![1] as RequestInit;
    const callBody = JSON.parse(init.body as string) as {
      data: { ei_data: { payment_method: string } };
    };
    expect(callBody.data.ei_data.payment_method).toBe('MP19');
  });

  it('lancia internal se token o company id mancano', () => {
    expect(() =>
      createSdiInvoicingService({
        apiToken: '',
        companyId: '',
        baseUrl: 'https://test.fattureincloud.test',
      }),
    ).toThrow();
  });
});
