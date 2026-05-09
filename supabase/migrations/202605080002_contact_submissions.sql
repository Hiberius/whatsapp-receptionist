-- Fatto da Claude Code l'8 maggio 2026.
-- Tabella `contact_submissions`: raccolta lead/feedback dal form pubblico
-- (POST /api/contact). Dati in chiaro, non multi-tenant: il submitter
-- non ha sessione e non e' associato a un tenant esistente.
--
-- Flusso:
-- 1. Utente invia POST /api/contact (rate-limited a 5/min per IP).
-- 2. Row inserita qui con `processed_at` NULL.
-- 3. Email notifica inviata a hello@ambrogio.ai (Resend integration TODO).
-- 4. Operatore marca `processed_at` quando gestita.
--
-- RLS: solo service_role puo' leggere/scrivere. Non vengono esposti i
-- submission ai tenant (privacy: contengono email/PII di prospect).

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  topic text not null check (topic in ('sales', 'support', 'agency', 'press', 'other')),
  message text not null,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists contact_submissions_created_idx
  on public.contact_submissions(created_at desc);

create index if not exists contact_submissions_unprocessed_idx
  on public.contact_submissions(created_at desc)
  where processed_at is null;

alter table public.contact_submissions enable row level security;

-- Nessuna policy per anon/authenticated: tabella accessibile solo via service_role
-- (server-side da /api/contact e job interni). Postgres nega di default
-- senza policy quando RLS e' attivo.
create policy contact_submissions_service_role_all on public.contact_submissions
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
