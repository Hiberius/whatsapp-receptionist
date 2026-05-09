# PROMPT 02 - DATABASE SCHEMA CON RLS

## PROMPT OPERATIVO CODEX

Ora creiamo lo schema database completo su Supabase con Row Level Security. Segui questi step in ordine.

STEP 1 - Migrations folder

- Crea cartella supabase/migrations/
- Ogni migration avra' timestamp prefix: 20260423000001_description.sql
- Crea script npm "db:migrate" che applica migrations a Supabase

STEP 2 - Schema tabelle principali

Crea migration 20260423000001_initial_schema.sql con questi modelli:

TABELLA tenants
Colonne:
- id uuid primary key default gen_random_uuid()
- name text not null
- slug text unique not null (per subdomain, es. "studio-rossi")
- plan text not null default 'trial' check (plan in ('trial', 'starter', 'professional', 'agency'))
- status text not null default 'active' check (status in ('active', 'expired', 'suspended', 'cancelled'))
- billing_email text not null
- vat_number text (P.IVA italiana, opzionale)
- fiscal_code text (codice fiscale, opzionale)
- country text not null default 'IT'
- timezone text not null default 'Europe/Rome'
- business_type text (dental, aesthetic, veterinary, fitness, legal, other)
- trial_ends_at timestamptz
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- deleted_at timestamptz (soft delete)

TABELLA users (estende auth.users di Supabase)
Colonne:
- id uuid primary key (references auth.users.id)
- tenant_id uuid not null (references tenants.id on delete cascade)
- role text not null default 'member' check (role in ('owner', 'admin', 'member'))
- full_name text
- phone text
- avatar_url text
- mfa_enabled boolean default false
- last_login_at timestamptz
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

TABELLA conversations
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- channel text not null check (channel in ('whatsapp', 'instagram_dm', 'web_chat', 'sms'))
- customer_identifier text not null (numero WhatsApp o username Instagram)
- customer_name text
- status text not null default 'active' check (status in ('active', 'escalated', 'closed', 'spam'))
- ai_enabled boolean default true
- last_message_at timestamptz not null default now()
- metadata jsonb default '{}'
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

TABELLA messages
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- conversation_id uuid not null (references conversations.id on delete cascade)
- direction text not null check (direction in ('inbound', 'outbound'))
- sender_type text not null check (sender_type in ('customer', 'ai', 'human', 'system'))
- content text nullable (audio/media/status possono non avere testo)
- media_urls text[] not null default '{}'
- message_type text not null default 'text' check (message_type in ('text', 'image', 'audio', 'document', 'location', 'status'))
- status text not null default 'received' check (status in ('received', 'pending', 'sent', 'delivered', 'read', 'failed'))
- transcript_text text (trascrizione ElevenLabs dei vocali WhatsApp)
- transcript_language text
- audio_duration_secs numeric(10,3)
- generated_audio_url text (nota vocale generata da ElevenLabs per outbound)
- voice_id text
- voice_model_id text
- intent text (classificato da AI)
- confidence decimal(3,2)
- tokens_used integer
- cost_cents integer
- external_id text (ID interno/idempotenza provider, es. message:{wamid} o auto-reply:message:{wamid})
- provider_message_id text (wamid outbound ritornato dal provider, usato per status webhook)
- metadata jsonb not null default '{}'
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- UNIQUE(tenant_id, external_id)
- UNIQUE parziale su (tenant_id, provider_message_id) dove provider_message_id is not null

TABELLA appointments
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- conversation_id uuid (references conversations.id)
- customer_identifier text not null
- customer_name text not null
- customer_phone text
- scheduled_at timestamptz not null
- duration_minutes integer not null default 30
- service_type text
- status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed', 'no_show'))
- calendar_event_id text (ID su Google Calendar)
- calendar_provider text check (calendar_provider is null or calendar_provider in ('google_calendar'))
- calendar_sync_status text not null default 'not_configured' check (calendar_sync_status in ('not_configured', 'pending', 'synced', 'failed'))
- calendar_sync_error text
- calendar_event_html_link text
- booking_source text not null default 'manual' check (booking_source in ('manual', 'whatsapp_ai', 'dashboard', 'api'))
- notes text
- confirmation_queued_at timestamptz
- reminder_24h_queued_at timestamptz
- reminder_1h_queued_at timestamptz
- cancellation_queued_at timestamptz
- reminded_at timestamptz
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

TABELLA knowledge_base (FAQ e info dello studio per RAG)
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- title text not null
- content text not null
- category text
- embedding vector(1536) (per pgvector, il provider AI usa embeddings tramite altro servizio)
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

TABELLA tenant_config
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null unique (references tenants.id on delete cascade)
- studio_name text not null
- assistant_name text not null default 'Ambrogio'
- city text
- address text
- phone text
- email text
- default_locale text not null default 'it-IT'
- ai_disclosure_enabled boolean not null default true
- auto_reply_enabled boolean not null default false
- voice_messages_enabled boolean not null default true
- voice_replies_enabled boolean not null default false
- booking_min_lead_minutes integer not null default 120
- booking_slot_step_minutes integer not null default 15
- booking_buffer_minutes integer not null default 0
- booking_max_days_ahead integer not null default 30
- elevenlabs_voice_id text
- elevenlabs_stt_model text not null default 'scribe_v2'
- elevenlabs_tts_model text not null default 'eleven_flash_v2_5'
- human_escalation_email text
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

TABELLA services
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- name text not null
- description text
- duration_minutes integer not null default 30
- price_cents integer
- active boolean not null default true
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

TABELLA business_hours
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- weekday integer not null check (weekday between 0 and 6)
- opens_at time not null
- closes_at time not null
- active boolean not null default true
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

TABELLA opt_outs
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- channel text not null check (channel in ('whatsapp', 'instagram_dm', 'web_chat', 'sms'))
- customer_identifier text not null
- reason text
- opted_out_at timestamptz not null default now()
- created_at timestamptz not null default now()
- UNIQUE(tenant_id, channel, customer_identifier)

TABELLA usage_metrics
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- metric_month date not null
- conversations_count integer not null default 0
- messages_count integer not null default 0
- ai_cost_cents integer not null default 0
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- UNIQUE(tenant_id, metric_month)

TABELLA invoices
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- stripe_invoice_id text not null unique
- fattureincloud_invoice_id text
- invoice_number text
- amount_cents integer not null
- vat_cents integer not null default 0
- currency text not null default 'EUR'
- status text not null default 'draft'
- sdi_status text
- issued_at timestamptz
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

TABELLA ai_prompts
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid (references tenants.id on delete cascade; null = prompt globale)
- prompt_key text not null
- version integer not null
- model text not null
- prompt_text text not null
- active boolean not null default false
- created_by uuid (references users.id)
- created_at timestamptz not null default now()
- UNIQUE(tenant_id, prompt_key, version)

TABELLA voice_events
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- message_id uuid (references messages.id on delete set null)
- provider text not null default 'elevenlabs'
- direction text not null check (direction in ('stt', 'tts'))
- model text not null
- voice_id text
- input_chars integer
- audio_duration_secs numeric(10,3)
- cost_cents integer
- status text not null default 'completed' check (status in ('pending', 'completed', 'failed'))
- metadata jsonb default '{}'
- created_at timestamptz not null default now()

TABELLA integrations
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- provider text not null check (provider in ('whatsapp_360dialog', 'google_calendar', 'cal_com', 'calendly', 'fatture_in_cloud', 'stripe'))
- external_account_id text (es. WhatsApp phone_number_id)
- external_display_id text (es. numero leggibile o account esterno)
- status text not null default 'active'
- credentials jsonb not null (encrypted via Supabase Vault)
- config jsonb default '{}'
- last_sync_at timestamptz
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- Non usare UNIQUE(tenant_id, provider) globale: serve supportare piu' numeri/account per lo stesso provider.
- Indice unico parziale: UNIQUE(provider, external_account_id) dove external_account_id is not null.
- Indice unico parziale singleton: UNIQUE(tenant_id, provider) solo dove external_account_id is null.

TABELLA webhook_events
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid nullable (references tenants.id on delete cascade)
- provider text not null
- event_type text not null
- external_id text not null
- idempotency_key text not null unique
- status text not null default 'received' check (status in ('received', 'processed', 'duplicate', 'failed'))
- payload jsonb default '{}'
- error_code text
- error_message text
- received_at timestamptz not null default now()
- processed_at timestamptz

TABELLA whatsapp_outbox_jobs
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- message_id uuid not null unique (references messages.id on delete cascade)
- provider text not null default 'whatsapp_360dialog' check (provider in ('whatsapp_360dialog'))
- status text not null default 'pending' check (status in ('pending', 'processing', 'retry', 'sent', 'failed', 'dead_letter'))
- recipient_identifier text not null
- payload jsonb not null default '{}'
- attempt_count integer not null default 0 check (attempt_count >= 0)
- max_attempts integer not null default 5 check (max_attempts > 0)
- next_attempt_at timestamptz not null default now()
- locked_at timestamptz
- locked_by text
- provider_message_id text
- last_error_code text
- last_error_message text
- last_attempt_at timestamptz
- sent_at timestamptz
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

TABELLA whatsapp_message_templates
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- provider text not null default 'whatsapp_360dialog' check (provider in ('whatsapp_360dialog'))
- name text not null
- language_code text not null default 'it'
- category text not null check (category in ('utility', 'marketing', 'authentication'))
- status text not null default 'pending' check (status in ('draft', 'pending', 'approved', 'rejected', 'paused', 'disabled'))
- external_id text
- quality_rating text
- components jsonb not null default '[]'
- last_synced_at timestamptz
- metadata jsonb not null default '{}'
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()
- UNIQUE(tenant_id, provider, name, language_code)

TABELLA whatsapp_voice_jobs
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- message_id uuid not null unique (references messages.id on delete cascade)
- provider text not null default 'whatsapp_360dialog' check (provider in ('whatsapp_360dialog'))
- status text not null default 'pending' check (status in ('pending', 'processing', 'retry', 'completed', 'failed', 'dead_letter'))
- media_id text not null
- media_mime_type text
- media_sha256 text
- payload jsonb not null default '{}'
- attempt_count integer not null default 0 check (attempt_count >= 0)
- max_attempts integer not null default 5 check (max_attempts > 0)
- next_attempt_at timestamptz not null default now()
- locked_at timestamptz
- locked_by text
- last_error_code text
- last_error_message text
- last_attempt_at timestamptz
- completed_at timestamptz
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

TABELLA audit_log (APPEND-ONLY, mai update/delete)
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid (references tenants.id)
- user_id uuid (references users.id)
- action text not null (login, create_appointment, delete_conversation, etc)
- resource_type text
- resource_id uuid
- ip_address inet
- user_agent text
- metadata jsonb default '{}'
- created_at timestamptz not null default now()

TABELLA billing_events
Colonne:
- id uuid primary key default gen_random_uuid()
- tenant_id uuid not null (references tenants.id on delete cascade)
- stripe_customer_id text
- stripe_subscription_id text
- event_type text not null (subscription_created, subscription_updated, invoice_paid, invoice_failed)
- amount_cents integer
- currency text default 'EUR'
- metadata jsonb default '{}'
- created_at timestamptz not null default now()

STEP 3 - Indici per performance

Crea migration 20260423000002_indexes.sql:
- Index su tutti i tenant_id
- Index su conversations (tenant_id, last_message_at DESC)
- Index su messages (conversation_id, created_at DESC)
- Unique partial index su messages (tenant_id, provider_message_id) where provider_message_id is not null
- Index su appointments (tenant_id, scheduled_at)
- Index su appointments (tenant_id, status, scheduled_at)
- Constraint `appointments_no_confirmed_overlap` con `btree_gist` per bloccare overlap tra appuntamenti confirmed dello stesso tenant
- Index GIST su knowledge_base.embedding (pgvector cosine similarity)
- Index su audit_log (tenant_id, created_at DESC)
- Index su whatsapp_outbox_jobs (next_attempt_at, created_at) where status in ('pending', 'retry')
- Index su whatsapp_message_templates (tenant_id, status, category)
- Index su whatsapp_voice_jobs (next_attempt_at, created_at) where status in ('pending', 'retry')

STEP 4 - Enable RLS

Crea migration 20260423000003_enable_rls.sql:
- ALTER TABLE per ogni tabella con ENABLE ROW LEVEL SECURITY
- Eccezioni: reference tables pubbliche

STEP 5 - Policies RLS

Crea migration 20260423000004_rls_policies.sql con policies per ogni tabella:

Pattern standard per tabelle tenant-scoped:

```sql
-- SELECT: utente vede solo dati del suo tenant
CREATE POLICY "tenant_isolation_select" ON conversations
FOR SELECT USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- INSERT: utente puo' inserire solo nel suo tenant
CREATE POLICY "tenant_isolation_insert" ON conversations
FOR INSERT WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- UPDATE: utente modifica solo dati del suo tenant
CREATE POLICY "tenant_isolation_update" ON conversations
FOR UPDATE USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
) WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- DELETE: solo owner puo' cancellare (role-based)
CREATE POLICY "owner_only_delete" ON conversations
FOR DELETE USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  AND (auth.jwt() ->> 'role') IN ('owner', 'admin')
);
```

Applica questo pattern a: tenant_config, services, business_hours, conversations, messages, appointments, knowledge_base, integrations, opt_outs, usage_metrics, invoices, voice_events, webhook_events, whatsapp_outbox_jobs, whatsapp_message_templates, whatsapp_voice_jobs.

Per tenants: l'utente vede solo il proprio tenant, non puo' cambiarlo (solo owner).
Per users: vede solo utenti del proprio tenant.
Per audit_log: SOLO SELECT, MAI update/delete. Solo admin role accede.

STEP 6 - Trigger e functions

Crea migration 20260423000005_triggers.sql:

- Function update_updated_at_column() che setta updated_at = now() on UPDATE
- Trigger su ogni tabella con colonna updated_at
- Function increment_usage_metrics() security definer con execute revocato a public/anon/authenticated e concesso solo a service_role
- Function claim_whatsapp_outbox_jobs() security definer con `FOR UPDATE SKIP LOCKED`, execute solo service_role; deve restituire anche `customer_service_window_expires_at = conversations.last_message_at + interval '24 hours'`
- Function claim_whatsapp_voice_jobs() security definer con `FOR UPDATE SKIP LOCKED`, execute solo service_role
- Function complete_whatsapp_outbox_job() security definer, execute solo service_role
- Function fail_whatsapp_outbox_job() security definer, execute solo service_role
- Function soft_delete() che setta deleted_at invece di DELETE fisico
- Trigger audit_log_writer che scrive in audit_log ogni INSERT/UPDATE/DELETE su tabelle critiche

STEP 7 - JWT claims custom

Configura Supabase Auth Hook in 20260423000006_auth_hooks.sql:

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  claims jsonb;
  user_tenant_id uuid;
  user_role text;
BEGIN
  SELECT tenant_id, role INTO user_tenant_id, user_role
  FROM public.users
  WHERE id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';
  
  IF user_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id::text));
    claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
```

Poi in Supabase Dashboard -> Auth -> Hooks, abilita "custom_access_token_hook".

STEP 8 - Types generation

Genera tipi TypeScript dallo schema:
- Installa supabase CLI
- Esegui: supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
- Crea script npm "db:types" per rigenerare i tipi dopo ogni migration

STEP 9 - Test RLS (critico)

Crea file test in tests/rls.test.ts che verifica:
1. Utente tenant A NON puo' vedere conversations tenant B
2. Utente tenant A NON puo' inserire dato con tenant_id di tenant B
3. Utente con role "member" NON puo' cancellare
4. Utente con role "owner" PUO' cancellare nel proprio tenant
5. Service role key bypassa RLS (per background jobs)

Esegui questi test e MOSTRAMI l'output. Se anche un solo test fallisce, fermati e fai debug insieme a me.

STEP 10 - Seed data per sviluppo

Crea seed in supabase/seed.sql:
- 1 tenant di test (studio-demo)
- 2 utenti (owner + member)
- 5 conversazioni esempio
- 20 messaggi
- 3 FAQ
- Questo seed deve essere idempotente (puo' essere rieseguito senza errori)

Dopo aver completato tutti gli step, genera un report Markdown con:
- Lista migrazioni create
- Schema finale (testo tabellare)
- Lista RLS policies create
- Report test RLS (passed/failed)
- Istruzioni per rigenerare tipi TypeScript
