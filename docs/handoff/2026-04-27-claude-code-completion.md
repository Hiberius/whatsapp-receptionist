# Ambrogio.ai - Rientro Codex Dopo Takeover Claude Code

Fatto da Claude Code il 27 aprile 2026.

Bentornato Codex. Questo file e' il pacchetto di rientro completo: cosa ho lavorato durante il takeover temporaneo, in che stato e' il backend, cosa rimane bloccato lato founder e dove riprendere.

## Riepilogo Esecutivo

Durante il takeover (27 aprile 2026, takeover temporaneo richiesto dal founder mentre eri fermo) ho completato i tre step backend successivi all'handoff che mi avevi lasciato, piu' una piccola estensione di plumbing frontend. In ordine:

1. **Stripe Billing MVP** (Step 1 dell'handoff Codex 2026-04-27).
2. **Usage Limits** (Step 2 dell'handoff Codex).
3. **Invio Manuale Operatore dall'inbox** (Step 3 dell'handoff Codex).
4. **Client API tipizzato browser-side** (extra, plumbing pura senza UI).

Il **Step 4 (Security Review Mirata)** l'ho lasciato a te: richiede contesto storico delle scelte di sicurezza, setup Supabase test locale e decisioni operative founder. Nessuna parte di frontend reale (visual direction, componenti finali, copy) e' stata toccata: ownership tua per regola founder.

## Stato Verificato (Ultima Verifica End-Of-Takeover)

- `npm run typecheck`: passato.
- `npm test`: 43 file test, 190 test passati. Pre-takeover erano 36 file / 136 test. **Zero regressioni** sui test esistenti.
- `npm run db:lint`: RLS migration coverage OK su 21 tabelle, snippet billing/usage presenti nello script di guardia.
- `npm run verify`: passato (typecheck + test + db:lint).
- `npm run build`: passato, **34 route generate**.
- `npm audit --audit-level=moderate`: **0 vulnerabilita'**.

Avvertenza ancora valida: NON eseguire `npm run verify` e `npm run build` in parallelo. Next 15 puo' riscrivere `.next/types` mentre tsc legge.

## Cosa Leggere In Ordine Al Rientro

1. Questo file.
2. `docs/handoff/2026-04-27-claude-code-takeover.md` (l'handoff che mi avevi lasciato; utile per ricordare le regole di scope).
3. `docs/memory/agent-log.md` — quattro nuove entry "Fatto da Claude Code 2026-04-27" con dettaglio file/comportamento/verifica per ognuno dei pezzi sopra.
4. `docs/memory/project-memory.md` — aggiornata con i nuovi moduli e le nuove righe API.
5. `docs/architecture/backend-foundation.md` — tre sezioni "Fatto da Claude Code 2026-04-27" (Stripe, Usage, Manual Operator).
6. `docs/handoff/frontend-contract.md` — contratti aggiunti per `/api/billing/*`, `/api/usage/status`, `POST /api/conversations/[conversationId]/messages` e per il client `src/lib/api-client/`.

## Step 1 - Stripe Billing MVP

Allineato al tuo handoff e a una decisione founder confermata: solo Starter + Professional in self-checkout, Agency manuale.

**File creati:**

- `supabase/migrations/202604270001_stripe_billing.sql`: colonne `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `current_period_end`, `cancel_at_period_end` su `tenants`. Indici unici parziali. Indici di lookup su `invoices`/`billing_events`. RLS pre-esistenti non toccate.
- `src/lib/stripe/client.ts`: SDK pinnato a `apiVersion='2026-02-25.clover'` (allineato ai tipi di `stripe@20.4.1`).
- `src/lib/stripe/webhook-security.ts`: `constructStripeEvent(rawBody, signature)`.
- `src/server/billing/stripe-billing.ts`: service + repository + `loadStripeBillingConfigFromEnv()`. Config iniettata via DI per testabilita'.
- `src/app/api/billing/status/route.ts`, `src/app/api/billing/checkout/route.ts`, `src/app/api/billing/portal/route.ts`, `src/app/api/webhook/stripe/route.ts`.
- `tests/server/billing/stripe-billing.test.ts` (11 test) e `tests/server/billing/stripe-webhook.test.ts` (10 test).

**File modificati:**

- `src/lib/env.ts` e `.env.example`: nuove env Stripe.
- `src/lib/rate-limit/index.ts`: `enforceStripeWebhookRateLimit` con stesso pattern WhatsApp.
- `scripts/check-rls-migration.mjs`: snippet di guardia.

**Comportamento chiave:**

- **Trial 14 giorni senza carta NON modificato**. Stripe non viene contattato durante l'onboarding.
- **Customer Stripe creato lazy** al primo checkout/portal call.
- **Idempotency webhook** via `webhook_events` con `createWebhookIdempotencyKey({ provider: 'stripe', externalId: event.id })`.
- **Tenant resolution**: prima `metadata.tenant_id`, poi `client_reference_id`, poi `findTenantByStripeCustomerId`.
- **Plan derivation** dal `price.id` confrontato con la config; price sconosciuto → `billing_event` con `event_type='unknown_price:<id>'`, non blocca.
- **`customer.subscription.deleted`** → tenant torna a `plan='trial'` + `status='cancelled'` (decisione founder).
- **Audit log** su checkout/portal create.

## Step 2 - Usage Limits MVP

Allineato al pricing pubblico (`01_STRATEGIA/pricing.md`).

**File creati:**

- `supabase/migrations/202604270002_usage_limits.sql`: aggiunge `usage_metrics.voice_messages_count` e aggiorna `public.increment_usage_metrics(...)` con il sesto parametro `p_voice_messages_delta`. Revoca/grant execute aggiornati per la nuova firma. Indice `usage_metrics_tenant_month_idx`.
- `src/server/usage/limits.ts`: `UsageLimitsService` + `SupabaseUsageLimitsRepository` + `DEFAULT_USAGE_LIMITS_CONFIG`.
- `src/app/api/usage/status/route.ts`.
- `tests/server/usage/limits.test.ts` (10 test) e `tests/server/usage/auto-reply-guard.test.ts` (2 test).

**File modificati (DI opzionale, backward-compat con i tuoi test esistenti):**

- `src/server/whatsapp/auto-reply.ts`: nuovo `skippedReason: 'usage_limit_reached'`. Argomento `usageLimits` opzionale al constructor. Guard chiamato dopo opt-out, prima di `insertOutboundMessage`. `requireVoiceQuota=true` quando `source='voice_transcript'`.
- `src/server/whatsapp/service.ts`: `WhatsAppWebhookService` accetta `usageLimits`. Dopo `inserted.created=true` chiama `usageLimits.registerInboundConversation()`.
- `src/server/whatsapp/voice-pipeline.ts`: `WhatsAppVoicePipelineWorker` accetta `usageLimits`. Dopo `markVoiceEventCompleted` chiama `usageLimits.registerVoiceMessage()` (try/catch tracking-only).
- `scripts/check-rls-migration.mjs`: nuovi snippet di guardia.

**Limiti per piano** (configurabili via `UsageLimitsConfig` DI):

| Piano | Conversazioni/mese | Vocali/mese |
|---|---|---|
| Trial | 100 | 50 |
| Starter | 500 | 200 |
| Professional | 2000 | 500 |
| Agency | 2000 per-tenant | 500 per-tenant |

**Comportamento:**

- Soft warning a >=80% di una metrica → `softWarning=true` nello snapshot, **nessun blocco**.
- Hard block solo dell'auto-reply a 100% → `skippedReason='usage_limit_reached'`. Webhook inbound, opt-out, voice STT, booking conversazionale e fallback umano restano operativi.
- Conversation = primo messaggio inbound del mese da quel customer (idempotente per mese).

## Step 3 - Invio Manuale Operatore

**File creati:**

- `src/server/conversations/operator-messages.ts`: `OperatorMessagesService` + `SupabaseOperatorMessagesRepository`.
- `src/app/api/conversations/[conversationId]/messages/route.ts`: POST con Zod strict.
- `tests/server/conversations/operator-messages.test.ts` (7 test).

**Nessuna nuova migration.** Riusa `messages` (`sender_type='human'` gia' in CHECK constraint), `whatsapp_outbox_jobs`, `audit_log`.

**Vincoli upfront (fail-fast):**

- solo owner/admin (member rifiutato);
- conversazione esistente e tenant-scoped (`not_found`);
- canale: solo WhatsApp in MVP;
- opt-out rifiutato (no bypass);
- finestra 24h dall'ultimo messaggio inbound del cliente: fuori finestra `conflict`. Template manuale fuori finestra rimandato a quando i template reali saranno approvati Meta/360dialog;
- contenuto 1..4096 char, trim e non vuoto;
- `external_id` server-side `manual:{uuid}` per evitare doppi invii.

Audit: `action='conversations.message.sent'`, `resource_type='message'`. **L'invio manuale NON conta** verso usage limits — l'operatore puo' rispondere anche dopo hard block auto-reply.

## Extra - Client API Browser-Side

Plumbing TypeScript per consumare le route Claude Code dal frontend. Livello "1": zero UI, zero copy, zero design. Pensato per essere accettato/esteso/sostituito da te senza vincoli sulla direzione visiva.

**File creati:**

- `src/lib/api-client/types.ts`: `ApiError` class + `ApiErrorCode` (codici server + `network_error`/`invalid_response` client-side).
- `src/lib/api-client/fetch.ts`: core `apiFetch<TSchema>()` con validazione envelope Zod, error mapping, network/parsing fallback.
- `src/lib/api-client/billing.ts`: `createBillingClient()` con `getStatus`, `createCheckoutSession`, `createPortalSession`.
- `src/lib/api-client/usage.ts`: `createUsageClient()` con `getStatus`.
- `src/lib/api-client/conversations.ts`: `createConversationsClient()` con `sendOperatorMessage`.
- `src/lib/api-client/index.ts`: re-export pubblico.
- `tests/lib/api-client/fetch.test.ts` (7 test) e `tests/lib/api-client/clients.test.ts` (7 test).

**Decisioni di design:**

- **Browser-only.** `credentials: 'same-origin'` propaga i cookie Supabase. Per RSC/Server Actions invocare direttamente i service in `src/server/...`.
- **Nessuna dipendenza nuova**: solo `zod` (gia' presente).
- **Nessuna lib di state management imposta**: scegli tu TanStack Query, SWR, server actions, RSC.
- **Validazione runtime su ogni response**: schema mismatch → `ApiError('invalid_response')`. Segnale forte se backend e client divergono.
- **Solo route Claude Code**: NON ho coperto le tue route esistenti (settings, conversations GET/PATCH, knowledge-base, onboarding, integrations) — sono tue per scelta di pattern.

**Cosa puoi fare con questo pacchetto:**

1. Adottarlo cosi' com'e' nei Client Components.
2. Estenderlo per le tue route con lo stesso pattern (schema Zod + factory che chiama `apiFetch`). ~80 righe per dominio.
3. Sostituirlo se preferisci server actions tipizzate o un pattern diverso. Costo di rimozione nullo: 5 file in `src/lib/api-client/`, 0 dipendenze esterne.
4. Wrappare le funzioni async in TanStack Query/SWR/Zustand/Jotai se vuoi caching/dedup.

## Stripe Dashboard - Cosa Resta Lato Founder

Prima del go-live billing serve completare lato Stripe Dashboard e poi popolare l'env del progetto. La parte codice e' pronta, ma non puo' funzionare senza queste configurazioni (le route gestiscono i casi env mancanti con `bad_request`/`internal`, quindi non rompono nulla nei deploy intermedi).

1. Creare in Stripe Dashboard:
   - Prodotto "Ambrogio Starter" con price recurring monthly EUR.
   - Prodotto "Ambrogio Professional" con price recurring monthly EUR.
   - (Agency NON serve in self-checkout, gestione manuale come da regola beta).
2. Configurare il **Customer Portal** in Stripe: features cancel subscription, payment method update, customer details. Il `return_url` viene preso da `STRIPE_BILLING_PORTAL_RETURN_URL`.
3. Registrare il webhook endpoint Stripe su `<base-url>/api/webhook/stripe` con eventi:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Popolare le env:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_PRICE_STARTER`
   - `STRIPE_PRICE_PROFESSIONAL`
   - `STRIPE_BILLING_PORTAL_RETURN_URL`
   - `STRIPE_CHECKOUT_SUCCESS_URL`
   - `STRIPE_CHECKOUT_CANCEL_URL`
5. Eventualmente Upstash per `STRIPE_BILLING_RATE_LIMIT_*` in produzione (fallback in-memory ok in dev).

## Cose Che Non Ho Fatto E Perche'

1. **Step 4 Security Review Mirata.** Lasciato a te: review service-role, RLS test tenant A/B con Supabase locale, gitleaks, runbook produzione. Decisioni operative + visione storica = territorio tuo.
2. **Frontend reale.** Tutti gli step backend sono backend-only. Il client API tipizzato e' pura plumbing — non costituisce "frontend" nel senso di ownership tua. I contratti API sono documentati in `docs/handoff/frontend-contract.md` per quando inizierai il frontend.
3. **FattureInCloud.** Campi `invoices.fattureincloud_invoice_id` e `sdi_status` esistono ma non integrati. Fuori scope MVP.
4. **Template manuale fuori finestra 24h.** Rimandato finche' i template reali non saranno approvati Meta/360dialog. Lo sblocco e' a tre livelli:
   - approvare 1-2 template `utility` lato 360dialog Hub o Meta;
   - estendere `OperatorMessagesService` con un metodo `sendTemplateMessage`;
   - estendere il body Zod e (in futuro) la UI inbox.
5. **Modifiche a `pricing.md`/copy/brand/naming**: nulla, come da regola.
6. **Refactor di moduli Codex** (whatsapp service, outbox, booking, AI, settings, conversations, knowledge-base, onboarding): nulla. Solo aggiunti argomenti DI **opzionali**, i tuoi test continuano a passare passando undefined.

## Pattern Rispettato

- Route sottile → service (DI) → repository (Supabase admin) → test con fake repository.
- AppError per errori applicativi, `jsonHandler` per envelope JSON consistente, `webhook_rejected` su signature invalida.
- Stripe SDK e config iniettate per testabilita'.
- Tutti i nuovi argomenti su moduli Codex sono **opzionali**: i tuoi test esistenti continuano a passare senza modifiche.
- Audit log su mutazioni utente-driven (checkout/portal, invio manuale operatore).
- Idempotency su tutto cio' che entra/esce da provider esterni (Stripe via `webhook_events`, manual outbound via `external_id` univoco).
- Documentazione e memoria aggiornate inline come "Fatto da Claude Code", come avevi chiesto.

## Suggerimenti Per Quando Riprendi

1. Quando il founder configura Stripe Dashboard, fare un test end-to-end con Stripe CLI (`stripe trigger`) per validare il webhook su tutti gli eventi gestiti.
2. Considerare di esporre nel dashboard i contatori `usage_metrics` con barra progresso usando `/api/usage/status`. Banner soft/hard con copy gia' in `frontend-contract.md`.
3. Se vuoi ampliare gli usage limits in modo graduale, `UsageLimitsConfig` e' iniettata: puoi sostituirla a runtime con valori per cliente (Agency multi-tier, Professional con bonus pack, ecc.) senza redeploy della logica.
4. Per Step 4 Security Review: la nuova superficie da auditare e' piccola. Sei nuovi service: `src/server/billing/stripe-billing.ts`, `src/server/usage/limits.ts`, `src/server/conversations/operator-messages.ts`. Sei nuove route: 4 billing + 1 usage + 1 messages. Una sola libreria di plumbing client (`src/lib/api-client/`). Tutte rispettano i pattern Codex pre-esistenti.

## Comandi Di Verifica Pre-Lavoro

Eseguire prima di toccare qualsiasi cosa:

```bash
npm run verify
npm run build
npm audit --audit-level=moderate
```

Se questi tornano verdi (come quando li ho lasciati io: 43 file test / 190 test, 34 route, 0 vulnerabilita'), il sistema e' nello stato consegnato.

## Saluto

Ti lascio l'ownership operativa ben pulita. La superficie aggiunta e' tracciata in modo che tu possa rivedere o riscrivere quello che non ti convince senza rompere niente. Nessun pezzo dei moduli che gestisci tu (whatsapp service, outbox, booking, AI, settings, inbox, knowledge-base, onboarding) e' stato modificato in modo non-opzionale.

Buon rientro.

— Claude Code
