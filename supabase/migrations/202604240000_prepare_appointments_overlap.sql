-- This compatibility migration intentionally sorts immediately before the
-- legacy initial migration. PostgreSQL rejects the legacy exclusion index
-- expression because timestamptz + interval is STABLE, while index
-- expressions must be IMMUTABLE. Historical migrations are not edited.
--
-- Creating the appointments table and corrected constraint first makes the
-- initial migration's CREATE TABLE IF NOT EXISTS and constraint guard skip
-- only the invalid definitions. The later tenant-integrity migration adds
-- the foreign keys, whose parent tables do not exist yet at this point.
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

create or replace function public.appointment_time_range(
  p_scheduled_at timestamptz,
  p_duration_minutes integer
)
returns tstzrange
language sql
immutable
parallel safe
as $$
  select tstzrange(
    p_scheduled_at,
    p_scheduled_at + p_duration_minutes * interval '1 minute',
    '[)'
  );
$$;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  conversation_id uuid,
  service_id uuid,
  customer_identifier text not null,
  customer_name text not null,
  customer_phone text,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30,
  service_type text,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  calendar_event_id text,
  calendar_provider text
    check (calendar_provider is null or calendar_provider in ('google_calendar')),
  calendar_sync_status text not null default 'not_configured'
    check (calendar_sync_status in ('not_configured', 'pending', 'synced', 'failed')),
  calendar_sync_error text,
  calendar_event_html_link text,
  booking_source text not null default 'manual'
    check (booking_source in ('manual', 'whatsapp_ai', 'dashboard', 'api')),
  notes text,
  confirmation_queued_at timestamptz,
  reminder_24h_queued_at timestamptz,
  reminder_1h_queued_at timestamptz,
  cancellation_queued_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_no_confirmed_overlap'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_no_confirmed_overlap
      exclude using gist (
        tenant_id with =,
        public.appointment_time_range(scheduled_at, duration_minutes) with &&
      )
      where (status = 'confirmed');
  end if;
end $$;
