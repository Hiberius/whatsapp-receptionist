import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTenantTestDatabase,
  ids,
  tenantScopedTables,
  useRawAuthenticatedClaims,
  useServiceRole,
  useTenantClaims,
} from './pglite-test-database';

describe('tenant A/B database isolation', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTenantTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('uses the tenant role from app_metadata instead of the Supabase authenticated role', async () => {
    await useTenantClaims(db, { tenantId: ids.tenantA, tenantRole: 'owner' });

    const result = await db.query<{ role: string }>('select public.current_tenant_role() as role');

    expect(result.rows).toEqual([{ role: 'owner' }]);
  });

  it('allows an owner to update only their own tenant', async () => {
    await useTenantClaims(db, { tenantId: ids.tenantA, tenantRole: 'owner' });

    const ownUpdate = await db.query<{ id: string }>(
      "update public.tenants set name = 'Tenant A Updated' where id = $1 returning id",
      [ids.tenantA],
    );
    const otherUpdate = await db.query<{ id: string }>(
      "update public.tenants set name = 'Tenant B Compromised' where id = $1 returning id",
      [ids.tenantB],
    );

    expect(ownUpdate.rows).toEqual([{ id: ids.tenantA }]);
    expect(otherUpdate.rows).toEqual([]);
  });

  it('never exposes tenant B rows to tenant A across every tenant-scoped RLS table', async () => {
    await useTenantClaims(db, { tenantId: ids.tenantA, tenantRole: 'owner' });

    for (const table of tenantScopedTables) {
      const result = await db.query<{ tenant_id: string | null }>(
        table === 'tenants'
          ? 'select id as tenant_id from public.tenants'
          : `select tenant_id from public.${table}`,
      );
      const tenantIds = result.rows.map((row) => row.tenant_id);

      expect(tenantIds, table).not.toContain(ids.tenantB);
      if (table === 'ai_prompts') {
        expect(tenantIds, table).toContain(null);
      } else {
        expect(tenantIds, table).toContain(ids.tenantA);
      }
    }
  });

  it('never exposes tenant A rows to tenant B across every tenant-scoped RLS table', async () => {
    await useTenantClaims(db, { tenantId: ids.tenantB, tenantRole: 'owner' });

    for (const table of tenantScopedTables) {
      const result = await db.query<{ tenant_id: string | null }>(
        table === 'tenants'
          ? 'select id as tenant_id from public.tenants'
          : `select tenant_id from public.${table}`,
      );
      const tenantIds = result.rows.map((row) => row.tenant_id);

      expect(tenantIds, table).not.toContain(ids.tenantA);
      if (table === 'ai_prompts') {
        expect(tenantIds, table).toContain(null);
      } else {
        expect(tenantIds, table).toContain(ids.tenantB);
      }
    }
  });

  it('denies tenant A inserts that claim tenant B', async () => {
    await useTenantClaims(db, { tenantId: ids.tenantA, tenantRole: 'owner' });

    await expect(
      db.query(
        "insert into public.services (tenant_id, name) values ($1, 'Cross-tenant service')",
        [ids.tenantB],
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('leaves tenant B unchanged after tenant A update and delete attempts', async () => {
    await useTenantClaims(db, { tenantId: ids.tenantA, tenantRole: 'owner' });

    const updateResult = await db.query(
      "update public.services set name = 'Compromised' where id = $1 returning id",
      [ids.serviceB],
    );
    const deleteResult = await db.query('delete from public.services where id = $1 returning id', [
      ids.serviceB,
    ]);

    expect(updateResult.rows).toEqual([]);
    expect(deleteResult.rows).toEqual([]);

    await useServiceRole(db);
    const unchanged = await db.query<{ name: string }>(
      'select name from public.services where id = $1',
      [ids.serviceB],
    );
    expect(unchanged.rows).toEqual([{ name: 'Service B' }]);
  });

  it.each(['owner', 'admin', 'member'] as const)(
    'preserves the allow-listed %s tenant role',
    async (tenantRole) => {
      await useTenantClaims(db, { tenantId: ids.tenantA, tenantRole });

      const result = await db.query<{ role: string }>(
        'select public.current_tenant_role() as role',
      );

      expect(result.rows).toEqual([{ role: tenantRole }]);
    },
  );

  it('denies unknown roles and JWTs without a tenant claim', async () => {
    await useRawAuthenticatedClaims(db, {
      app_metadata: { tenant_id: ids.tenantA, role: 'superadmin' },
    });
    const unknownRole = await db.query<{ role: string }>(
      'select public.current_tenant_role() as role',
    );
    const adminRows = await db.query('select id from public.audit_log');

    expect(unknownRole.rows).toEqual([{ role: '' }]);
    expect(adminRows.rows).toEqual([]);

    await useRawAuthenticatedClaims(db, {});
    const tenantRows = await db.query('select id from public.services');
    expect(tenantRows.rows).toEqual([]);
  });

  it('denies authenticated access to non-tenant contact submissions', async () => {
    await useTenantClaims(db, { tenantId: ids.tenantA, tenantRole: 'owner' });

    const result = await db.query('select id from public.contact_submissions');

    expect(result.rows).toEqual([]);
  });

  it('rejects tenant A messages linked to a tenant B conversation', async () => {
    await useServiceRole(db);

    await expect(
      db.query(
        `insert into public.messages (
          tenant_id, conversation_id, direction, sender_type, content
        ) values ($1, $2, 'inbound', 'customer', 'Cross-tenant link')`,
        [ids.tenantA, ids.conversationB],
      ),
    ).rejects.toThrow(/foreign key|constraint/i);
  });

  it('rejects tenant A appointments linked to tenant B booking resources', async () => {
    await useServiceRole(db);

    await expect(
      db.query(
        `insert into public.appointments (
          tenant_id, conversation_id, service_id, customer_identifier,
          customer_name, scheduled_at
        ) values ($1, $2, $3, '+12025550999', 'Cross Tenant', '2030-02-01 15:00:00+00')`,
        [ids.tenantA, ids.conversationB, ids.serviceB],
      ),
    ).rejects.toThrow(/foreign key|constraint/i);
  });

  it('rejects tenant A outbox jobs linked to tenant B messages', async () => {
    await useServiceRole(db);

    await expect(
      db.query(
        `insert into public.whatsapp_outbox_jobs (
          tenant_id, message_id, recipient_identifier
        ) values ($1, $2, '+12025550999')`,
        [ids.tenantA, ids.messageB],
      ),
    ).rejects.toThrow(/foreign key|constraint/i);
  });

  it('keeps the corrected same-tenant appointment overlap constraint active', async () => {
    await useServiceRole(db);

    await expect(
      db.query(
        `insert into public.appointments (
          tenant_id, conversation_id, service_id, customer_identifier,
          customer_name, scheduled_at
        ) values ($1, $2, $3, '+12025550888', 'Overlap', '2030-01-01 15:15:00+00')`,
        [ids.tenantA, ids.conversationA, ids.serviceA],
      ),
    ).rejects.toThrow(/appointments_no_confirmed_overlap|exclusion constraint/i);
  });

  it('lets service_role see both tenants for server-side processing', async () => {
    await useServiceRole(db);

    const result = await db.query<{ id: string }>('select id from public.tenants order by id');

    expect(result.rows).toEqual([{ id: ids.tenantA }, { id: ids.tenantB }]);
  });
});
