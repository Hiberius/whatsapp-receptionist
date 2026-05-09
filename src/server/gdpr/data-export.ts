// Fatto da Claude Code l'8 maggio 2026.
//
// GDPR Art. 15 — Diritto di accesso ai dati.
//
// Due livelli:
//   1. Tenant-level: l'azienda esporta TUTTI i propri dati (21 tabelle).
//   2. Customer-level: l'azienda esporta i dati di uno specifico cliente
//      finale identificato dal numero E.164.
//
// Pattern allineato a conversations/inbox.ts:
//   - service iniettato con repository;
//   - repository wrappa Supabase service-role;
//   - factory `createGdprService()` istanzia la repository reale.

import type { AuthSession } from '@/lib/auth/session';
import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type GdprActor = {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuditLogInput = {
  tenantId: string | null;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
};

export type TenantTableExport = {
  table: string;
  rowCount: number;
  rows: Array<Record<string, unknown>>;
};

export type TenantExportPayload = {
  schemaVersion: 1;
  generatedAt: string;
  tenantId: string;
  tables: TenantTableExport[];
  totalRows: number;
};

export type CustomerExportPayload = {
  schemaVersion: 1;
  generatedAt: string;
  tenantId: string;
  customerPhone: string;
  conversations: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  appointments: Array<Record<string, unknown>>;
  optOuts: Array<Record<string, unknown>>;
  totalRows: number;
};

/**
 * Tabelle scoped per tenant_id che vanno incluse nell'export Art. 15.
 * Ordine fisso per output deterministico.
 */
export const TENANT_SCOPED_TABLES: readonly string[] = [
  'tenants',
  'users',
  'tenant_config',
  'services',
  'business_hours',
  'conversations',
  'messages',
  'opt_outs',
  'voice_events',
  'appointments',
  'webhook_events',
  'billing_events',
  'invoices',
  'usage_metrics',
  'whatsapp_message_templates',
  'whatsapp_outbox_jobs',
  'whatsapp_voice_jobs',
  'ai_prompts',
  'knowledge_base',
  'integrations',
  'audit_log',
];

export interface GdprExportRepository {
  fetchTenantTable(input: {
    tenantId: string;
    table: string;
  }): Promise<Array<Record<string, unknown>>>;
  fetchCustomerConversations(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<Array<Record<string, unknown>>>;
  fetchCustomerMessages(input: {
    tenantId: string;
    conversationIds: string[];
  }): Promise<Array<Record<string, unknown>>>;
  fetchCustomerAppointments(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<Array<Record<string, unknown>>>;
  fetchCustomerOptOuts(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<Array<Record<string, unknown>>>;
  recordAuditLog(input: AuditLogInput): Promise<void>;
}

export class GdprExportService {
  constructor(private readonly repository: GdprExportRepository) {}

  async exportTenantData(input: {
    session: AuthSession;
    actor?: Pick<GdprActor, 'ipAddress' | 'userAgent'>;
    now?: Date;
  }): Promise<TenantExportPayload> {
    assertGdprAdmin(input.session);
    const generatedAt = (input.now ?? new Date()).toISOString();
    const tableResults = await Promise.all(
      TENANT_SCOPED_TABLES.map(async (table) => {
        const rows = await this.repository.fetchTenantTable({
          tenantId: input.session.tenantId,
          table,
        });

        return {
          table,
          rowCount: rows.length,
          rows,
        } satisfies TenantTableExport;
      }),
    );
    const totalRows = tableResults.reduce((sum, entry) => sum + entry.rowCount, 0);
    const payload: TenantExportPayload = {
      schemaVersion: 1,
      generatedAt,
      tenantId: input.session.tenantId,
      tables: tableResults,
      totalRows,
    };

    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'gdpr.tenant.export.requested',
      resourceType: 'tenant',
      resourceId: input.session.tenantId,
      ipAddress: input.actor?.ipAddress ?? null,
      userAgent: input.actor?.userAgent ?? null,
      metadata: {
        totalRows,
        tableCount: tableResults.length,
        generatedAt,
      },
    });

    return payload;
  }

  async exportCustomerData(input: {
    session: AuthSession;
    customerPhone: string;
    actor?: Pick<GdprActor, 'ipAddress' | 'userAgent'>;
    now?: Date;
  }): Promise<CustomerExportPayload> {
    assertGdprAdmin(input.session);
    const customerPhone = normalizeCustomerPhone(input.customerPhone);
    const generatedAt = (input.now ?? new Date()).toISOString();

    const [conversations, appointments, optOuts] = await Promise.all([
      this.repository.fetchCustomerConversations({
        tenantId: input.session.tenantId,
        customerPhone,
      }),
      this.repository.fetchCustomerAppointments({
        tenantId: input.session.tenantId,
        customerPhone,
      }),
      this.repository.fetchCustomerOptOuts({
        tenantId: input.session.tenantId,
        customerPhone,
      }),
    ]);

    const conversationIds = conversations
      .map((conversation) => conversation['id'])
      .filter((value): value is string => typeof value === 'string');
    const messages = conversationIds.length
      ? await this.repository.fetchCustomerMessages({
          tenantId: input.session.tenantId,
          conversationIds,
        })
      : [];
    const totalRows = conversations.length + messages.length + appointments.length + optOuts.length;

    if (totalRows === 0) {
      // GDPR no-leak: rispondiamo 404, non 403 ne stringa generica.
      throw new AppError('not_found', 'No data found for the given customer');
    }

    const payload: CustomerExportPayload = {
      schemaVersion: 1,
      generatedAt,
      tenantId: input.session.tenantId,
      customerPhone,
      conversations,
      messages,
      appointments,
      optOuts,
      totalRows,
    };

    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'gdpr.customer.export.requested',
      resourceType: 'customer',
      resourceId: null,
      ipAddress: input.actor?.ipAddress ?? null,
      userAgent: input.actor?.userAgent ?? null,
      metadata: {
        customerPhone,
        totalRows,
        conversations: conversations.length,
        messages: messages.length,
        appointments: appointments.length,
        optOuts: optOuts.length,
        generatedAt,
      },
    });

    return payload;
  }
}

export class SupabaseGdprExportRepository implements GdprExportRepository {
  private readonly supabase = createSupabaseAdminClient();

  async fetchTenantTable(input: {
    tenantId: string;
    table: string;
  }): Promise<Array<Record<string, unknown>>> {
    const filterColumn = input.table === 'tenants' ? 'id' : 'tenant_id';
    const { data, error } = await this.supabase
      .from(input.table)
      .select('*')
      .eq(filterColumn, input.tenantId);

    if (error) {
      throw toRepositoryError(`Failed to read ${input.table} for export`, error);
    }

    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async fetchCustomerConversations(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('customer_identifier', input.customerPhone);

    if (error) {
      throw toRepositoryError('Failed to read conversations for customer export', error);
    }

    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async fetchCustomerMessages(input: {
    tenantId: string;
    conversationIds: string[];
  }): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .in('conversation_id', input.conversationIds);

    if (error) {
      throw toRepositoryError('Failed to read messages for customer export', error);
    }

    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async fetchCustomerAppointments(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .or(`customer_identifier.eq.${input.customerPhone},customer_phone.eq.${input.customerPhone}`);

    if (error) {
      throw toRepositoryError('Failed to read appointments for customer export', error);
    }

    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async fetchCustomerOptOuts(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.supabase
      .from('opt_outs')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('customer_identifier', input.customerPhone);

    if (error) {
      throw toRepositoryError('Failed to read opt-outs for customer export', error);
    }

    return (data ?? []) as Array<Record<string, unknown>>;
  }

  async recordAuditLog(input: AuditLogInput): Promise<void> {
    const { error } = await this.supabase.from('audit_log').insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      metadata: input.metadata,
    });

    if (error) {
      throw toRepositoryError('Failed to write GDPR audit log', error);
    }
  }
}

export function createGdprExportService(): GdprExportService {
  return new GdprExportService(new SupabaseGdprExportRepository());
}

/**
 * Normalizza un numero E.164. Accetta input con prefisso `+`, spazi o
 * separatori; torna la versione cifre-only attesa dal DB.
 */
export function normalizeCustomerPhone(value: string): string {
  const normalized = value.replace(/\D/g, '');

  if (normalized.length < 8 || normalized.length > 32) {
    throw new AppError('bad_request', 'Invalid customer phone number');
  }

  return normalized;
}

function assertGdprAdmin(
  session: AuthSession,
): asserts session is AuthSession & { role: 'owner' | 'admin' } {
  if (session.role !== 'owner' && session.role !== 'admin') {
    throw new AppError('forbidden', 'Admin role required');
  }
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
