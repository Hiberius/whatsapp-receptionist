import { describe, expect, it } from 'vitest';

import type { AuthSession } from '@/lib/auth/session';
import {
  type GdprDeleteRepository,
  type ScheduledTenantDeletion,
  GdprDeleteService,
  TENANT_DELETION_GRACE_PERIOD_MS,
} from '@/server/gdpr/data-delete';
import { type AuditLogInput } from '@/server/gdpr/data-export';

const NOW = new Date('2026-05-08T08:00:00.000Z');

describe('GdprDeleteService — tenant deletion lifecycle', () => {
  it('schedules a tenant soft delete with 30 days grace period', async () => {
    const repository = new FakeGdprDeleteRepository();
    repository.tenants.set('tenant_1', { exists: true, deletedAt: null });

    const service = new GdprDeleteService(repository);
    const result = await service.requestTenantDeletion({
      session: ownerSession(),
      now: NOW,
      actor: { ipAddress: '203.0.113.5', userAgent: 'Vitest' },
    });

    expect(result.tenantId).toBe('tenant_1');
    expect(result.requestedAt).toBe(NOW.toISOString());

    const expectedHardDeleteAt = new Date(NOW.getTime() + TENANT_DELETION_GRACE_PERIOD_MS);
    expect(result.scheduledHardDeleteAt).toBe(expectedHardDeleteAt.toISOString());
    expect(repository.scheduled).toEqual([
      { tenantId: 'tenant_1', deletedAt: expectedHardDeleteAt },
    ]);
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'gdpr.tenant.deletion.requested',
        resourceType: 'tenant',
        resourceId: 'tenant_1',
        metadata: expect.objectContaining({
          graceDays: 30,
          scheduledHardDeleteAt: expectedHardDeleteAt.toISOString(),
        }),
      }),
    ]);
  });

  it('blocks admin role from requesting tenant deletion (only owner)', async () => {
    const repository = new FakeGdprDeleteRepository();
    repository.tenants.set('tenant_1', { exists: true, deletedAt: null });
    const service = new GdprDeleteService(repository);

    await expect(
      service.requestTenantDeletion({
        session: { ...ownerSession(), role: 'admin' },
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('rejects double scheduling with conflict', async () => {
    const repository = new FakeGdprDeleteRepository();
    repository.tenants.set('tenant_1', {
      exists: true,
      deletedAt: '2026-06-08T08:00:00.000Z',
    });
    const service = new GdprDeleteService(repository);

    await expect(
      service.requestTenantDeletion({ session: ownerSession(), now: NOW }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('cancels a scheduled deletion within the grace period', async () => {
    const repository = new FakeGdprDeleteRepository();
    repository.tenants.set('tenant_1', {
      exists: true,
      deletedAt: '2026-06-08T08:00:00.000Z',
    });
    const service = new GdprDeleteService(repository);

    await service.cancelTenantDeletion({ session: ownerSession(), now: NOW });

    expect(repository.cleared).toEqual(['tenant_1']);
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'gdpr.tenant.deletion.cancelled',
      }),
    ]);
  });

  it('refuses hard delete before grace period elapses', async () => {
    const repository = new FakeGdprDeleteRepository();
    repository.tenants.set('tenant_1', {
      exists: true,
      deletedAt: '2026-06-08T08:00:00.000Z',
    });
    const service = new GdprDeleteService(repository);

    await expect(
      service.executeTenantHardDelete({ tenantId: 'tenant_1', now: NOW }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('hard deletes tenant once grace period has elapsed and audit-logs with null tenant_id', async () => {
    const repository = new FakeGdprDeleteRepository();
    const past = '2026-05-01T08:00:00.000Z';
    repository.tenants.set('tenant_1', { exists: true, deletedAt: past });
    const service = new GdprDeleteService(repository);

    await service.executeTenantHardDelete({ tenantId: 'tenant_1', now: NOW });

    expect(repository.hardDeleted).toEqual(['tenant_1']);
    const log = repository.auditLogs.find(
      (entry) => entry.action === 'gdpr.tenant.hard_delete.executed',
    );
    expect(log).toBeDefined();
    expect(log?.tenantId).toBeNull();
    expect(log?.userId).toBeNull();
    expect(log?.resourceId).toBe('tenant_1');
  });

  it('lists tenants whose deletion is due', async () => {
    const repository = new FakeGdprDeleteRepository();
    repository.scheduledList = [
      { tenantId: 'tenant_1', scheduledHardDeleteAt: '2026-05-01T08:00:00.000Z' },
      { tenantId: 'tenant_2', scheduledHardDeleteAt: '2026-05-08T07:00:00.000Z' },
    ];
    const service = new GdprDeleteService(repository);

    await expect(service.listScheduledHardDeletes(NOW)).resolves.toEqual(repository.scheduledList);
  });
});

describe('GdprDeleteService — customer-level deletion', () => {
  it('deletes a customer immediately and writes an audit log', async () => {
    const repository = new FakeGdprDeleteRepository();
    repository.customerCounts.set('tenant_1:393331112233', {
      conversations: 1,
      messages: 4,
      appointments: 1,
      optOuts: 1,
    });
    const service = new GdprDeleteService(repository);

    const result = await service.deleteCustomerData({
      session: adminSession(),
      customerPhone: '+39 333 111 2233',
      now: NOW,
      actor: { ipAddress: '203.0.113.6', userAgent: 'Vitest' },
    });

    expect(result.deleted).toBe(7);
    expect(result.customerPhone).toBe('393331112233');
    expect(repository.deletions).toEqual([{ tenantId: 'tenant_1', customerPhone: '393331112233' }]);
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'gdpr.customer.deletion.executed',
        metadata: expect.objectContaining({
          customerPhone: '393331112233',
          deleted: 7,
        }),
      }),
    ]);
  });

  it('responds 404 when no customer data exists (anti-leak)', async () => {
    const service = new GdprDeleteService(new FakeGdprDeleteRepository());

    await expect(
      service.deleteCustomerData({
        session: adminSession(),
        customerPhone: '393331112233',
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

class FakeGdprDeleteRepository implements GdprDeleteRepository {
  readonly tenants = new Map<string, { exists: boolean; deletedAt: string | null }>();
  readonly scheduled: Array<{ tenantId: string; deletedAt: Date }> = [];
  readonly cleared: string[] = [];
  readonly hardDeleted: string[] = [];
  readonly auditLogs: AuditLogInput[] = [];
  readonly customerCounts = new Map<string, ReturnType<typeof zeroBreakdown>>();
  readonly deletions: Array<{ tenantId: string; customerPhone: string }> = [];

  scheduledList: ScheduledTenantDeletion[] = [];

  async getTenantDeletionStatus(
    tenantId: string,
  ): Promise<{ deletedAt: string | null; exists: boolean }> {
    return this.tenants.get(tenantId) ?? { exists: false, deletedAt: null };
  }

  async scheduleTenantSoftDelete(input: { tenantId: string; deletedAt: Date }): Promise<void> {
    this.scheduled.push(input);
    const current = this.tenants.get(input.tenantId);

    if (current) {
      this.tenants.set(input.tenantId, {
        ...current,
        deletedAt: input.deletedAt.toISOString(),
      });
    }
  }

  async clearTenantSoftDelete(tenantId: string): Promise<boolean> {
    this.cleared.push(tenantId);
    const current = this.tenants.get(tenantId);

    if (!current) {
      return false;
    }

    this.tenants.set(tenantId, { ...current, deletedAt: null });
    return true;
  }

  async listTenantsDueForHardDelete(_now: Date): Promise<ScheduledTenantDeletion[]> {
    return this.scheduledList;
  }

  async hardDeleteTenant(tenantId: string): Promise<void> {
    this.hardDeleted.push(tenantId);
    this.tenants.delete(tenantId);
  }

  async countCustomerRows(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<ReturnType<typeof zeroBreakdown>> {
    return this.customerCounts.get(`${input.tenantId}:${input.customerPhone}`) ?? zeroBreakdown();
  }

  async deleteCustomerRows(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<ReturnType<typeof zeroBreakdown>> {
    this.deletions.push(input);
    return this.customerCounts.get(`${input.tenantId}:${input.customerPhone}`) ?? zeroBreakdown();
  }

  async recordAuditLog(input: AuditLogInput): Promise<void> {
    this.auditLogs.push(input);
  }
}

function zeroBreakdown(): {
  conversations: number;
  messages: number;
  appointments: number;
  optOuts: number;
} {
  return { conversations: 0, messages: 0, appointments: 0, optOuts: 0 };
}

function ownerSession(): AuthSession {
  return {
    userId: 'user_1',
    tenantId: 'tenant_1',
    role: 'owner',
  };
}

function adminSession(): AuthSession {
  return { ...ownerSession(), role: 'admin' };
}
