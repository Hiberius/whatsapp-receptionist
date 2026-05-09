# Database

WhatsApp Receptionist uses **Supabase Postgres** with Row-Level Security as its primary datastore. This document covers the schema, the migration workflow, and how multi-tenant isolation is enforced at the database level.

## Schema overview

21 tables, organised by domain:

### Tenants and identity
- `tenants` — one row per business using the system
- `users` — Supabase auth users (mirrored)
- `tenant_users` — many-to-many with `role` (owner / admin / member)
- `tenant_config` — per-tenant settings (timezone, locale, AI personality, voice ID, escalation rules)

### Services and availability
- `services` — bookable services (name, duration, price, operator)
- `business_hours` — per day of week + per service overrides

### Conversations and messaging
- `conversations` — one per WhatsApp customer
- `messages` — every inbound + outbound message
- `opt_outs` — customers who explicitly opted out
- `voice_events` — audio download + transcription tracking
- `whatsapp_message_templates` — Meta-approved templates synced from WABA
- `whatsapp_outbox_jobs` — queued outbound messages
- `whatsapp_voice_jobs` — queued voice processing

### Booking
- `appointments` — confirmed bookings with calendar event reference
- `webhook_events` — idempotency log (Stripe + WhatsApp webhooks)

### Knowledge and AI
- `ai_prompts` — per-tenant prompt overrides
- `knowledge_base` — Q&A pairs, FAQs, service descriptions for retrieval

### Integrations
- `integrations` — encrypted OAuth tokens (Google Calendar, etc.)

### Billing and compliance
- `billing_events` — Stripe subscription events log
- `invoices` — issued invoices with SDI status
- `usage_metrics` — monthly conversation counts, voice minutes, etc.
- `audit_log` — immutable record of GDPR + admin actions
- `contact_submissions` — public contact form submissions (with rate limit)

## Row-Level Security pattern

Every tenant-scoped table follows this pattern:

```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_tenant_isolation ON conversations
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

This means: even if application code forgets to filter by `tenant_id`, the database will return zero rows. RLS is the security boundary.

The `tenant_id` is pulled from the user's JWT app_metadata, which is set by Supabase Auth at login time and signed with the project secret. End users cannot forge it.

## Migration workflow

Migrations live in `supabase/migrations/` as plain SQL files, named with timestamp prefix:

```
supabase/migrations/
├── 202604240001_initial_schema.sql
├── 202604250001_audit_log.sql
├── 202604260001_voice_events.sql
├── 202604270001_whatsapp_outbox.sql
├── 202604280001_billing_events.sql
├── 202605080001_audit_log_gdpr_actions.sql
└── 202605080002_contact_submissions.sql
```

### Local development

If you have the Supabase CLI:

```bash
npx supabase init
npx supabase start          # local Postgres + auth + storage
npx supabase db push        # apply migrations
```

If you prefer Supabase Cloud, point `NEXT_PUBLIC_SUPABASE_URL` to your project and run:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### Production

The recommended workflow is:

1. Create a migration locally
2. Test against a Supabase staging branch
3. Merge to main → CI verifies typecheck + tests
4. Manually run `supabase db push` against production
5. Verify with `npm run db:lint` (RLS coverage check)

Never edit a migration that has been applied to production. Always create a new forward migration.

## RLS lint script

`scripts/check-rls-migration.mjs` parses every migration and verifies:

- Every `CREATE TABLE` is followed by `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- Every table has at least one `CREATE POLICY` referencing it
- No table is silently exposed to anonymous users

It runs as part of `npm run verify` and CI.

## Indexes

Indexes are added explicitly in migrations. Common patterns:

- `tenant_id` on every tenant-scoped table (required for RLS performance)
- Composite `(tenant_id, created_at DESC)` for time-ordered listings
- Unique constraints on natural keys (e.g., `(tenant_id, customer_phone_e164)` for conversations)

## Type generation

Drizzle ORM is used for type-safe queries. The schema is defined in `src/lib/db/schema.ts` and types flow from there into server services. There's no separate type generation step — Drizzle infers everything.

## Backups and disaster recovery

- Supabase Pro: daily automatic backups, 7-day retention
- Supabase Team: 30-day retention, point-in-time recovery
- Self-host: configure `pg_dump` cron to encrypted S3 / R2 bucket

The `INTERNAL_JOB_SECRET` cron job `gdpr-hard-delete` runs at 3 AM daily and permanently removes tenants past their 30-day grace period.

## Privacy and retention

- **Conversation messages**: retained 24 months rolling, then deleted
- **Voice audio files**: retained 90 days
- **Audit log**: never deleted (compliance requirement)
- **Invoices**: retained 10 years (Italian fiscal law)
- **Tenants soft-deleted**: 30-day grace period before hard delete

These are hardcoded in `src/server/gdpr/` and `src/server/storage/`. Adjust if your jurisdiction requires different retention.

## Performance tips

- Always include `tenant_id` in `WHERE` clauses, even when RLS would handle it. RLS uses indexes; manual filtering helps the planner.
- Use `LIMIT` on conversation listings — there's no automatic pagination guard
- Avoid `SELECT *` in hot paths; pick only columns you need
- For analytics queries, use Supabase's read replicas (Pro tier) instead of the primary
