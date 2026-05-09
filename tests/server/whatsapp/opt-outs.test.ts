import { describe, expect, it } from 'vitest';

import type { AuthSession } from '@/lib/auth/session';
import {
  WhatsAppOptOutService,
  type WhatsAppOptOutRecord,
  type WhatsAppOptOutRepository,
} from '@/server/whatsapp/opt-outs';

const now = new Date('2026-04-26T08:45:00.000Z');

describe('WhatsAppOptOutService', () => {
  it('returns tenant-scoped opt-out status for owner/admin sessions', async () => {
    const repository = new FakeWhatsAppOptOutRepository();
    repository.records.set(
      'tenant_1:393331112233',
      optOutRecord({
        tenantId: 'tenant_1',
        customerIdentifier: '393331112233',
      }),
    );
    repository.records.set(
      'tenant_2:393331112233',
      optOutRecord({
        tenantId: 'tenant_2',
        customerIdentifier: '393331112233',
        reason: 'other_tenant',
      }),
    );
    const service = new WhatsAppOptOutService(repository);

    await expect(
      service.getStatus({
        session: adminSession(),
        customerIdentifier: '+39 333 111 2233',
      }),
    ).resolves.toEqual({
      channel: 'whatsapp',
      customerIdentifier: '393331112233',
      optedOut: true,
      reason: 'keyword_stop',
      optedOutAt: '2026-04-26T08:00:00.000Z',
      createdAt: '2026-04-26T08:00:00.000Z',
    });
  });

  it('revokes opt-out idempotently for owner/admin sessions', async () => {
    const repository = new FakeWhatsAppOptOutRepository();
    repository.records.set(
      'tenant_1:393331112233',
      optOutRecord({
        tenantId: 'tenant_1',
        customerIdentifier: '393331112233',
      }),
    );
    const service = new WhatsAppOptOutService(repository);

    await expect(
      service.revoke({
        session: adminSession(),
        customerIdentifier: '393331112233',
        now,
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
      }),
    ).resolves.toMatchObject({
      customerIdentifier: '393331112233',
      optedOut: false,
      revoked: true,
    });
    await expect(
      service.revoke({
        session: adminSession(),
        customerIdentifier: '393331112233',
        now,
      }),
    ).resolves.toMatchObject({
      customerIdentifier: '393331112233',
      optedOut: false,
      revoked: false,
    });
    expect(repository.deletions[0]).toMatchObject({
      tenantId: 'tenant_1',
      customerIdentifier: '393331112233',
      revokedAt: now,
      revokedByUserId: 'user_1',
    });
    expect(repository.auditLogs).toEqual([
      {
        tenantId: 'tenant_1',
        userId: 'user_1',
        action: 'whatsapp.opt_out.revoked',
        resourceType: 'opt_out',
        resourceId: '00000000-0000-4000-8000-000000000001',
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
        metadata: {
          channel: 'whatsapp',
          customerIdentifier: '393331112233',
          revoked: true,
          revokedAt: '2026-04-26T08:45:00.000Z',
          previousReason: 'keyword_stop',
          previousOptedOutAt: '2026-04-26T08:00:00.000Z',
        },
      },
      {
        tenantId: 'tenant_1',
        userId: 'user_1',
        action: 'whatsapp.opt_out.revoked',
        resourceType: 'opt_out',
        resourceId: null,
        ipAddress: null,
        userAgent: null,
        metadata: {
          channel: 'whatsapp',
          customerIdentifier: '393331112233',
          revoked: false,
          revokedAt: '2026-04-26T08:45:00.000Z',
          previousReason: null,
          previousOptedOutAt: null,
        },
      },
    ]);
  });

  it('requires owner or admin role', async () => {
    const service = new WhatsAppOptOutService(new FakeWhatsAppOptOutRepository());

    await expect(
      service.getStatus({
        session: {
          ...adminSession(),
          role: 'member',
        },
        customerIdentifier: '393331112233',
      }),
    ).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});

class FakeWhatsAppOptOutRepository implements WhatsAppOptOutRepository {
  readonly records = new Map<string, WhatsAppOptOutRecord>();
  readonly deletions: Array<{
    tenantId: string;
    customerIdentifier: string;
    revokedAt: Date;
    revokedByUserId: string;
  }> = [];
  readonly auditLogs: Array<{
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Record<string, unknown>;
  }> = [];

  async getWhatsAppOptOut(input: {
    tenantId: string;
    customerIdentifier: string;
  }): Promise<WhatsAppOptOutRecord | null> {
    return this.records.get(keyFor(input)) ?? null;
  }

  async deleteWhatsAppOptOut(input: {
    tenantId: string;
    customerIdentifier: string;
    revokedAt: Date;
    revokedByUserId: string;
  }): Promise<boolean> {
    this.deletions.push(input);
    const key = keyFor(input);
    const existed = this.records.has(key);
    this.records.delete(key);

    return existed;
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
    this.auditLogs.push(input);
  }
}

function adminSession(): AuthSession {
  return {
    userId: 'user_1',
    tenantId: 'tenant_1',
    role: 'admin',
  };
}

function optOutRecord(overrides: Partial<WhatsAppOptOutRecord> = {}): WhatsAppOptOutRecord {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    tenantId: 'tenant_1',
    customerIdentifier: '393331112233',
    reason: 'keyword_stop',
    optedOutAt: '2026-04-26T08:00:00.000Z',
    createdAt: '2026-04-26T08:00:00.000Z',
    ...overrides,
  };
}

function keyFor(input: { tenantId: string; customerIdentifier: string }): string {
  return `${input.tenantId}:${input.customerIdentifier}`;
}
