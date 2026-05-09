import { describe, expect, it } from 'vitest';

import type { AuthSession } from '@/lib/auth/session';
import {
  type AuditLogInput,
  GdprExportService,
  type GdprExportRepository,
  TENANT_SCOPED_TABLES,
} from '@/server/gdpr/data-export';

describe('GdprExportService — exportTenantData', () => {
  it('returns rows for every tenant-scoped table and writes audit log', async () => {
    const repository = new FakeGdprExportRepository();
    repository.tenantTables.set('tenants', [{ id: 'tenant_1', name: 'Studio Rossi' }]);
    repository.tenantTables.set('users', [{ id: 'user_1', tenant_id: 'tenant_1' }]);
    repository.tenantTables.set('conversations', [
      { id: 'conv_1', tenant_id: 'tenant_1', customer_identifier: '393331112233' },
    ]);

    const service = new GdprExportService(repository);
    const payload = await service.exportTenantData({
      session: ownerSession(),
      now: new Date('2026-05-08T08:00:00.000Z'),
      actor: { ipAddress: '203.0.113.1', userAgent: 'Vitest' },
    });

    expect(payload.schemaVersion).toBe(1);
    expect(payload.tenantId).toBe('tenant_1');
    expect(payload.generatedAt).toBe('2026-05-08T08:00:00.000Z');
    expect(payload.tables).toHaveLength(TENANT_SCOPED_TABLES.length);
    expect(payload.totalRows).toBe(3);

    const tablesByName = new Map(payload.tables.map((entry) => [entry.table, entry]));
    expect(tablesByName.get('tenants')?.rowCount).toBe(1);
    expect(tablesByName.get('users')?.rowCount).toBe(1);
    expect(tablesByName.get('conversations')?.rowCount).toBe(1);
    expect(tablesByName.get('messages')?.rowCount).toBe(0);

    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'gdpr.tenant.export.requested',
        resourceType: 'tenant',
        resourceId: 'tenant_1',
        ipAddress: '203.0.113.1',
        userAgent: 'Vitest',
        metadata: expect.objectContaining({
          totalRows: 3,
          tableCount: TENANT_SCOPED_TABLES.length,
        }),
      }),
    ]);
  });

  it('blocks members from exporting tenant data', async () => {
    const service = new GdprExportService(new FakeGdprExportRepository());

    await expect(
      service.exportTenantData({
        session: { ...ownerSession(), role: 'member' },
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('GdprExportService — exportCustomerData', () => {
  it('exports conversations, messages, appointments and opt-outs for a customer', async () => {
    const repository = new FakeGdprExportRepository();
    const conversationId = '00000000-0000-4000-8000-000000000101';
    repository.customerConversations.set('tenant_1:393331112233', [
      { id: conversationId, tenant_id: 'tenant_1', customer_identifier: '393331112233' },
    ]);
    repository.customerMessages.set(`tenant_1:${conversationId}`, [
      { id: 'msg_1', conversation_id: conversationId, content: 'Ciao' },
    ]);
    repository.customerAppointments.set('tenant_1:393331112233', [
      { id: 'appt_1', tenant_id: 'tenant_1', customer_identifier: '393331112233' },
    ]);
    repository.customerOptOuts.set('tenant_1:393331112233', [
      { id: 'opt_1', tenant_id: 'tenant_1', customer_identifier: '393331112233' },
    ]);

    const service = new GdprExportService(repository);
    const payload = await service.exportCustomerData({
      session: adminSession(),
      customerPhone: '+39 333 111 2233',
      now: new Date('2026-05-08T08:00:00.000Z'),
      actor: { ipAddress: '203.0.113.2', userAgent: 'Vitest' },
    });

    expect(payload.customerPhone).toBe('393331112233');
    expect(payload.conversations).toHaveLength(1);
    expect(payload.messages).toHaveLength(1);
    expect(payload.appointments).toHaveLength(1);
    expect(payload.optOuts).toHaveLength(1);
    expect(payload.totalRows).toBe(4);

    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'gdpr.customer.export.requested',
        resourceType: 'customer',
        metadata: expect.objectContaining({
          customerPhone: '393331112233',
          totalRows: 4,
        }),
      }),
    ]);
  });

  it('responds 404 (not_found) when there is no data for the customer (anti-leak)', async () => {
    const service = new GdprExportService(new FakeGdprExportRepository());

    await expect(
      service.exportCustomerData({
        session: adminSession(),
        customerPhone: '393331112233',
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejects malformed phone numbers', async () => {
    const service = new GdprExportService(new FakeGdprExportRepository());

    await expect(
      service.exportCustomerData({
        session: adminSession(),
        customerPhone: '12',
      }),
    ).rejects.toMatchObject({ code: 'bad_request' });
  });
});

class FakeGdprExportRepository implements GdprExportRepository {
  readonly tenantTables = new Map<string, Array<Record<string, unknown>>>();
  readonly customerConversations = new Map<string, Array<Record<string, unknown>>>();
  readonly customerMessages = new Map<string, Array<Record<string, unknown>>>();
  readonly customerAppointments = new Map<string, Array<Record<string, unknown>>>();
  readonly customerOptOuts = new Map<string, Array<Record<string, unknown>>>();
  readonly auditLogs: AuditLogInput[] = [];

  async fetchTenantTable(input: {
    tenantId: string;
    table: string;
  }): Promise<Array<Record<string, unknown>>> {
    return this.tenantTables.get(input.table) ?? [];
  }

  async fetchCustomerConversations(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<Array<Record<string, unknown>>> {
    return this.customerConversations.get(`${input.tenantId}:${input.customerPhone}`) ?? [];
  }

  async fetchCustomerMessages(input: {
    tenantId: string;
    conversationIds: string[];
  }): Promise<Array<Record<string, unknown>>> {
    const collected: Array<Record<string, unknown>> = [];

    for (const conversationId of input.conversationIds) {
      const rows = this.customerMessages.get(`${input.tenantId}:${conversationId}`) ?? [];
      collected.push(...rows);
    }

    return collected;
  }

  async fetchCustomerAppointments(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<Array<Record<string, unknown>>> {
    return this.customerAppointments.get(`${input.tenantId}:${input.customerPhone}`) ?? [];
  }

  async fetchCustomerOptOuts(input: {
    tenantId: string;
    customerPhone: string;
  }): Promise<Array<Record<string, unknown>>> {
    return this.customerOptOuts.get(`${input.tenantId}:${input.customerPhone}`) ?? [];
  }

  async recordAuditLog(input: AuditLogInput): Promise<void> {
    this.auditLogs.push(input);
  }
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
