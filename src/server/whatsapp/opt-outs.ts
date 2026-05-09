import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AuthSession } from '@/lib/auth/session';

export type WhatsAppOptOutRecord = {
  id: string;
  tenantId: string;
  customerIdentifier: string;
  reason: string | null;
  optedOutAt: string;
  createdAt: string;
};

export type WhatsAppOptOutStatus = {
  channel: 'whatsapp';
  customerIdentifier: string;
  optedOut: boolean;
  reason: string | null;
  optedOutAt: string | null;
  createdAt: string | null;
};

export type WhatsAppOptOutRepository = {
  getWhatsAppOptOut(input: {
    tenantId: string;
    customerIdentifier: string;
  }): Promise<WhatsAppOptOutRecord | null>;
  deleteWhatsAppOptOut(input: {
    tenantId: string;
    customerIdentifier: string;
    revokedAt: Date;
    revokedByUserId: string;
  }): Promise<boolean>;
  recordAuditLog(input: {
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Record<string, unknown>;
  }): Promise<void>;
};

export class WhatsAppOptOutService {
  constructor(private readonly repository: WhatsAppOptOutRepository) {}

  async getStatus(input: {
    session: AuthSession;
    customerIdentifier: string;
  }): Promise<WhatsAppOptOutStatus> {
    assertConsentAdmin(input.session);
    const customerIdentifier = normalizeCustomerIdentifier(input.customerIdentifier);
    const record = await this.repository.getWhatsAppOptOut({
      tenantId: input.session.tenantId,
      customerIdentifier,
    });

    return record
      ? {
          channel: 'whatsapp',
          customerIdentifier,
          optedOut: true,
          reason: record.reason,
          optedOutAt: record.optedOutAt,
          createdAt: record.createdAt,
        }
      : {
          channel: 'whatsapp',
          customerIdentifier,
          optedOut: false,
          reason: null,
          optedOutAt: null,
          createdAt: null,
        };
  }

  async revoke(input: {
    session: AuthSession;
    customerIdentifier: string;
    now?: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<WhatsAppOptOutStatus & { revoked: boolean }> {
    assertConsentAdmin(input.session);
    const customerIdentifier = normalizeCustomerIdentifier(input.customerIdentifier);
    const existing = await this.repository.getWhatsAppOptOut({
      tenantId: input.session.tenantId,
      customerIdentifier,
    });
    const revokedAt = input.now ?? new Date();
    const revoked = await this.repository.deleteWhatsAppOptOut({
      tenantId: input.session.tenantId,
      customerIdentifier,
      revokedAt,
      revokedByUserId: input.session.userId,
    });
    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'whatsapp.opt_out.revoked',
      resourceType: 'opt_out',
      resourceId: existing?.id ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        channel: 'whatsapp',
        customerIdentifier,
        revoked,
        revokedAt: revokedAt.toISOString(),
        previousReason: existing?.reason ?? null,
        previousOptedOutAt: existing?.optedOutAt ?? null,
      },
    });

    return {
      channel: 'whatsapp',
      customerIdentifier,
      optedOut: false,
      reason: null,
      optedOutAt: null,
      createdAt: null,
      revoked,
    };
  }
}

export class SupabaseWhatsAppOptOutRepository implements WhatsAppOptOutRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getWhatsAppOptOut(input: {
    tenantId: string;
    customerIdentifier: string;
  }): Promise<WhatsAppOptOutRecord | null> {
    const { data, error } = await this.supabase
      .from('opt_outs')
      .select('id, tenant_id, customer_identifier, reason, opted_out_at, created_at')
      .eq('tenant_id', input.tenantId)
      .eq('channel', 'whatsapp')
      .eq('customer_identifier', input.customerIdentifier)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read WhatsApp opt-out', error);
    }

    return data ? optOutRecordFromRow(data as OptOutRow) : null;
  }

  async deleteWhatsAppOptOut(input: {
    tenantId: string;
    customerIdentifier: string;
  }): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('opt_outs')
      .delete()
      .eq('tenant_id', input.tenantId)
      .eq('channel', 'whatsapp')
      .eq('customer_identifier', input.customerIdentifier)
      .select('id');

    if (error) {
      throw toRepositoryError('Failed to revoke WhatsApp opt-out', error);
    }

    return (data ?? []).length > 0;
  }

  async recordAuditLog(input: {
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Record<string, unknown>;
  }): Promise<void> {
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
      throw toRepositoryError('Failed to write WhatsApp opt-out audit log', error);
    }
  }
}

export function createWhatsAppOptOutService(): WhatsAppOptOutService {
  return new WhatsAppOptOutService(new SupabaseWhatsAppOptOutRepository());
}

type OptOutRow = {
  id: string;
  tenant_id: string;
  customer_identifier: string;
  reason: string | null;
  opted_out_at: string;
  created_at: string;
};

function normalizeCustomerIdentifier(value: string): string {
  const normalized = value.replace(/\D/g, '');

  if (normalized.length < 5 || normalized.length > 32) {
    throw new AppError('bad_request', 'Invalid WhatsApp customer identifier');
  }

  return normalized;
}

function assertConsentAdmin(
  session: AuthSession,
): asserts session is AuthSession & { role: 'owner' | 'admin' } {
  if (session.role !== 'owner' && session.role !== 'admin') {
    throw new AppError('forbidden', 'Admin role required');
  }
}

function optOutRecordFromRow(row: OptOutRow): WhatsAppOptOutRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerIdentifier: row.customer_identifier,
    reason: row.reason,
    optedOutAt: row.opted_out_at,
    createdAt: row.created_at,
  };
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
