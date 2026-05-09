-- Fatto da Claude Code il 27 aprile 2026.
-- Stripe billing MVP: aggiunge le colonne Stripe sul tenant e indici di lookup
-- su invoices/billing_events. Le tabelle invoices e billing_events sono gia'
-- create con RLS (vedi 202604240001_initial_backend_mvp.sql), quindi qui non
-- vengono toccate le policy esistenti.

alter table public.tenants
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

create unique index if not exists tenants_stripe_customer_id_key
  on public.tenants(stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists tenants_stripe_subscription_id_key
  on public.tenants(stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists invoices_tenant_status_idx
  on public.invoices(tenant_id, status);

create index if not exists billing_events_tenant_created_idx
  on public.billing_events(tenant_id, created_at desc);
