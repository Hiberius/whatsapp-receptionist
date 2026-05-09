# Ambrogio.ai - Project Memory For Future Agents

Ultimo aggiornamento: 2026-04-27.  
Fatto da Codex.

Questo file e' la memoria consolidata per chiunque legga o continui il progetto: founder, Codex o altri agenti.

## Identita' del progetto

- Nome ufficiale: **Ambrogio.ai**.
- Dominio previsto: `ambrogio.ai`.
- Package: `ambrogio-ai`.
- Repo operativo: `[project-root]`.
- Prodotto: AI receptionist SaaS per studi professionali e PMI italiane, WhatsApp-first, con gestione conversazioni, appuntamenti, vocali e fallback umano.
- Target iniziale: dentisti, estetiste, veterinari, palestre/pilates, studi professionali.
- Direzione MVP: beta solida, non piano Agency completo subito.

## Ownership agenti

- Dal 2026-04-25 il founder ha assegnato a **Codex** il controllo operativo dell'intero progetto Ambrogio.ai.
- Dal 2026-04-27 il founder ha chiesto un takeover temporaneo a **Claude Code** mentre Codex si ferma; rientro Codex previsto il 1 maggio 2026.
- **Codex**: prodotto tecnico, backend, database, sicurezza, webhook, AI engine, billing, infrastruttura, test, frontend coordination, documentazione e memoria.
- Durante il takeover, Claude Code deve continuare a documentare ogni modifica come "Fatto da Claude Code" e aggiornare `docs/memory/agent-log.md`.
- I riferimenti a Codex o Codex frontend nei file storici sono handoff legacy o collaboratori opzionali, non ownership corrente, salvo nuova decisione esplicita del founder.
- Ogni modifica importante deve aggiornare `docs/memory/agent-log.md`.
- Ogni modifica deve indicare autore quando viene documentata, es. "Fatto da Codex".
- Le note per altri agenti restano utili come contesto, ma le decisioni operative passano da Codex.

## Regole brand

- Usare solo Ambrogio.ai / Ambrogio.
- Non reintrodurre vecchi nomi, vecchi domini, vecchi header o vecchi package.
- Ambrogio e' un assistente/receptionist digitale. Evitare formule innaturali come "il tuo ambrogio".
- Copy consigliato: "Ambrogio risponde", "la tua segreteria AI", "receptionist AI", "assistente WhatsApp".
- Non usare claim assoluti tipo "GDPR compliant" finche' legale/privacy non sono revisionati da avvocato. Preferire "DPA e privacy-first", "progettato con basi GDPR-first".

## Decisioni prodotto

- Trial MVP: **14 giorni gratis senza carta**.
- Non cambiare trial/billing/copy senza decisione esplicita del founder.
- Ambrogio deve dire chiaramente quando l'utente sta parlando con AI.
- Human escalation sempre prevista per casi delicati, emergenze, richieste fuori perimetro o dati sensibili.
- WhatsApp e vocali sono centrali:
  - inbound vocali WhatsApp trascritti;
  - outbound vocali opzionali per tenant;
  - vocali vietati o escalati in casi delicati/emergenze.

## Stack tecnico

- Next.js 15 App Router.
- TypeScript strict.
- Supabase Postgres/Auth/RLS.
- Zod per env e payload validation.
- Pino per logging con redaction.
- Anthropic:
  - primary: model ID Anthropic configurato via env;
  - fast/intent: model ID Anthropic configurato via env.
- ElevenLabs:
  - STT default: `scribe_v2`;
  - TTS default: `eleven_flash_v2_5`;
  - logging off di default: `ELEVENLABS_ENABLE_LOGGING=false`.
- 360dialog / WhatsApp Business per canale.
- Stripe per billing.
- Upstash Redis per rate limiting production quando configurato.

## Ambiente e comandi

- Il progetto richiede Node `>=22 <23`.
- L'ambiente locale osservato usava Node 20.18.0: npm puo' mostrare warning `EBADENGINE`. CI/deploy devono usare Node 22.
- Comandi principali:
  - `npm install`
  - `npm run typecheck`
  - `npm run test`
  - `npm run db:lint`
  - `npm run verify`
  - `npm run build`
  - `npm audit --audit-level=moderate`
- Non eseguire `npm run verify` in parallelo con `npm run build`: Next puo' riscrivere `.next/types` mentre TypeScript li legge.

## Backend stato attuale

File principali:

- `src/lib/env.ts`: parsing env con Zod.
- `src/lib/api/json.ts`: wrapper API con envelope JSON, request id, timing, error mapping.
- `src/lib/errors/app-error.ts`: errori applicativi tipizzati.
- `src/lib/http/request.ts`: request id, IP, user agent.
- `src/lib/logging/logger.ts`: logger Pino con redaction, silent in test.
- `src/lib/supabase/server.ts`: Supabase server client.
- `src/lib/supabase/admin.ts`: Supabase service role client server-only.
- `src/lib/auth/session.ts`: sessione multi-tenant da Supabase Auth app metadata.
- `src/lib/rate-limit/*`: rate limit Upstash se configurato, fallback in-memory.
- `src/lib/whatsapp/webhook-security.ts`: secret header e idempotency key.
- `src/server/whatsapp/webhook-events.ts`: estrazione eventi WhatsApp message/status/audio.
- `src/server/whatsapp/service.ts`: business logic webhook.
- `src/server/whatsapp/repository.ts`: accesso dati Supabase per webhook.
- `src/lib/elevenlabs/client.ts` e `src/lib/elevenlabs/audio.ts`: wrapper ElevenLabs.
- `src/server/calendar/google.ts`: provider Google Calendar per `freeBusy`, `events.insert`, `events.patch`, `events.delete` e refresh access token.
- `src/server/integrations/google-calendar-oauth.ts`: connect/callback/disconnect Google Calendar con state firmato.
- `src/server/integrations/credential-encryption.ts`: cifratura AES-256-GCM dei token provider in `integrations.credentials`.
- `src/server/appointments/booking.ts`: availability, creazione, reschedule/cancel appuntamento, sync Google Calendar e notifiche WhatsApp.
- `src/server/ai/booking-bridge.ts`: ponte WhatsApp AI -> booking, proposta slot e conferma slot scelto.
- `src/server/ai/booking-extractor.ts`: estrazione strutturata rule-based per servizio, data, fascia oraria, urgenza, nome e telefono.
- `src/server/ai/anthropic-adapter.ts`: adapter Anthropic Messages API provider-aware senza model ID hardcoded.
- `src/server/ai/llm-intent-classifier.ts`: classificatore intent LLM con fallback deterministico.
- `src/server/ai/domain-reply.ts`: generatore risposta domain-aware con JSON validato e fallback.
- `src/server/ai/context.ts`: context loader per ultimi messaggi, prompt attivo `ai_prompts` e knowledge base rilevante.
- `src/server/ai/costs.ts`: stima costi/token AI e prepara usage accounting.
- `src/server/ai/embeddings.ts`: client embeddings OpenAI opzionale per vector retrieval.
- `src/server/ai/llm.ts`: contratti LLM provider-neutral e parsing JSON.
- `src/server/settings/tenant-settings.ts`: API service/repository per profilo tenant, assistant, voice, booking config, servizi e business hours.
- `src/server/conversations/inbox.ts`: API service/repository per inbox conversazioni, messaggi e stato AI/handoff.
- `src/server/knowledge-base/documents.ts`: API service/repository per CRUD knowledge base con embeddings opzionali.
- `src/server/onboarding/tenant-onboarding.ts`: API service/repository per onboarding tenant, primo owner, seed iniziali e sync claim Supabase.
- `src/server/billing/stripe-billing.ts`: API service/repository Stripe billing (status, checkout lazy customer, portal, webhook idempotente con persistenza `invoices` e `billing_events`). Fatto da Claude Code il 27 aprile 2026.
- `src/lib/stripe/client.ts` e `src/lib/stripe/webhook-security.ts`: client SDK pinnato a `apiVersion=2026-02-25.clover` e wrapper `constructStripeEvent` per signature verification. Fatto da Claude Code il 27 aprile 2026.
- `src/server/usage/limits.ts`: usage limits per piano (conversazioni/mese, vocali/mese), soft warning a 80%, hard block auto-reply a 100%, integrato in `WhatsAppWebhookService`, `WhatsAppAutoReplyService` e `WhatsAppVoicePipelineWorker`. Fatto da Claude Code il 27 aprile 2026.
- `src/server/conversations/operator-messages.ts`: invio manuale operatore (owner/admin) WhatsApp con check opt-out, finestra 24h, audit log e enqueue outbox. Fatto da Claude Code il 27 aprile 2026.
- `src/lib/api-client/`: client TypeScript browser-side tipizzato per le route Claude Code (billing, usage, manual messages). Schemi Zod + `apiFetch` con validazione envelope. Zero UI, zero copy. Codex puo' estenderlo o sostituirlo. Fatto da Claude Code il 27 aprile 2026.

Webhook WhatsApp attuale:

1. GET verifica `hub.challenge` con `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
2. POST verifica header secret custom.
3. Applica rate limit per IP.
4. Valida payload WhatsApp con Zod.
5. Estrae eventi message/status/audio.
6. Registra `webhook_events` con idempotency key.
7. Risolve tenant da `integrations.external_account_id = phone_number_id`, fallback su `integrations.config.phone_number_id`.
8. Crea/aggiorna conversazione.
9. Inserisce messaggio inbound idempotente.
10. Incrementa usage mensile.
11. Aggiorna status outbound quando arrivano status webhook.
12. Tenant non risolto: registra fallimento e risponde 200 al provider.
13. Errore transitorio: risponde 502 per consentire retry provider; eventi failed/stale sono riapribili.

Booking/calendar attuale:

1. `AppointmentBookingService.getAvailableSlots()` legge servizio, business hours, tenant config e busy intervals.
2. Gli slot rispettano lead time, step, buffer e max giorni avanti.
3. Se integration Google Calendar e' attiva, usa `freeBusy` per escludere busy esterni.
4. `AppointmentBookingService.createAppointment()` ricontrolla lo slot, inserisce appointment, crea evento Google e accoda conferma WhatsApp.
5. `AppointmentBookingService.rescheduleAppointment()` ricontrolla availability, esclude lo slot originale, aggiorna evento Google oppure crea quello mancante, e accoda nuova conferma WhatsApp scoped.
6. `AppointmentBookingService.cancelAppointment()` cancella evento Google, marca appointment `cancelled` e accoda notifica WhatsApp.
7. Il DB ha constraint `appointments_no_confirmed_overlap` per impedire doppie prenotazioni confirmed nello stesso tenant.
8. `BookingBridgeService` salva slot proposti in `conversations.metadata.ambrogioBooking` e conferma risposte tipo "confermo 1".
9. `BookingBridgeService` gestisce anche `reschedule_request` e `cancellation_request` via WhatsApp:
   - cerca appuntamenti futuri dal numero cliente;
   - filtra il lookup con indizi naturali come giorno, orario/fascia, servizio e nome cliente;
   - chiede quale appuntamento scegliere se ne trova piu di uno;
   - chiede nuova data/fascia se serve;
   - propone nuovi slot e conferma reschedule;
   - cancella appuntamenti e accoda notifica di disdetta.
10. L'estrattore booking interpreta richieste come "domani pomeriggio" e "giovedi dopo le 18", restringendo availability e filtrando gli slot proposti.
11. Fatto da Codex il 26 aprile 2026: l'estrattore e il bridge coprono anche frasi sorgente + target come "sposta la visita di Mario a venerdi mattina" e "sposta quello di domani a venerdi mattina", separando il lookup dell'appuntamento esistente dalla nuova preferenza.
12. Google Calendar OAuth e' disponibile per owner/admin tenant:
   - `GET /api/integrations/google-calendar/connect`;
   - `GET /api/integrations/google-calendar/callback`;
   - `POST /api/integrations/google-calendar/disconnect`.
13. `GET /api/integrations/google-calendar/status` restituisce solo stato safe per dashboard, senza token.
14. I token Google Calendar sono cifrati; il refresh access token viene persistito in modo cifrato.
15. Route interne protette:
   - `POST /api/internal/booking/availability`;
   - `POST /api/internal/booking/appointments`;
   - `PATCH /api/internal/booking/appointments`;
   - `DELETE /api/internal/booking/appointments`.
16. Fatto da Codex il 26 aprile 2026: il webhook persiste opt-out WhatsApp da keyword inbound (`STOP`, `unsubscribe`, `rimuovimi`, `cancellami`, "non scrivetemi") e non confonde "annulla appuntamento" con opt-out.
17. Fatto da Codex il 26 aprile 2026: keyword opt-out accoda conferma service idempotente, separata dall'auto-reply.
18. Fatto da Codex il 26 aprile 2026: `GET`/`DELETE /api/whatsapp/opt-outs?customerIdentifier=<numero>` consente a owner/admin di consultare e revocare opt-out WhatsApp in modo tenant-scoped e idempotente.
19. Fatto da Codex il 26 aprile 2026: ogni revoca opt-out WhatsApp scrive `audit_log` con utente, IP, user agent, esito idempotente e stato precedente.

Settings/inbox/knowledge attuale:

1. Fatto da Codex il 26 aprile 2026: `GET/PATCH /api/settings/tenant` espone snapshot tenant e aggiornamento owner/admin di profilo, assistant, voice, auto-reply e booking guardrail.
2. Fatto da Codex il 26 aprile 2026: `GET/POST /api/settings/services` e `PATCH/DELETE /api/settings/services/[serviceId]` gestiscono servizi tenant con archiviazione soft e audit log.
3. Fatto da Codex il 26 aprile 2026: `GET/PUT /api/settings/business-hours` legge e sostituisce orari di apertura, validando overlap e usando RPC service-role `replace_tenant_business_hours()`.
4. Fatto da Codex il 26 aprile 2026: `GET /api/conversations` e `GET/PATCH /api/conversations/[conversationId]` espongono inbox, dettaglio messaggi e aggiornamento stato/AI auditato.
5. Fatto da Codex il 26 aprile 2026: `GET/POST /api/knowledge-base` e `GET/PATCH/DELETE /api/knowledge-base/[documentId]` espongono CRUD knowledge base tenant-scoped con embeddings opzionali e audit log.
6. Fatto da Codex il 26 aprile 2026: `GET/POST /api/onboarding/tenant` espone stato/completamento onboarding, crea tenant trial 14 giorni senza carta, primo owner, config, servizio/orari seed e claim `app_metadata`.
7. Fatto da Claude Code il 27 aprile 2026: `GET /api/billing/status`, `POST /api/billing/checkout`, `POST /api/billing/portal` e `POST /api/webhook/stripe` espongono billing MVP. Self-checkout solo Starter/Professional, Agency manuale founder. Stripe Customer creato lazy, webhook idempotente via `webhook_events`, persistenza `invoices` + `billing_events`. Su `customer.subscription.deleted` il tenant torna a `plan='trial'` + `status='cancelled'`. Trial 14 giorni senza carta gestito esclusivamente in Supabase, NON in Stripe.
8. Fatto da Claude Code il 27 aprile 2026: `GET /api/usage/status` espone lo snapshot dei limiti per il dashboard. Tracking `usage_metrics.voice_messages_count` aggiunto. `WhatsAppWebhookService` registra "1 conversazione/mese" la prima volta che un customer scrive nel mese; `WhatsAppVoicePipelineWorker` incrementa `voice_messages_count` post-trascrizione; `WhatsAppAutoReplyService` blocca auto-reply con `skippedReason='usage_limit_reached'` quando piano esaurito. Soft warning a 80%, hard block a 100%. Limiti per piano: Trial 100/50, Starter 500/200, Professional 2000/500, Agency 2000/500 per-tenant.
9. Fatto da Claude Code il 27 aprile 2026: `POST /api/conversations/[conversationId]/messages` permette a owner/admin di inviare manualmente un messaggio WhatsApp da inbox. Vincoli: solo WhatsApp, opt-out rispettato, finestra 24h required (no template manuale fuori finestra in MVP), `messages.sender_type='human'`, externalId univoco `manual:{uuid}`, audit log `conversations.message.sent`. L'invio manuale NON conta verso usage limits.

AI context/costi attuale:

1. L'adapter Anthropic resta opzionale e provider-aware, senza model ID hardcoded.
2. `LlmIntentClassifier` e `LlmDomainReplyGenerator` allegano usage metadata con model, token e costo stimato.
3. `WhatsAppAutoReplyService` salva token/costo sull'inbound message e incrementa `usage_metrics.ai_cost_cents`.
4. `AiContextProvider` usa embeddings OpenAI opzionali a 1536 dimensioni e RPC `match_knowledge_base()` quando disponibili.
5. Se vector retrieval non trova o fallisce, Ambrogio torna al ranking lessicale senza bloccare la risposta.

## Database stato attuale

Migration principale:

- `supabase/migrations/202604240001_initial_backend_mvp.sql`
- `supabase/migrations/202604260002_tenant_settings_api.sql`
- `supabase/migrations/202604260003_tenant_onboarding.sql`

Tabelle con RLS:

- tenants
- users
- tenant_config
- services
- business_hours
- conversations
- messages
- appointments
- knowledge_base
- integrations
- opt_outs
- usage_metrics
- invoices
- ai_prompts
- voice_events
- webhook_events
- whatsapp_outbox_jobs
- whatsapp_message_templates
- whatsapp_voice_jobs
- audit_log
- billing_events

Punti DB importanti:

- RLS coperta su 21 tabelle.
- `current_tenant_id()` legge top-level claim e `app_metadata.tenant_id`.
- `current_tenant_role()` legge top-level claim e `app_metadata.role`.
- `increment_usage_metrics()` e' `security definer`, ma execute e' revocato a `public`, `anon`, `authenticated` e concesso solo a `service_role`.
- `integrations.external_account_id` permette piu' account/provider per tenant, utile per piu' numeri WhatsApp futuri.
- `integrations.credentials` deve contenere segreti provider cifrati; per Google Calendar usare `access_token_encrypted` e `refresh_token_encrypted`.
- `webhook_events` serve per idempotenza, audit e retry.
- `voice_events` serve per audit/costi STT/TTS.
- `messages.tokens_used` e `messages.cost_cents` salvano telemetria AI per analisi inbound.
- `usage_metrics.ai_cost_cents` viene incrementato separatamente dai messaggi inviati.
- `appointments_no_confirmed_overlap` usa GiST + `btree_gist` per bloccare overlap tra appuntamenti `confirmed` dello stesso tenant.
- `tenant_config.booking_*` controlla lead time, step slot, buffer e max days ahead.
- `knowledge_base.embedding vector(1536)` e RPC `match_knowledge_base()` abilitano retrieval vettoriale tenant-scoped via service role.
- `replace_tenant_business_hours()` sostituisce gli orari tenant via service role e viene usata dalle Settings API.
- `create_tenant_onboarding()` crea tenant, owner, config, servizi, business hours e audit log in transazione DB via service role.
- `audit_log` registra operazioni sensibili, incluse revoche consenso WhatsApp da owner/admin.

## Test e verifiche

Ultimo stato verificato da Codex:

- `npm run verify`: passato.
- `npm run build`: passato.
- `npm audit --audit-level=moderate`: passato con 0 vulnerabilita'.
- Scansione vecchio naming e riferimenti agent/tool non Codex: 0 occorrenze.
- Test: 36 file test, 136 test passati, RLS OK su 21 tabelle.

Test coprono:

- env default Anthropic.
- env default ElevenLabs.
- Anthropic adapter mockato senza chiamate reali.
- webhook idempotency key.
- rate limiter.
- WhatsApp event extraction.
- WhatsApp webhook service:
  - persistenza inbound;
  - duplicate event;
  - tenant non risolto;
  - payload senza eventi;
  - errore transitorio e retry provider.
- Google Calendar provider:
  - freeBusy;
  - events.insert;
  - events.patch per reschedule;
  - events.delete per cancellazione;
  - token cifrati;
  - refresh access token da refresh_token;
  - persistenza access token rinnovato.
- Google Calendar OAuth:
  - state firmato e scadenza;
  - callback code -> token;
  - credenziali cifrate;
  - disconnect e revoke token;
  - status endpoint senza segreti;
  - guard owner/admin.
- Booking service:
  - slot da business hours;
  - esclusione busy locali e Google;
  - creazione appointment;
  - reschedule appointment con slot originale escluso;
  - cancellazione appointment;
  - sync Google Calendar;
  - conferma WhatsApp;
  - notifica cancellazione WhatsApp;
  - fallimento sync marcato e senza conferma.
- AI booking bridge:
  - match servizio;
  - estrazione strutturata booking rule-based;
  - preferenze data/fascia oraria usate per availability;
  - filtro slot in base alla fascia richiesta;
  - richiesta chiarimento;
  - proposta slot;
  - conferma slot;
  - reschedule conversazionale;
  - cancellation conversazionale;
  - lookup appuntamenti da testo naturale;
  - eval fixtures booking extraction;
  - scadenza stato conversazione.
- E2E backend WhatsApp simulato:
  - inbound webhook;
  - inbound audio webhook;
  - voice job, storage e transcript STT fake;
  - opt-out senza outbound e senza mutation booking;
  - keyword opt-out persistita con conferma service;
  - audit revoca opt-out con utente, IP, user agent e stato precedente;
  - auto-reply;
  - proposta slot;
  - conferma booking;
  - reschedule;
  - cancellazione;
  - verifica outbox, appointment, usage e intent.
- AI engine:
  - adapter Anthropic Messages API;
  - intent classifier LLM;
  - cost tracking token/model/costo stimato;
  - fallback rule-based quando provider fallisce;
  - domain reply generator;
  - embeddings OpenAI opzionali;
  - eval fixtures intent core;
  - context loader conversazione;
  - prompt versioning tenant/global da `ai_prompts`;
  - knowledge base retrieval lexical safe;
  - knowledge base retrieval vettoriale con fallback lessicale;
  - bug fix priorita': domande prezzo/orari/handoff vincono sul booking generico.
- Tenant Settings API:
  - lettura snapshot tenant/config/servizi/orari;
  - update owner/admin con audit;
  - create/update/archive servizi;
  - replace business hours ordinato e anti-overlap.
- Conversation Inbox API:
  - lista conversazioni con filtri status/channel/limit;
  - dettaglio messaggi normalizzato;
  - update stato, AI enabled e customer name con audit;
  - member read-only.
- Knowledge Base API:
  - list/get documenti;
  - create/update/archive owner/admin;
  - embeddings opzionali;
  - audit log per mutazioni.
- Onboarding tenant:
  - stato onboarding per utente autenticato;
  - creazione tenant trial 14 giorni senza carta;
  - primo owner in `users`;
  - config iniziale, servizio seed e business hours seed;
  - sync claim `app_metadata.tenant_id` e `app_metadata.role`;
  - retry idempotente se la membership esiste gia'.

## Legal/GDPR stato attuale

Bozze create da Codex, non legal advice e da far revisionare:

- `05_LEGAL_GDPR/privacy_policy_template.md`
- `05_LEGAL_GDPR/terms_of_service.md`
- `05_LEGAL_GDPR/dpa_template.md`
- `05_LEGAL_GDPR/gdpr_checklist.md`
- `05_LEGAL_GDPR/cookie_policy_template.md`
- `05_LEGAL_GDPR/subprocessors.md`
- `05_LEGAL_GDPR/ropa_template.md`

Ricerca:

- `docs/research/2026-04-24-legal-gdpr-pricing-research.md`

Punti legali importanti:

- Ambrogio.ai e' Titolare per sito/account/billing/supporto.
- Ambrogio.ai e' Responsabile per conversazioni utenti finali dei Clienti.
- Clienti sanitari o dati particolari richiedono DPIA e configurazione provider/retention piu' severa.
- ElevenLabs DPA, data residency e zero retention vanno verificati prima di abilitare voice in produzione per clienti sensibili.
- Non vendere "GDPR compliant" come claim assoluto finche' non c'e' revisione legale.

## Pricing stato attuale

Fonte:

- `01_STRATEGIA/pricing.md`
- `pricing.md`

Raccomandazione Codex:

- Beta:
  - Starter 97 euro/mese solo early adopter;
  - Professional 247 euro/mese;
  - Agency 597 euro/mese solo beta limitata con massimo 3 clienti.
- Pubblico:
  - Starter 149 euro/mese + setup 197;
  - Professional 299 euro/mese + setup 297;
  - Agency 897 euro/mese con 5 clienti inclusi + 79 euro/cliente extra;
  - Enterprise da 1.500 euro/mese.

Scoperta importante:

- 360dialog applica canone per canale/numero. Non promettere costi WhatsApp/BSP/Meta inclusi senza fair use o pass-through.

## Frontend e design

Codex gestisce anche ownership e coordinamento frontend. Il contratto frontend resta valido come guida per route, copy, asset, legal pages e vincoli visuali.

Handoff:

- `docs/handoff/frontend-contract.md`

Asset generati da Codex:

- Cartella: `public/assets/site-images/ambrogio/`
- Manifest: `public/assets/site-images/ambrogio/manifest.json`
- Preview: `public/assets/site-images/ambrogio/contact-sheet.webp`
- SVG: `public/assets/site-images/ambrogio/svg/`
- PNG: `public/assets/site-images/ambrogio/png/`
- WebP: `public/assets/site-images/ambrogio/webp/`
- Generatore ripetibile: `scripts/generate-ambrogio-site-assets.mjs`

Route placeholder gia' presenti:

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/conversations`
- `/settings`

Legal pages da creare:

- `/privacy-policy`
- `/terms`
- `/cookie-policy`
- `/dpa`
- `/subprocessors`
- `/security`

## Review e documentazione tecnica

Review/create:

- `docs/reviews/2026-04-24-codex-backend-spec-review.md`
- `docs/reviews/2026-04-24-codex-mega-code-review.md`

Architettura:

- `docs/architecture/backend-foundation.md`
- `docs/architecture/voice-whatsapp-elevenlabs.md`
- `docs/architecture/whatsapp-templates-window.md`
- `docs/architecture/appointment-notifications.md`
- `docs/architecture/booking-calendar.md`

## Prossimi step consigliati per Codex

Priorita' alta:

1. Implementare Stripe billing:
   - trial 14 giorni senza carta;
   - checkout/portal;
   - webhook con signature verification;
   - invoice status.
2. Aggiungere usage limits:
   - messaggi;
   - vocali;
   - costo AI;
   - soglie warning/soft block per piano.
3. Rafforzare AI reply reale:
   - ampliare eval fixtures;
   - aggiungere adapter AI strutturato per booking/reschedule/cancel;
   - creare dashboard interna per costi AI e qualita' risposte.
4. Rafforzare booking conversazionale:
   - ampliare eval fixtures per frasi ambigue;
   - aggiungere test su lookup appointment per servizio + nome + giorno combinati.
5. Completare workflow template WhatsApp:
   - creare/approvare template reali in 360dialog Hub o API;
   - gestire webhook `template_message_update` se disponibile nel setup reale.
6. Test RLS tenant A/B con Supabase locale/test project.
7. Implementare TTS outbound ElevenLabs solo dopo template WhatsApp/finestra 24h e policy consenso/retention.

Priorita' media:

- Billing cost tracking per tenant:
  - AI tokens;
  - ElevenLabs usage;
  - WhatsApp fees;
  - BSP fixed allocation;
  - overage/fair use.
- GDPR export/delete endpoints.
- Audit log per azioni critiche.

## Prossimi step frontend/design consigliati per Codex

1. Costruire landing con asset in `public/assets/site-images/ambrogio/`.
2. Usare pricing pubblico 149/299/897 o beta 97/247 solo se indicato dal founder.
3. Non usare social proof finta. Usare "Stiamo aprendo i primi 20 studi pilota in Italia" finche' non ci sono metriche reali.
4. Aggiungere demo WhatsApp statica con 4 scenari, incluso vocale.
5. Aggiungere pagine legal/trust usando i documenti in `05_LEGAL_GDPR/`.
6. Mantenere route e contratti backend invariati.

## Rischi residui

- Serve Node 22 in CI/deploy.
- Serve test integrazione Supabase reale per RLS.
- Serve verifica provider WhatsApp effettivo: 360dialog header custom vs altre opzioni sicurezza.
- Serve revisione legale prima di pubblicare privacy/terms/DPA/cookie.
- Serve verifica DPA/data residency ElevenLabs per clienti sanitari prima di vendere a studi medici regolati.
- Serve non vendere Agency a prezzo vecchio con troppi clienti inclusi.

## File di partenza per chi arriva dopo

Leggere in questo ordine:

1. `docs/memory/project-memory.md`
2. `docs/memory/agent-log.md`
3. `README.md`
4. `docs/architecture/backend-foundation.md`
5. `docs/handoff/frontend-contract.md`
6. `01_STRATEGIA/pricing.md`
7. `05_LEGAL_GDPR/gdpr_checklist.md`
8. `docs/reviews/2026-04-24-codex-mega-code-review.md`

## Skill installate fuori repo

- `meeting-notes-and-actions`
  - installata da Codex il 25 aprile 2026 in `[local-codex-skills-dir]/meeting-notes-and-actions`;
  - sorgente: `ComposioHQ/awesome-codex-skills`, path `meeting-notes-and-actions`, branch `master`;
  - utile per meeting transcript, founder notes, decisioni e action item.
  - Riavviare Codex per caricarla nella lista skill disponibile.

## Ultima nota Codex

Il progetto ora ha una base vera: non e' ancora prodotto finito, ma il terreno backend, documentale e operativo e' abbastanza solido per proseguire sotto ownership Codex senza improvvisare. La prima slice WhatsApp AI auto-reply e' mockabile, spenta di default, accodata in outbox durabile e coperta da test. I vocali WhatsApp sono accodati in worker dedicato, salvati in storage, trascritti con ElevenLabs STT e passati allo stesso servizio auto-reply dei testi, con guardrail su transcript vuoto, confidence bassa e casi delicati; fatto da Codex il 26 aprile 2026, il percorso vocale e' anche coperto in E2E backend fino alla creazione appointment. L'outbox distingue ora text/free-form da template e blocca l'invio free-form fuori customer service window 24h, marcando `whatsapp_window_closed`; fatto da Codex, un batch misto fuori finestra blocca il free-form ma invia il template. Il webhook persiste opt-out da keyword inbound, accoda conferma service idempotente e non confonde cancellazioni appuntamento con opt-out; owner/admin possono consultare o revocare il consenso da `/api/whatsapp/opt-outs`, e ogni revoca viene auditata con utente, IP, user agent e stato precedente. Esistono anche le API settings/inbox/knowledge base per configurare tenant, servizi, orari, voice, auto-reply, conversazioni e contenuti risposta da dashboard. `WhatsAppTemplateMessageService`, `WhatsAppTemplateSyncService`, `AppointmentNotificationService`, `AppointmentBookingService` e `BookingBridgeService` coprono template, reminder, availability, creazione/reschedule/cancel e booking conversazionale. Fatto da Codex il 26 aprile 2026: il bridge filtra anche appuntamenti esistenti quando il cliente cita "quello di domani", "quello delle 15" o "la visita di Mario", e gestisce casi sorgente + target come "sposta la visita di Mario a venerdi mattina" e "sposta quello di domani a venerdi mattina". Le prossime modifiche devono mantenere il pattern route sottile -> service -> repository -> test.
