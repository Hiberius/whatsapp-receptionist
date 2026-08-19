import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { vector } from '@electric-sql/pglite-pgvector';

export const ids = {
  tenantA: '10000000-0000-4000-8000-000000000001',
  tenantB: '10000000-0000-4000-8000-000000000002',
  userA: '20000000-0000-4000-8000-000000000001',
  userB: '20000000-0000-4000-8000-000000000002',
  serviceA: '30000000-0000-4000-8000-000000000001',
  serviceB: '30000000-0000-4000-8000-000000000002',
  conversationA: '40000000-0000-4000-8000-000000000001',
  conversationB: '40000000-0000-4000-8000-000000000002',
  messageA: '50000000-0000-4000-8000-000000000001',
  messageB: '50000000-0000-4000-8000-000000000002',
  appointmentA: '60000000-0000-4000-8000-000000000001',
  appointmentB: '60000000-0000-4000-8000-000000000002',
} as const;

export const tenantScopedTables = [
  'tenants',
  'users',
  'tenant_config',
  'services',
  'business_hours',
  'conversations',
  'messages',
  'appointments',
  'knowledge_base',
  'integrations',
  'opt_outs',
  'usage_metrics',
  'invoices',
  'ai_prompts',
  'voice_events',
  'webhook_events',
  'whatsapp_outbox_jobs',
  'whatsapp_message_templates',
  'whatsapp_voice_jobs',
  'audit_log',
  'billing_events',
] as const;

const postgresPrelude = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key);

  create or replace function auth.jwt()
  returns jsonb
  language sql
  stable
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::jsonb;
  $$;

  create or replace function auth.role()
  returns text
  language sql
  stable
  as $$
    select coalesce(auth.jwt() ->> 'role', '');
  $$;
`;

const fixtures = `
  insert into auth.users (id) values
    ('${ids.userA}'),
    ('${ids.userB}');

  insert into public.tenants (id, name, slug, billing_email, country, timezone) values
    ('${ids.tenantA}', 'Tenant A', 'tenant-a', 'a@example.com', 'US', 'America/New_York'),
    ('${ids.tenantB}', 'Tenant B', 'tenant-b', 'b@example.com', 'US', 'America/Chicago');

  insert into public.users (id, tenant_id, role, full_name) values
    ('${ids.userA}', '${ids.tenantA}', 'owner', 'Owner A'),
    ('${ids.userB}', '${ids.tenantB}', 'owner', 'Owner B');

  insert into public.tenant_config (tenant_id, studio_name, default_locale) values
    ('${ids.tenantA}', 'Business A', 'en-US'),
    ('${ids.tenantB}', 'Business B', 'en-US');

  insert into public.services (id, tenant_id, name) values
    ('${ids.serviceA}', '${ids.tenantA}', 'Service A'),
    ('${ids.serviceB}', '${ids.tenantB}', 'Service B');

  insert into public.business_hours (tenant_id, weekday, opens_at, closes_at) values
    ('${ids.tenantA}', 1, '09:00', '17:00'),
    ('${ids.tenantB}', 1, '09:00', '17:00');

  insert into public.conversations (id, tenant_id, channel, customer_identifier) values
    ('${ids.conversationA}', '${ids.tenantA}', 'whatsapp', '+12025550101'),
    ('${ids.conversationB}', '${ids.tenantB}', 'whatsapp', '+12025550102');

  insert into public.messages (
    id, tenant_id, conversation_id, direction, sender_type, content
  ) values
    ('${ids.messageA}', '${ids.tenantA}', '${ids.conversationA}', 'inbound', 'customer', 'Hello A'),
    ('${ids.messageB}', '${ids.tenantB}', '${ids.conversationB}', 'inbound', 'customer', 'Hello B');

  insert into public.appointments (
    id, tenant_id, conversation_id, service_id, customer_identifier,
    customer_name, scheduled_at
  ) values
    ('${ids.appointmentA}', '${ids.tenantA}', '${ids.conversationA}', '${ids.serviceA}', '+12025550101', 'Customer A', '2030-01-01 15:00:00+00'),
    ('${ids.appointmentB}', '${ids.tenantB}', '${ids.conversationB}', '${ids.serviceB}', '+12025550102', 'Customer B', '2030-01-01 15:00:00+00');

  insert into public.knowledge_base (tenant_id, title, content) values
    ('${ids.tenantA}', 'FAQ A', 'Answer A'),
    ('${ids.tenantB}', 'FAQ B', 'Answer B');

  insert into public.integrations (tenant_id, provider, config) values
    ('${ids.tenantA}', 'google_calendar', '{"calendar_id":"a"}'),
    ('${ids.tenantB}', 'google_calendar', '{"calendar_id":"b"}');

  insert into public.opt_outs (tenant_id, channel, customer_identifier) values
    ('${ids.tenantA}', 'whatsapp', '+12025550111'),
    ('${ids.tenantB}', 'whatsapp', '+12025550112');

  insert into public.usage_metrics (tenant_id, metric_month) values
    ('${ids.tenantA}', '2030-01-01'),
    ('${ids.tenantB}', '2030-01-01');

  insert into public.invoices (tenant_id, stripe_invoice_id, amount_cents) values
    ('${ids.tenantA}', 'invoice-a', 1000),
    ('${ids.tenantB}', 'invoice-b', 1000);

  insert into public.ai_prompts (tenant_id, prompt_key, version, model, prompt_text) values
    (null, 'global', 1, 'test', 'Global prompt'),
    ('${ids.tenantA}', 'tenant-a', 1, 'test', 'Prompt A'),
    ('${ids.tenantB}', 'tenant-b', 1, 'test', 'Prompt B');

  insert into public.voice_events (tenant_id, message_id, direction, model) values
    ('${ids.tenantA}', '${ids.messageA}', 'stt', 'test'),
    ('${ids.tenantB}', '${ids.messageB}', 'stt', 'test');

  insert into public.webhook_events (
    tenant_id, provider, event_type, external_id, idempotency_key
  ) values
    ('${ids.tenantA}', 'whatsapp_360dialog', 'message', 'event-a', 'key-a'),
    ('${ids.tenantB}', 'whatsapp_360dialog', 'message', 'event-b', 'key-b');

  insert into public.whatsapp_outbox_jobs (
    tenant_id, message_id, recipient_identifier
  ) values
    ('${ids.tenantA}', '${ids.messageA}', '+12025550101'),
    ('${ids.tenantB}', '${ids.messageB}', '+12025550102');

  insert into public.whatsapp_message_templates (
    tenant_id, name, language_code, category
  ) values
    ('${ids.tenantA}', 'confirmation-a', 'en_US', 'utility'),
    ('${ids.tenantB}', 'confirmation-b', 'en_US', 'utility');

  insert into public.whatsapp_voice_jobs (
    tenant_id, message_id, media_id
  ) values
    ('${ids.tenantA}', '${ids.messageA}', 'media-a'),
    ('${ids.tenantB}', '${ids.messageB}', 'media-b');

  insert into public.audit_log (tenant_id, user_id, action) values
    ('${ids.tenantA}', '${ids.userA}', 'test.a'),
    ('${ids.tenantB}', '${ids.userB}', 'test.b');

  insert into public.billing_events (tenant_id, event_type) values
    ('${ids.tenantA}', 'test.a'),
    ('${ids.tenantB}', 'test.b');

  insert into public.contact_submissions (name, email, topic, message) values
    ('Prospect', 'prospect@example.com', 'sales', 'Hello');
`;

export async function createTenantTestDatabase(): Promise<PGlite> {
  const db = new PGlite({
    extensions: {
      btree_gist,
      pgcrypto,
      vector,
    },
  });

  await db.exec(postgresPrelude);

  const migrationsDirectory = join(process.cwd(), 'supabase', 'migrations');
  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const migrationName of migrationNames) {
    const migration = await readFile(join(migrationsDirectory, migrationName), 'utf8');
    await db.exec(migration);
  }

  await db.exec(`
    grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
    grant usage on schema public to service_role;
    grant select, insert, update, delete on all tables in schema public to service_role;
    grant usage, select on all sequences in schema public to service_role;
  `);
  await db.exec(fixtures);

  return db;
}

export async function useTenantClaims(
  db: PGlite,
  input: { tenantId: string; tenantRole: 'owner' | 'admin' | 'member' },
): Promise<void> {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({
      role: 'authenticated',
      app_metadata: {
        tenant_id: input.tenantId,
        role: input.tenantRole,
      },
    }),
  ]);
  await db.exec('set role authenticated');
}

export async function useRawAuthenticatedClaims(
  db: PGlite,
  claims: Record<string, unknown>,
): Promise<void> {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ role: 'authenticated', ...claims }),
  ]);
  await db.exec('set role authenticated');
}

export async function resetDatabaseRole(db: PGlite): Promise<void> {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims', '{}', false)");
}

export async function useServiceRole(db: PGlite): Promise<void> {
  await resetDatabaseRole(db);
  await db.exec('set role service_role');
}
