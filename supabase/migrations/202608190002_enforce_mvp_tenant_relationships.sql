-- RLS checks the tenant_id stored on each row. These composite foreign keys
-- also ensure that an authenticated or service-role write cannot attach an
-- MVP child record to a parent owned by another tenant.
create unique index if not exists conversations_tenant_id_id_key
  on public.conversations (tenant_id, id);

create unique index if not exists services_tenant_id_id_key
  on public.services (tenant_id, id);

create unique index if not exists messages_tenant_id_id_key
  on public.messages (tenant_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_tenant_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_tenant_id_fkey
      foreign key (tenant_id)
      references public.tenants (id)
      on delete cascade
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_tenant_conversation_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_tenant_conversation_fkey
      foreign key (tenant_id, conversation_id)
      references public.conversations (tenant_id, id)
      on delete cascade
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_tenant_conversation_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_tenant_conversation_fkey
      foreign key (tenant_id, conversation_id)
      references public.conversations (tenant_id, id)
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_tenant_service_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_tenant_service_fkey
      foreign key (tenant_id, service_id)
      references public.services (tenant_id, id)
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'whatsapp_outbox_jobs_tenant_message_fkey'
      and conrelid = 'public.whatsapp_outbox_jobs'::regclass
  ) then
    alter table public.whatsapp_outbox_jobs
      add constraint whatsapp_outbox_jobs_tenant_message_fkey
      foreign key (tenant_id, message_id)
      references public.messages (tenant_id, id)
      on delete cascade
      not valid;
  end if;
end $$;

-- Validation deliberately makes deployment fail if legacy cross-tenant links
-- already exist, so they are never silently accepted as trusted constraints.
alter table public.messages
  validate constraint messages_tenant_conversation_fkey;
alter table public.appointments
  validate constraint appointments_tenant_id_fkey;
alter table public.appointments
  validate constraint appointments_tenant_conversation_fkey;
alter table public.appointments
  validate constraint appointments_tenant_service_fkey;
alter table public.whatsapp_outbox_jobs
  validate constraint whatsapp_outbox_jobs_tenant_message_fkey;
