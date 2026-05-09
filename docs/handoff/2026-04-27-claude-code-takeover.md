# Ambrogio.ai - Handoff Temporaneo Per Claude Code

Fatto da Codex il 27 aprile 2026.

Questo file e' il resoconto rapido per il takeover temporaneo. Il founder ha chiesto a Claude Code di proseguire mentre Codex si ferma; Codex rientra previsto il 1 maggio 2026.

## Stato Verificato

Ultima verifica completa fatta da Codex:

- `npm run verify`: passato.
- Test: 36 file, 136 test passati.
- RLS lint: OK su 21 tabelle.
- `npm run build`: passato, 28 route generate.
- `npm audit --audit-level=moderate`: 0 vulnerabilita'.

Non eseguire `npm run verify` in parallelo con `npm run build`: Next puo' riscrivere `.next/types` mentre TypeScript li legge.

## Regole Di Progetto

- Usare solo il brand Ambrogio.ai / Ambrogio.
- Trial MVP: 14 giorni gratis senza carta.
- Backend prima del frontend finale.
- Ogni modifica importante deve essere documentata in `docs/memory/agent-log.md`.
- Ogni modifica documentata deve indicare autore, es. "Fatto da Claude Code".
- Mantenere pattern route sottile -> service -> repository -> test.
- Non mettere service role key o logica server nel client.
- Non cambiare pricing, trial, legal copy o ownership senza richiesta esplicita del founder.
- Non fare refactor non richiesti durante billing/usage: il backend e' gia' abbastanza ampio.

## Backend Gia' Pronto

Core:

- Next.js 15 App Router, TypeScript strict, Supabase, Zod, Pino.
- `src/lib/api/json.ts`: envelope API, request id, logging, error mapping.
- `src/lib/auth/session.ts`: sessione Supabase multi-tenant e user pre-tenant.
- `src/lib/supabase/admin.ts`: service role server-only.
- `src/lib/rate-limit/*`: Upstash o fallback in-memory.

WhatsApp:

- Webhook WhatsApp con secret header, idempotenza e rate limit.
- Tenant resolution da integration WhatsApp.
- Persistenza conversazioni e messaggi.
- Intent analysis e auto-reply con doppio gate.
- Opt-out keyword inbound, conferma service e revoca auditata.
- Outbox durabile con retry/dead-letter.
- Policy finestra WhatsApp 24h: free-form solo dentro finestra, template fuori.
- Template service/sync e appointment notifications.

Voice:

- Inbound vocali WhatsApp accodati.
- Media download/storage.
- ElevenLabs STT.
- Transcript verso auto-reply.
- Guardrail su transcript vuoto, confidence bassa, emergenze/casi sensibili.

Booking/Calendar:

- Availability da services, business hours, tenant config, busy locali e Google.
- Create/reschedule/cancel appointments.
- Google Calendar OAuth, token cifrati, refresh token.
- Constraint DB anti-overlap.
- Booking bridge WhatsApp con conferma slot, reschedule e cancellation.

Dashboard APIs:

- `GET/PATCH /api/settings/tenant`
- `GET/POST /api/settings/services`
- `PATCH/DELETE /api/settings/services/[serviceId]`
- `GET/PUT /api/settings/business-hours`
- `GET /api/conversations`
- `GET/PATCH /api/conversations/[conversationId]`
- `GET/POST /api/knowledge-base`
- `GET/PATCH/DELETE /api/knowledge-base/[documentId]`
- `GET/DELETE /api/whatsapp/opt-outs`

Onboarding:

- `GET/POST /api/onboarding/tenant`
- Crea tenant trial 14 giorni senza carta.
- Crea primo owner in `users`.
- Seed `tenant_config`, servizio "Prima visita" e business hours lunedi-venerdi 09:00-18:00.
- Sync `app_metadata.tenant_id` e `app_metadata.role`.

## Migrazioni Importanti

- `supabase/migrations/202604240001_initial_backend_mvp.sql`
- `supabase/migrations/202604260002_tenant_settings_api.sql`
- `supabase/migrations/202604260003_tenant_onboarding.sql`

Lo script `scripts/check-rls-migration.mjs` legge tutte le migrazioni e controlla tabelle/RPC sensibili.

## Prossimo Step 1 - Stripe Billing

Priorita' massima.

Obiettivo MVP:

- Trial 14 giorni senza carta.
- Piani: Starter, Professional, Agency.
- Checkout Stripe per upgrade.
- Customer Portal Stripe.
- Webhook Stripe con signature verification.
- Persistenza `invoices` e `billing_events`.
- Stato billing tenant leggibile dal backend/dashboard.

Implementazione consigliata:

1. Prima verificare documentazione Stripe ufficiale aggiornata.
2. Creare `src/server/billing/stripe.ts`.
3. Creare route:
   - `GET /api/billing/status`
   - `POST /api/billing/checkout`
   - `POST /api/billing/portal`
   - `POST /api/webhook/stripe`
4. Validare env con Zod:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - price IDs per piano.
5. Usare service/repository separati.
6. Testare:
   - status tenant trial;
   - checkout session;
   - portal session;
   - webhook signature;
   - idempotenza eventi;
   - invoice/subscription mapping.

Nota: non cambiare la policy "senza carta" senza conferma founder.

## Prossimo Step 2 - Usage Limits

Dopo billing.

Obiettivo:

- Limitare/monitorare messaggi, vocali e costo AI per piano.
- Soft warning prima del blocco.
- Hard block configurabile per abuso o sospensione.

Da aggiungere:

- Service `src/server/usage/limits.ts`.
- Lettura `usage_metrics`.
- Policy per plan:
  - trial;
  - starter;
  - professional;
  - agency.
- Integrazione nei punti sensibili:
  - webhook auto-reply;
  - voice worker;
  - outbox;
  - AI reply/cost accounting.

## Prossimo Step 3 - Invio Manuale Operatore

Dopo usage o in parallelo se piccolo.

Obiettivo:

- Da inbox, owner/admin/human operator puo' inviare messaggio manuale.
- Deve rispettare opt-out e finestra WhatsApp 24h/template.
- Deve creare `messages.sender_type='human'` e job outbox.
- Deve auditare azione.

Route probabile:

- `POST /api/conversations/[conversationId]/messages`

Attenzione:

- Non inviare free-form fuori finestra.
- Non bypassare opt-out.
- Valutare template manuale fuori finestra solo dopo template reali approvati.

## Prossimo Step 4 - Security Review Mirata

Prima beta:

- Review service role usage.
- Test RLS tenant A/B con Supabase locale/test project.
- Verifica webhook Stripe/WhatsApp.
- Verifica route admin/member.
- Gitleaks.
- Runbook produzione.

## Cose Da Non Fare Ora

- Non costruire frontend finale prima di billing/usage.
- Non introdurre nuovi provider AI.
- Non rifare schema DB senza motivo.
- Non rimuovere fallback rule-based.
- Non promettere "GDPR compliant" nei testi.
- Non attivare TTS outbound senza policy consenso/retention e compatibilita' WhatsApp.

## Comandi Di Verifica

Eseguire prima di lasciare il progetto:

```bash
npm run verify
npm run build
npm audit --audit-level=moderate
```

Se si tocca naming/brand:

```bash
rg --hidden -n -i "centralino" . -g '!node_modules/**' -g '!.next/**' -g '!.git/**'
```

## Rientro Codex

Codex rientra previsto il 1 maggio 2026. Al rientro, leggere:

1. `docs/handoff/2026-04-27-claude-code-takeover.md`
2. `docs/memory/agent-log.md`
3. `docs/memory/project-memory.md`
4. Ultimi diff e test lasciati dal takeover.
