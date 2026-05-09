-- Fatto da Claude Code l'8 maggio 2026.
-- GDPR Art. 15 / Art. 17 endpoints: rendiamo l'audit_log sopravvivente
-- all'hard-delete del tenant, perche' il log di compliance non puo' essere
-- cancellato neanche quando l'azienda chiude.
--
-- Cambi:
-- 1. audit_log.tenant_id e audit_log.user_id passano a ON DELETE SET NULL
--    (prima erano references "naked": il delete del tenant avrebbe fallito).
-- 2. Aggiungiamo metadati semantici sulle action GDPR riconosciute dal codice
--    applicativo (commento descrittivo sotto).
--
-- Action types usate dal servizio GDPR (src/server/gdpr/*):
--   gdpr.tenant.export.requested      -> Art. 15 tenant export download
--   gdpr.tenant.deletion.requested    -> Art. 17 soft-delete con grace 30gg
--   gdpr.tenant.deletion.cancelled    -> annullamento deletion entro grace
--   gdpr.tenant.hard_delete.executed  -> hard delete eseguito da job cron
--   gdpr.customer.export.requested    -> Art. 15 customer-level export
--   gdpr.customer.deletion.executed   -> Art. 17 customer-level cancellazione

alter table public.audit_log
  drop constraint if exists audit_log_tenant_id_fkey;

alter table public.audit_log
  add constraint audit_log_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete set null;

alter table public.audit_log
  drop constraint if exists audit_log_user_id_fkey;

alter table public.audit_log
  add constraint audit_log_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

create index if not exists audit_log_action_idx on public.audit_log(action, created_at desc);
