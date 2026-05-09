// Fatto da Claude Code l'8 maggio 2026.
//
// GDPR Art. 17 — Diritto alla cancellazione (right to be forgotten).
//
// Due livelli:
//   1. Tenant-level: l'azienda chiude l'account. Soft-delete con grace
//      period 30gg, hard-delete eseguito da job cron giornaliero.
//   2. Customer-level: cancellazione immediata dei dati di un cliente
//      finale (no grace period — il customer non ha login, e' un GDPR
//      request che il tenant onora subito).
//
// Pattern allineato a data-export.ts e conversations/inbox.ts.

import type { AuthSession } from '@/lib/auth/session';
import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  type AuditLogInput,
  type GdprActor,
  normalizeCustomerPhone,
} from '@/server/gdpr/data-export';

export const TENANT_DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export type TenantDeletionRequest = {
  tenantId: string;
  requestedAt: string;
  scheduledHardDeleteAt: string;
  status: 'scheduled' | 'cancelled' | 'executed';
};

export type CustomerDeletionResult = {
  tenantId: string;
  customerPhone: string;
  deleted: number;
  breakdown: {
    conversations: number;
    messages: number;
    appointments: number;
    optOuts: number;
  };
};

export type ScheduledTenantDeletion = {
  tenantId: string;
  scheduledHardDeleteAt: string;
};

export interface GdprDeleteRepository {
  getTenantDeletionStatus(tenantId: string): Promise<{
    deletedAt: string | null;
    exists: boolean;
  }>;
  scheduleTenantSoftDelete(input: { tenantId: string; deletedAt: Date }): Promise<void>;
  clearTenantSoftDelete(tenantId: string): Promise<boolean>;
  listTenantsDueForHardDelete(now: Date): Promise<ScheduledTenantDeletion[]>;
  hardDeleteTenant(tenantId: string): Promise<void>;
  countCustomerRows(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<CustomerDeletionResult['breakdown']>;
  deleteCustomerRows(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<CustomerDeletionResult['breakdown']>;
  recordAuditLog(input: AuditLogInput): Promise<void>;
}

export class GdprDeleteService {
  constructor(private readonly repository: GdprDeleteRepository) {}

  async requestTenantDeletion(input: {
    session: AuthSession;
    actor?: Pick<GdprActor, 'ipAddress' | 'userAgent'>;
    now?: Date;
  }): Promise<TenantDeletionRequest> {
    assertOwner(input.session);
    const status = await this.repository.getTenantDeletionStatus(input.session.tenantId);

    if (!status.exists) {
      throw new AppError('not_found', 'Tenant not found');
    }

    if (status.deletedAt) {
      throw new AppError('conflict', 'Tenant deletion is already scheduled');
    }

    const requestedAtDate = input.now ?? new Date();
    const scheduledHardDeleteAt = new Date(
      requestedAtDate.getTime() + TENANT_DELETION_GRACE_PERIOD_MS,
    );

    await this.repository.scheduleTenantSoftDelete({
      tenantId: input.session.tenantId,
      deletedAt: scheduledHardDeleteAt,
    });

    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'gdpr.tenant.deletion.requested',
      resourceType: 'tenant',
      resourceId: input.session.tenantId,
      ipAddress: input.actor?.ipAddress ?? null,
      userAgent: input.actor?.userAgent ?? null,
      metadata: {
        requestedAt: requestedAtDate.toISOString(),
        scheduledHardDeleteAt: scheduledHardDeleteAt.toISOString(),
        graceDays: 30,
      },
    });

    return {
      tenantId: input.session.tenantId,
      requestedAt: requestedAtDate.toISOString(),
      scheduledHardDeleteAt: scheduledHardDeleteAt.toISOString(),
      status: 'scheduled',
    };
  }

  async cancelTenantDeletion(input: {
    session: AuthSession;
    actor?: Pick<GdprActor, 'ipAddress' | 'userAgent'>;
    now?: Date;
  }): Promise<void> {
    assertOwner(input.session);
    const status = await this.repository.getTenantDeletionStatus(input.session.tenantId);

    if (!status.exists) {
      throw new AppError('not_found', 'Tenant not found');
    }

    if (!status.deletedAt) {
      throw new AppError('conflict', 'No deletion request to cancel');
    }

    const cleared = await this.repository.clearTenantSoftDelete(input.session.tenantId);

    if (!cleared) {
      throw new AppError('not_found', 'Tenant deletion request not found');
    }

    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'gdpr.tenant.deletion.cancelled',
      resourceType: 'tenant',
      resourceId: input.session.tenantId,
      ipAddress: input.actor?.ipAddress ?? null,
      userAgent: input.actor?.userAgent ?? null,
      metadata: {
        cancelledAt: (input.now ?? new Date()).toISOString(),
        previousScheduledHardDeleteAt: status.deletedAt,
      },
    });
  }

  async executeTenantHardDelete(input: { tenantId: string; now?: Date }): Promise<void> {
    const status = await this.repository.getTenantDeletionStatus(input.tenantId);

    if (!status.exists) {
      throw new AppError('not_found', 'Tenant not found');
    }

    if (!status.deletedAt) {
      throw new AppError('conflict', 'Tenant has no scheduled deletion');
    }

    const scheduledAt = new Date(status.deletedAt);
    const now = input.now ?? new Date();

    if (scheduledAt.getTime() > now.getTime()) {
      throw new AppError('conflict', 'Grace period has not elapsed yet');
    }

    await this.repository.hardDeleteTenant(input.tenantId);

    // Audit_log row con tenant_id ora nullo (FK on delete set null in
    // 202605080001_audit_log_gdpr_actions.sql). Ne scriviamo una nuova
    // con tenantId=null per registrare l'esecuzione.
    await this.repository.recordAuditLog({
      tenantId: null,
      userId: null,
      action: 'gdpr.tenant.hard_delete.executed',
      resourceType: 'tenant',
      resourceId: input.tenantId,
      ipAddress: null,
      userAgent: null,
      metadata: {
        executedAt: now.toISOString(),
        originallyScheduledAt: status.deletedAt,
        formerTenantId: input.tenantId,
      },
    });
  }

  async listScheduledHardDeletes(now: Date): Promise<ScheduledTenantDeletion[]> {
    return this.repository.listTenantsDueForHardDelete(now);
  }

  async deleteCustomerData(input: {
    session: AuthSession;
    customerPhone: string;
    actor?: Pick<GdprActor, 'ipAddress' | 'userAgent'>;
    now?: Date;
  }): Promise<CustomerDeletionResult> {
    assertGdprAdmin(input.session);
    const customerPhone = normalizeCustomerPhone(input.customerPhone);
    const before = await this.repository.countCustomerRows({
      tenantId: input.session.tenantId,
      customerPhone,
    });
    const totalBefore =
      before.conversations + before.messages + before.appointments + before.optOuts;

    if (totalBefore === 0) {
      // GDPR no-leak: rispondiamo 404 invece di rivelare assenza dati.
      throw new AppError('not_found', 'No data found for the given customer');
    }

    const breakdown = await this.repository.deleteCustomerRows({
      tenantId: input.session.tenantId,
      customerPhone,
    });
    const deleted =
      breakdown.conversations + breakdown.messages + breakdown.appointments + breakdown.optOuts;

    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'gdpr.customer.deletion.executed',
      resourceType: 'customer',
      resourceId: null,
      ipAddress: input.actor?.ipAddress ?? null,
      userAgent: input.actor?.userAgent ?? null,
      metadata: {
        customerPhone,
        deleted,
        breakdown,
        executedAt: (input.now ?? new Date()).toISOString(),
      },
    });

    return {
      tenantId: input.session.tenantId,
      customerPhone,
      deleted,
      breakdown,
    };
  }
}

export class SupabaseGdprDeleteRepository implements GdprDeleteRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getTenantDeletionStatus(
    tenantId: string,
  ): Promise<{ deletedAt: string | null; exists: boolean }> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('deleted_at')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read tenant deletion status', error);
    }

    if (!data) {
      return { deletedAt: null, exists: false };
    }

    const row = data as { deleted_at: string | null };

    return { deletedAt: row.deleted_at, exists: true };
  }

  async scheduleTenantSoftDelete(input: { tenantId: string; deletedAt: Date }): Promise<void> {
    const { error } = await this.supabase
      .from('tenants')
      .update({
        deleted_at: input.deletedAt.toISOString(),
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.tenantId);

    if (error) {
      throw toRepositoryError('Failed to schedule tenant soft delete', error);
    }
  }

  async clearTenantSoftDelete(tenantId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('tenants')
      .update({
        deleted_at: null,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select('id');

    if (error) {
      throw toRepositoryError('Failed to clear tenant soft delete', error);
    }

    return (data ?? []).length > 0;
  }

  async listTenantsDueForHardDelete(now: Date): Promise<ScheduledTenantDeletion[]> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('id, deleted_at')
      .not('deleted_at', 'is', null)
      .lte('deleted_at', now.toISOString());

    if (error) {
      throw toRepositoryError('Failed to list tenants due for hard delete', error);
    }

    return ((data ?? []) as Array<{ id: string; deleted_at: string }>).map((row) => ({
      tenantId: row.id,
      scheduledHardDeleteAt: row.deleted_at,
    }));
  }

  async hardDeleteTenant(tenantId: string): Promise<void> {
    // Cascade FKs cancellano gia' tutte le tabelle child. audit_log ha
    // ON DELETE SET NULL (vedi 202605080001) quindi sopravvive con
    // tenant_id=null come compliance log.
    const { error } = await this.supabase.from('tenants').delete().eq('id', tenantId);

    if (error) {
      throw toRepositoryError('Failed to hard delete tenant', error);
    }
  }

  async countCustomerRows(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<CustomerDeletionResult['breakdown']> {
    const [conversationsResult, appointmentsResult, optOutsResult] = await Promise.all([
      this.supabase
        .from('conversations')
        .select('id', { count: 'exact' })
        .eq('tenant_id', input.tenantId)
        .eq('customer_identifier', input.customerPhone),
      this.supabase
        .from('appointments')
        .select('id', { count: 'exact' })
        .eq('tenant_id', input.tenantId)
        .or(
          `customer_identifier.eq.${input.customerPhone},customer_phone.eq.${input.customerPhone}`,
        ),
      this.supabase
        .from('opt_outs')
        .select('id', { count: 'exact' })
        .eq('tenant_id', input.tenantId)
        .eq('customer_identifier', input.customerPhone),
    ]);

    if (conversationsResult.error) {
      throw toRepositoryError('Failed to count customer conversations', conversationsResult.error);
    }
    if (appointmentsResult.error) {
      throw toRepositoryError('Failed to count customer appointments', appointmentsResult.error);
    }
    if (optOutsResult.error) {
      throw toRepositoryError('Failed to count customer opt-outs', optOutsResult.error);
    }

    const conversationIds = ((conversationsResult.data ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    );

    let messagesCount = 0;
    if (conversationIds.length > 0) {
      const messagesResult = await this.supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', input.tenantId)
        .in('conversation_id', conversationIds);

      if (messagesResult.error) {
        throw toRepositoryError('Failed to count customer messages', messagesResult.error);
      }

      messagesCount = messagesResult.count ?? 0;
    }

    return {
      conversations: conversationsResult.count ?? conversationIds.length,
      messages: messagesCount,
      appointments: appointmentsResult.count ?? 0,
      optOuts: optOutsResult.count ?? 0,
    };
  }

  async deleteCustomerRows(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<CustomerDeletionResult['breakdown']> {
    // Tipicamente messages e' on delete cascade dalla conversation, quindi
    // cancelliamo le conversations e poi appointments + opt_outs.
    const breakdown: CustomerDeletionResult['breakdown'] = {
      conversations: 0,
      messages: 0,
      appointments: 0,
      optOuts: 0,
    };

    const conversations = await this.supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('customer_identifier', input.customerPhone);

    if (conversations.error) {
      throw toRepositoryError('Failed to read conversations for delete', conversations.error);
    }

    const conversationIds = ((conversations.data ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    );

    if (conversationIds.length > 0) {
      const messagesDelete = await this.supabase
        .from('messages')
        .delete({ count: 'exact' })
        .eq('tenant_id', input.tenantId)
        .in('conversation_id', conversationIds);

      if (messagesDelete.error) {
        throw toRepositoryError('Failed to delete customer messages', messagesDelete.error);
      }

      breakdown.messages = messagesDelete.count ?? 0;

      const conversationsDelete = await this.supabase
        .from('conversations')
        .delete({ count: 'exact' })
        .eq('tenant_id', input.tenantId)
        .in('id', conversationIds);

      if (conversationsDelete.error) {
        throw toRepositoryError(
          'Failed to delete customer conversations',
          conversationsDelete.error,
        );
      }

      breakdown.conversations = conversationsDelete.count ?? conversationIds.length;
    }

    const appointmentsDelete = await this.supabase
      .from('appointments')
      .delete({ count: 'exact' })
      .eq('tenant_id', input.tenantId)
      .or(`customer_identifier.eq.${input.customerPhone},customer_phone.eq.${input.customerPhone}`);

    if (appointmentsDelete.error) {
      throw toRepositoryError('Failed to delete customer appointments', appointmentsDelete.error);
    }

    breakdown.appointments = appointmentsDelete.count ?? 0;

    const optOutsDelete = await this.supabase
      .from('opt_outs')
      .delete({ count: 'exact' })
      .eq('tenant_id', input.tenantId)
      .eq('customer_identifier', input.customerPhone);

    if (optOutsDelete.error) {
      throw toRepositoryError('Failed to delete customer opt-outs', optOutsDelete.error);
    }

    breakdown.optOuts = optOutsDelete.count ?? 0;

    return breakdown;
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
      throw toRepositoryError('Failed to write GDPR delete audit log', error);
    }
  }
}

export function createGdprDeleteService(): GdprDeleteService {
  return new GdprDeleteService(new SupabaseGdprDeleteRepository());
}

function assertOwner(session: AuthSession): asserts session is AuthSession & { role: 'owner' } {
  if (session.role !== 'owner') {
    throw new AppError('forbidden', 'Owner role required');
  }
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
