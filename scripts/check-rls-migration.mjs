import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationsDir = 'supabase/migrations';
const sql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(join(migrationsDir, file), 'utf8'))
  .join('\n');

/**
 * Le tabelle da controllare vengono ricavate dalle migration stesse.
 *
 * Prima erano una lista scritta a mano: una tabella nuova creata senza RLS, e
 * senza aggiungerla alla lista, passava il gate senza che nessuno se ne
 * accorgesse. Un controllo che ignora ciò che non conosce protegge solo il
 * passato.
 */
const declaredTables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)]
  .map((match) => match[1])
  .filter((table, index, all) => all.indexOf(table) === index)
  .sort();

if (declaredTables.length === 0) {
  console.error('Nessuna tabella trovata nelle migration: il controllo non sta leggendo nulla.');
  process.exit(1);
}

const missing = declaredTables.filter(
  (table) => !sql.includes(`alter table public.${table} enable row level security`),
);

if (missing.length > 0) {
  console.error(`Tabelle senza Row Level Security: ${missing.join(', ')}`);
  process.exit(1);
}

const requiredSnippets = [
  "auth.jwt() -> 'app_metadata' ->> 'tenant_id'",
  "auth.jwt() -> 'app_metadata' ->> 'role'",
  'revoke execute on function public.increment_usage_metrics',
  'grant execute on function public.increment_usage_metrics',
  'create or replace function public.match_knowledge_base',
  'revoke execute on function public.match_knowledge_base',
  'grant execute on function public.match_knowledge_base',
  'integrations_provider_external_account_unique_idx',
  'integrations_tenant_singleton_provider_unique_idx',
  'auto_reply_enabled boolean not null default false',
  'provider_message_id text',
  'messages_tenant_provider_message_unique_idx',
  'whatsapp_outbox_jobs_ready_idx',
  'whatsapp_message_templates_tenant_status_idx',
  'customer_service_window_expires_at',
  'appointments_reminder_due_idx',
  'confirmation_queued_at timestamptz',
  'booking_min_lead_minutes integer not null default 120',
  'booking_slot_step_minutes integer not null default 15',
  'booking_buffer_minutes integer not null default 0',
  'booking_max_days_ahead integer not null default 30',
  'calendar_sync_status text not null default',
  'appointments_tenant_status_scheduled_idx',
  'appointments_no_confirmed_overlap',
  'create extension if not exists "btree_gist"',
  'revoke execute on function public.claim_whatsapp_outbox_jobs',
  'grant execute on function public.claim_whatsapp_outbox_jobs',
  'revoke execute on function public.complete_whatsapp_outbox_job',
  'grant execute on function public.complete_whatsapp_outbox_job',
  'revoke execute on function public.fail_whatsapp_outbox_job',
  'grant execute on function public.fail_whatsapp_outbox_job',
  'whatsapp_voice_jobs_ready_idx',
  'revoke execute on function public.claim_whatsapp_voice_jobs',
  'grant execute on function public.claim_whatsapp_voice_jobs',
  'create or replace function public.replace_tenant_business_hours',
  'revoke execute on function public.replace_tenant_business_hours',
  'grant execute on function public.replace_tenant_business_hours',
  'create or replace function public.create_tenant_onboarding',
  'revoke execute on function public.create_tenant_onboarding',
  'grant execute on function public.create_tenant_onboarding',
  'add column if not exists stripe_customer_id text',
  'add column if not exists stripe_subscription_id text',
  'add column if not exists subscription_status text',
  'add column if not exists current_period_end timestamptz',
  'add column if not exists cancel_at_period_end boolean not null default false',
  'tenants_stripe_customer_id_key',
  'tenants_stripe_subscription_id_key',
  'invoices_tenant_status_idx',
  'billing_events_tenant_created_idx',
  'voice_messages_count integer not null default 0',
  'p_voice_messages_delta integer default 0',
  'usage_metrics_tenant_month_idx',
];

const missingSnippets = requiredSnippets.filter((snippet) => !sql.includes(snippet));

if (missingSnippets.length > 0) {
  console.error(`Missing hardened migration snippets: ${missingSnippets.join(', ')}`);
  process.exit(1);
}

console.log(
  `RLS migration coverage OK: ${declaredTables.length} tables declared, all with RLS enabled.`,
);
