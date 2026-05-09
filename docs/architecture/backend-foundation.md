# Backend Foundation - Ambrogio.ai

Fatto da Codex il 24 aprile 2026 usando `backend-patterns`.
Aggiornato da Codex il 26 aprile 2026 con auto-reply WhatsApp, outbox durabile, vocali ElevenLabs collegati all'orchestrator, booking service con Google Calendar, OAuth Calendar, AI booking bridge, estrattore booking strutturato, AI adapter provider-aware, context/prompt/knowledge base retrieval, cost tracking AI, vector retrieval, reschedule/cancel calendar-aware, E2E backend WhatsApp testo+voce, lookup appuntamenti da testo naturale, eval fixture booking, audit consenso opt-out, Tenant Settings API, Conversation Inbox API, Knowledge Base CRUD e onboarding tenant.

## Obiettivo

Preparare una base backend solida, testabile e mantenibile da Codex prima di costruire AI engine reale, calendar booking e billing.

## Pattern adottati

### API boundary

- API routes Next.js restano sottili.
- `src/lib/api/json.ts` gestisce:
  - envelope `{ ok, data }` / `{ ok, error }`;
  - request id;
  - logging strutturato;
  - mapping errori applicativi;
  - header `x-request-id`.

### Error handling

- `src/lib/errors/app-error.ts` centralizza codici e status HTTP.
- Errori inattesi non espongono dettagli al client.
- Errori Zod diventano `bad_request`.

### Rate limiting

- `src/lib/rate-limit/*` usa Upstash Redis quando `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` sono configurati.
- In locale/test fa fallback su limiter in-memory.
- Il webhook WhatsApp applica rate limit per IP:
  - `WHATSAPP_WEBHOOK_RATE_LIMIT_MAX`
  - `WHATSAPP_WEBHOOK_RATE_LIMIT_WINDOW_MS`
- In produzione serverless Upstash e' obbligatorio per avere rate limit condiviso tra istanze.

### Service + repository

- `src/server/whatsapp/service.ts` contiene business logic.
- `src/server/whatsapp/repository.ts` contiene accesso dati Supabase.
- `src/server/whatsapp/webhook-events.ts` contiene parsing/event extraction provider-specific.
- `src/server/whatsapp/auto-reply.ts` contiene logica condivisa per auto-reply testuali e vocali.
- `src/server/ai/booking-bridge.ts` collega intent booking, slot proposti e conferma appuntamento.
- `src/server/ai/booking-extractor.ts` estrae servizio/data/fascia/urgenza/dati cliente da richieste booking comuni in italiano.
- `src/server/ai/anthropic-adapter.ts` isola chiamate Anthropic Messages API senza model ID hardcoded.
- `src/server/ai/llm-intent-classifier.ts` abilita intent routing via LLM con fallback rule-based.
- `src/server/ai/domain-reply.ts` abilita risposta domain-aware via LLM con output JSON validato.
- `src/server/ai/llm.ts` contiene contratti provider-neutral per completions e parsing JSON.
- `src/server/ai/costs.ts` stima token/costi per family model e alimenta usage metrics.
- `src/server/ai/embeddings.ts` crea embeddings OpenAI opzionali per retrieval vettoriale.
- `src/server/ai/context.ts` carica contesto conversazione, prompt attivo e knowledge base rilevante con vector retrieval e fallback lessicale.
- `src/server/appointments/booking.ts` contiene availability, creazione, reschedule/cancel appuntamento e sync calendar.
- `src/server/calendar/google.ts` isola freeBusy, event insert/update/delete Google Calendar.
- `src/server/integrations/google-calendar-oauth.ts` gestisce connect/callback/disconnect Google Calendar.
- `src/server/integrations/credential-encryption.ts` cifra segreti provider salvati in `integrations.credentials`.
- `src/server/settings/tenant-settings.ts` gestisce profilo tenant, configurazione assistant/voice/booking, servizi e business hours.
- `src/server/conversations/inbox.ts` espone inbox conversazioni e messaggi con aggiornamento stato/AI auditato.
- `src/server/knowledge-base/documents.ts` gestisce CRUD knowledge base con embeddings opzionali.
- `src/server/onboarding/tenant-onboarding.ts` crea tenant trial, primo owner, config iniziale, servizi/orari seed e claim Supabase.
- Le API routes non parlano direttamente con Supabase per la logica applicativa.

## Vertical slice implementato

Webhook WhatsApp:

1. verifica secret header;
2. rate limit;
3. valida payload Zod;
4. estrae eventi message/status;
5. registra `webhook_events` con idempotency key;
6. risolve tenant da `integrations.external_account_id = phone_number_id`;
7. crea/aggiorna conversazione;
8. inserisce messaggio inbound idempotente;
9. aggiorna metriche mensili con `increment_usage_metrics`;
10. aggiorna status outbound quando arrivano status webhook;
11. non crasha su tenant non risolto: registra fallimento e risponde al provider;
12. su errore transitorio dopo la registrazione, torna 502 cosi' il provider puo' ritentare; gli eventi `failed` vengono riaperti al retry.
13. classifica testo inbound con intent router mockabile;
14. prepara risposta AI deterministica con disclosure configurabile;
15. crea auto-reply solo se `AMBROGIO_AI_AUTOREPLY_ENABLED=true` e `tenant_config.auto_reply_enabled=true`;
16. rispetta opt-out prima di ogni auto-reply;
17. salva outbound idempotente con `external_id=auto-reply:{inbound_external_id}`;
18. collega gli status provider tramite `messages.provider_message_id`.
19. accoda outbound in `whatsapp_outbox_jobs`;
20. worker separato invia a 360dialog, completa il job o programma retry/dead-letter.
21. accoda vocali inbound in `whatsapp_voice_jobs`;
22. worker separato scarica media, salva storage, trascrive con ElevenLabs e aggiorna `messages`/`voice_events`.
23. passa i transcript vocali a `WhatsAppAutoReplyService`, riusando intent router, doppio gate, opt-out e outbox.
24. blocca auto-reply su transcript vuoto, bassa confidence STT, emergenze, richieste cliniche severe o legali.
25. applica policy WhatsApp 24h nel worker outbox: text/free-form solo dentro customer service window, template fuori finestra.
26. accoda template approvati con `WhatsAppTemplateMessageService` e sincronizza registry da 360dialog.
27. collega appuntamenti a template WhatsApp per conferme, promemoria 24h/1h e disdette tramite `AppointmentNotificationService`.
28. calcola slot prenotabili usando `services`, `business_hours`, appuntamenti locali e busy intervals Google Calendar.
29. crea appuntamenti con check disponibilita', vincolo DB anti-overlap e sync `events.insert` Google Calendar.
30. espone route interne protette per availability e create appointment.
31. quando l'intent WhatsApp e' `booking_request`, propone slot reali, salva stato conversazione e conferma slot scelti.
32. estrae preferenze booking strutturate come servizio, "domani pomeriggio", "giovedi dopo le 18", urgenza, nome e telefono prima di chiamare availability.
33. espone Google Calendar OAuth connect/callback/disconnect per owner/admin tenant, con state firmato, token cifrati e refresh persistito.
34. espone status Google Calendar safe per dashboard, senza mai restituire credenziali o token.
35. usa adapter Anthropic opzionale per intent/reply se env e model sono configurati, con fallback deterministico automatico.
36. esegue eval fixture sugli intent core e corregge priorita' fallback prezzo/orari/handoff prima del booking generico.
37. carica contesto AI da ultimi messaggi, prompt attivo `ai_prompts` e snippet `knowledge_base` rilevanti prima del domain reply.
38. stima costo AI da token input/output e family model, salva `messages.tokens_used`/`messages.cost_cents` e incrementa `usage_metrics.ai_cost_cents`.
39. usa embeddings OpenAI opzionali e RPC `match_knowledge_base()` per knowledge retrieval vettoriale tenant-scoped.
40. se vector retrieval fallisce o non trova risultati, torna al ranking lessicale senza bloccare l'auto-reply.
41. permette reschedule appuntamenti con ricontrollo disponibilita', esclusione dello slot originale, update evento Google Calendar e conferma WhatsApp scoped.
42. permette cancellazione appuntamenti con delete evento Google Calendar e notifica WhatsApp di disdetta.
43. collega `reschedule_request` e `cancellation_request` al ponte conversazionale WhatsApp.
44. cerca appuntamenti futuri dal numero WhatsApp, chiede selezione se ce ne sono piu di uno e poi chiama `rescheduleAppointment()` o `cancelAppointment()`.
45. filtra gli appuntamenti da testo naturale usando data/orario/fascia, servizio e nome cliente salvato sull'appuntamento.
46. copre frasi booking/reschedule/cancel con eval fixture deterministic, inclusi i casi sorgente + target "sposta la visita di Mario a venerdi mattina" e "sposta quello di domani a venerdi mattina".
47. copre in E2E il percorso WhatsApp vocale: webhook audio, voice job, STT, auto-reply, proposta slot e conferma appointment.
48. evita side effect booking quando il cliente e' opted-out o i gate auto-reply sono chiusi: l'intent viene analizzato, ma il bridge non muta stato e non accoda reply.
49. copre batch outbox fuori finestra 24h: text/free-form viene bloccato, template approvato nello stesso batch viene inviato.
50. persiste opt-out WhatsApp da keyword inbound (`STOP`, `unsubscribe`, `rimuovimi`, `cancellami`, "non scrivetemi") senza confonderle con cancellazioni appuntamento.
51. accoda conferma service opt-out idempotente dopo keyword opt-out, separata dall'auto-reply.
52. espone `GET`/`DELETE /api/whatsapp/opt-outs` per consultare e revocare opt-out WhatsApp da sessione owner/admin.
53. scrive `audit_log` per ogni revoca opt-out WhatsApp, includendo utente, IP, user agent, esito idempotente e stato precedente.
54. espone Tenant Settings API per profilo tenant, `tenant_config`, servizi e business hours da dashboard owner/admin.
55. espone Conversation Inbox API per lista conversazioni, dettaglio messaggi e aggiornamento stato/AI con audit log.
56. espone Knowledge Base API per documenti tenant-scoped, archiviazione soft, audit log ed embeddings OpenAI opzionali.
57. espone onboarding tenant authenticated-only: crea tenant trial 14 giorni, `users` owner, `tenant_config`, servizi/orari iniziali e sincronizza `app_metadata.tenant_id/role`.

## Schema DB aggiunto/rafforzato

- `integrations.external_account_id`: identificativo provider, per WhatsApp e' `phone_number_id`.
- `integrations.external_display_id`: identificativo leggibile, per WhatsApp puo' essere display number.
- `integrations.credentials`: per Google Calendar contiene token cifrati AES-256-GCM, non token in chiaro.
- `integrations.config`: per Google Calendar contiene `calendar_id`, scopes e metadati connect/disconnect non sensibili.
- `messages.metadata`: payload tecnico minimizzato.
- `messages.provider_message_id`: id provider per status webhook outbound.
- `messages.tokens_used` e `messages.cost_cents`: telemetria costo AI per analisi inbound/reply.
- `messages.updated_at`: necessario per aggiornamenti atomici da outbox/status.
- `tenant_config.auto_reply_enabled`: gate per tenant, spento di default.
- `tenant_config.assistant_name`: default `Ambrogio`.
- `tenant_config.booking_min_lead_minutes`, `booking_slot_step_minutes`, `booking_buffer_minutes`, `booking_max_days_ahead`: guardrail scheduling per tenant.
- `appointments.booking_source`, `calendar_provider`, `calendar_sync_status`, `calendar_sync_error`, `calendar_event_html_link`: audit e stato sync booking/calendar.
- `appointments.confirmation_queued_at`, `reminder_24h_queued_at`, `reminder_1h_queued_at`, `cancellation_queued_at`: marker idempotenti per notifiche appuntamento.
- `appointments_no_confirmed_overlap`: exclusion constraint GiST per impedire doppie prenotazioni confermate sovrapposte nello stesso tenant.
- `webhook_events`: idempotenza, audit e diagnostica webhook.
- `whatsapp_outbox_jobs`: coda durabile per invii WhatsApp.
- `whatsapp_message_templates`: registry tenant-scoped per template approvati/sincronizzati da 360dialog/Meta.
- `whatsapp_voice_jobs`: coda durabile per processing vocali WhatsApp inbound.
- `claim_whatsapp_outbox_jobs()`: claim atomico con `for update skip locked` e calcolo `customer_service_window_expires_at`.
- `claim_whatsapp_voice_jobs()`: claim atomico con `for update skip locked`.
- `complete_whatsapp_outbox_job()`: completa job e messaggio outbound in una transazione DB.
- `fail_whatsapp_outbox_job()`: programma retry o dead-letter in una transazione DB.
- `increment_usage_metrics()`: funzione SQL atomica per incrementare usage mensile.
- `match_knowledge_base()`: RPC tenant-scoped per pgvector similarity search, concessa solo a `service_role`.
- `replace_tenant_business_hours()`: RPC service-role per sostituire gli orari tenant in modo atomico.
- `create_tenant_onboarding()`: RPC service-role per creare tenant, owner, config, servizi, business hours e audit log in transazione DB.
- `audit_log`: traccia operazioni sensibili, incluse revoche consenso WhatsApp da dashboard/API owner/admin.
- RLS ora supporta claim Supabase in top-level e in `app_metadata`.
- `increment_usage_metrics()` revoca esecuzione a `anon/authenticated` e la concede solo a `service_role`.
- Le RPC outbox sono revocate a `anon/authenticated` e concesse solo a `service_role`.

## Test aggiunti

- Estrazione eventi WhatsApp: text, audio, status.
- Service WhatsApp:
  - persistenza idempotente;
  - duplicate event;
  - tenant non risolto;
  - payload senza eventi.
- AI intent/reply:
  - intenti receptionist comuni in italiano;
  - adapter Anthropic Messages API mockato;
  - classifier LLM JSON con fallback rule-based;
  - domain reply generator JSON con fallback deterministico;
  - stima costi AI da token/model family;
  - eval fixtures intent core;
  - context loader conversazione;
  - prompt attivo tenant/global da `ai_prompts`;
  - knowledge base retrieval lexical safe;
  - knowledge base retrieval vettoriale con embeddings opzionali e fallback lessicale;
  - disclosure AI quando abilitata;
  - auto-reply con doppio gate;
  - opt-out;
  - failure outbound senza retry del webhook inbound.
- Client 360dialog:
  - POST `/messages`;
  - header `D360-API-KEY`;
  - parsing `messages[0].id`;
  - errore provider mappato a `upstream_error`.
- Outbox WhatsApp:
  - claim job pronto;
  - invio text;
  - invio template;
  - blocco free-form fuori customer service window;
  - batch misto fuori finestra: free-form bloccato e template inviato;
  - retry su 429/5xx;
  - dead-letter su 4xx non retryable o max attempts;
  - payload invalido senza chiamare provider;
  - route interna protetta da secret.
- Template WhatsApp:
  - helper appointment confirmation/reminder/cancellation;
  - richiede template `approved` prima di accodare;
  - idempotenza su `template:{name}:{idempotencyKey}`;
  - sync template list da 360dialog;
  - normalizzazione status/categorie provider.
- Appointment notifications:
  - confirmation/reminder/cancellation via template approvati;
  - opt-out WhatsApp rispettato prima dell'accodamento;
  - marker `*_queued_at` per evitare loop reminder;
  - route interna `/api/internal/jobs/appointment-reminders`.
- Booking/calendar:
  - availability da business hours;
  - esclusione busy locali e Google Calendar;
  - creazione appuntamento;
  - sync Google Calendar;
  - OAuth state firmato;
  - status endpoint safe per dashboard settings;
  - token Google cifrati;
  - disconnect con revoke token;
  - refresh access token persistito;
  - fallimento calendar sync marcato su appointment;
  - conferma WhatsApp dopo booking;
  - reschedule appointment con `events.patch`;
  - cancellazione appointment con `events.delete`;
  - flow conversazionale WhatsApp per reschedule/cancel con stato in `conversations.metadata.ambrogioBooking`;
  - lookup appuntamenti con frasi naturali come "quello di domani", "quello delle 15" e "la visita di Mario";
  - eval fixture booking extraction per bloccare parsing di servizio, data, fascia, orario e nome cliente;
  - route interne `PATCH`/`DELETE /api/internal/booking/appointments`;
  - route interne `/api/internal/booking/availability` e `/api/internal/booking/appointments`.
- AI booking bridge:
  - match servizio da testo;
  - estrazione strutturata booking rule-based;
  - finestra availability derivata da data/fascia richiesta;
  - filtro slot per fascia oraria;
  - richiesta chiarimento servizio;
  - proposta 3 slot;
  - conferma con "confermo 1/2/3";
  - stato booking in `conversations.metadata.ambrogioBooking`;
  - gestione slot scaduti e conflitti.
- Voice pipeline WhatsApp:
  - webhook accoda audio;
  - client media 360dialog scarica metadata + bytes;
  - storage tenant-scoped su Supabase Storage;
  - worker STT ElevenLabs;
  - update transcript su `messages`;
  - `voice_events` pending/completed/failed;
  - retry/dead-letter;
  - transcript -> AI auto-reply handler;
  - riuso transcript su retry senza ripetere STT.
- Auto-reply condivisa:
  - clear voice transcript -> outbox;
  - bassa confidence STT -> handoff senza outbound.
- E2E backend WhatsApp simulato:
  - webhook inbound -> auto-reply -> booking bridge -> appointment -> reschedule -> cancellation;
  - webhook audio -> voice worker -> transcript -> auto-reply -> booking bridge -> appointment;
  - opted-out inbound -> intent analysis senza outbound e senza mutation stato booking;
  - keyword opt-out inbound -> upsert `opt_outs`, conferma service idempotente e nessuna auto-reply;
  - verifica outbox, usage metrics e intent analysis senza provider esterni.
- Opt-out management:
  - service tenant-scoped per status/revoke;
  - owner/admin required;
  - revoca idempotente;
  - audit log con IP, user agent, utente e stato precedente.
- Tenant settings:
  - lettura snapshot da sessione tenant;
  - update owner/admin per profilo, assistant, voice, auto-reply e booking guardrail;
  - CRUD servizi con archiviazione soft;
  - replace business hours con validazione overlap;
  - audit log per mutazioni.
- Conversation inbox:
  - lista conversazioni con filtri status/channel/cursor;
  - dettaglio messaggi normalizzato;
  - update status/AI/customer name owner/admin;
  - audit log per mutazioni.
- Knowledge base:
  - list/get documenti tenant-scoped;
  - create/update/archive owner/admin;
  - embeddings opzionali via OpenAI quando configurato;
  - audit log per mutazioni.
- Onboarding tenant:
  - `GET /api/onboarding/tenant` legge stato onboarding dell'utente autenticato;
  - `POST /api/onboarding/tenant` crea tenant trial 14 giorni senza carta;
  - seed default di config, servizio "Prima visita" e orari lunedi-venerdi 09:00-18:00;
  - claim Supabase `tenant_id` e `role` sincronizzati via service role;
  - retry idempotente se la membership esiste gia'.
- Rate limiter con fallback in-memory.
- SQL lint su RLS, `app_metadata`, revoca RPC sensibile e indici integration.

## Contratti per Codex

- Non mettere business logic direttamente nelle API routes.
- Aggiungere nuovi provider creando repository/service dedicati.
- Usare `AppError` per errori attesi.
- Per ogni nuovo endpoint:
  - Zod schema;
  - route sottile;
  - service testato;
  - repository isolata;
  - audit/rate limit se sensibile.
- Per Supabase:
  - nessuna service role key lato client;
  - RLS sempre abilitata;
  - test tenant A/B appena avremo ambiente Supabase test.

## Prossimi step backend consigliati

1. Implementare Stripe billing, trial senza carta, portal, webhooks e invoice status.
2. Aggiungere usage limits per messaggi, vocali e costo AI per piano.
3. Aggiungere invio manuale operatore dall'inbox rispettando opt-out e finestra WhatsApp 24h/template.
4. Migliorare l'estrazione booking/reschedule/cancel con adapter AI strutturato ed eval per frasi ambigue, mantenendo fallback rule-based.
5. Webhook `template_message_update` quando disponibile nel setup reale.
6. Test integrazione Supabase locale per RLS tenant isolation, onboarding RPC, RPC vector search, appointment lookup ed exclusion constraint anti-overlap.
7. TTS outbound ElevenLabs solo dopo policy consenso voce/retention e invio media entro finestra WhatsApp o template compatibile.

## Stripe Billing - Fatto da Claude Code 2026-04-27

MVP billing aggiunto durante il takeover temporaneo Claude Code:

- `src/lib/stripe/client.ts`: SDK client cached con `apiVersion=2026-02-25.clover` (allineato ai tipi pubblicati da `stripe@20.4.1`).
- `src/lib/stripe/webhook-security.ts`: `constructStripeEvent(rawBody, signature)` su `stripe.webhooks.constructEvent`, con mapping a `AppError('webhook_rejected')`.
- `src/lib/rate-limit/index.ts`: aggiunto `enforceStripeWebhookRateLimit` con stesso pattern WhatsApp (Upstash o fallback in-memory).
- `src/server/billing/stripe-billing.ts`: service + repository (`StripeBillingService`, `SupabaseStripeBillingRepository`, `StripeApiAdapter`).
- Route sottili:
  - `GET /api/billing/status` legge snapshot tenant e ritorna piano/stato/cancel/avail-plans;
  - `POST /api/billing/checkout` (owner/admin) crea Customer lazy + Checkout Session per `starter` o `professional`;
  - `POST /api/billing/portal` (owner/admin) crea Billing Portal Session se Customer esiste;
  - `POST /api/webhook/stripe` valida firma sul raw body, applica rate limit, idempotency via `webhook_events` con `createWebhookIdempotencyKey({ provider: 'stripe', externalId })`.
- Eventi gestiti dal webhook:
  - `checkout.session.completed` → salva `stripe_customer_id` se mancante e logga billing event;
  - `customer.subscription.created/updated` → aggiorna piano (derivato da `price.id`), `subscription_status`, `current_period_end`, `cancel_at_period_end`;
  - `customer.subscription.deleted` → riporta tenant a `plan='trial'` + `status='cancelled'` e azzera `stripe_subscription_id`;
  - `invoice.paid`/`invoice.payment_succeeded` → upsert `invoices` con `status='paid'`;
  - `invoice.payment_failed` → upsert `invoices` con `status='failed'`;
  - tipi non gestiti loggati come `unhandled:<type>` in `billing_events`.
- Vincoli rispettati:
  - trial 14 giorni senza carta NON modificato: Stripe non viene contattato durante l'onboarding;
  - self-checkout MVP espone solo `starter` e `professional`; Agency resta gestione manuale founder;
  - Customer Stripe creato lazy al primo checkout/portal;
  - tenant resolution dal webhook: prima `metadata.tenant_id`, poi `client_reference_id`, poi `stripe_customer_id`;
  - audit log su checkout/portal create.
- Migration: `supabase/migrations/202604270001_stripe_billing.sql` aggiunge `tenants.stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `current_period_end`, `cancel_at_period_end`, indici unici parziali e indici di lookup su `invoices`/`billing_events`. RLS su `invoices` e `billing_events` non toccate (gia' coperte dalla migration iniziale).
- Env validati in `src/lib/env.ts`: `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_BILLING_PORTAL_RETURN_URL`, `STRIPE_CHECKOUT_SUCCESS_URL`, `STRIPE_CHECKOUT_CANCEL_URL`, `STRIPE_BILLING_RATE_LIMIT_MAX`, `STRIPE_BILLING_RATE_LIMIT_WINDOW_MS`. Configurazione iniettata via `loadStripeBillingConfigFromEnv()` per testabilita'.
- Test:
  - `tests/server/billing/stripe-billing.test.ts`: `getStatus`, `createCheckoutSession`, `createPortalSession` (11 test).
  - `tests/server/billing/stripe-webhook.test.ts`: subscription created/updated/deleted, invoice paid/failed, idempotency, tenant resolution, unknown price, unhandled (10 test).

## Usage Limits - Fatto da Claude Code 2026-04-27

Step 2 dell'handoff Codex implementato durante il takeover Claude Code.

Modulo:

- `src/server/usage/limits.ts`: `UsageLimitsService` + `SupabaseUsageLimitsRepository` + `DEFAULT_USAGE_LIMITS_CONFIG` con limiti per piano allineati al pricing pubblico (`docs/architecture/...` e `01_STRATEGIA/pricing.md`):
  - Trial: 100 conversazioni/mese, 50 vocali/mese.
  - Starter: 500 conversazioni/mese, 200 vocali/mese.
  - Professional: 2.000 conversazioni/mese, 500 vocali/mese.
  - Agency: 2.000 conversazioni/mese per tenant, 500 vocali/mese (l'aggregazione multi-cliente Agency e' lato dashboard).
- Soft warning a >=80% di una qualunque metrica → `softWarning=true` nel snapshot, nessun blocco.
- Hard block AUTO-REPLY a 100% → l'auto-reply viene saltato (`skippedReason='usage_limit_reached'`). Webhook inbound, opt-out, voice ingest, booking conversazionale e human escalation restano operativi.

Tracking:

- Migration `supabase/migrations/202604270002_usage_limits.sql`:
  - aggiunge `usage_metrics.voice_messages_count` con default 0;
  - aggiorna `public.increment_usage_metrics(...)` con il sesto parametro `p_voice_messages_delta`;
  - revoca/grant execute aggiornati per la nuova firma;
  - indice `usage_metrics_tenant_month_idx`.
- `WhatsAppWebhookService.processInboundMessage`: dopo aver inserito un messaggio inbound idempotente, registra una "conversazione/mese" tramite `UsageLimitsService.registerInboundConversation()` solo se quel customer non ne ha gia' aperta una nel mese (`conversations.created_at` filtro mese).
- `WhatsAppVoicePipelineWorker.processJob`: dopo `markVoiceEventCompleted` chiama `UsageLimitsService.registerVoiceMessage()` per incrementare `voice_messages_count`. L'incremento e' tracking-only: errori non bloccano la pipeline.
- `WhatsAppAutoReplyService`: prima di `insertOutboundMessage` chiama `checkAutoReplyAllowed()`. Se `allowed=false` ritorna `skippedReason='usage_limit_reached'` senza accodare l'outbound. `requireVoiceQuota=true` quando `source='voice_transcript'`, cosi' i vocali vengono bloccati prima delle quote testuali se necessario.

API:

- `GET /api/usage/status` (owner/admin/member): ritorna lo snapshot per il dashboard (plan, conversations/voiceMessages used+limit+percent+exceeded+warning, autoReplyAllowed, blockReason, softWarning).

Pattern rispettato:

- `usageLimits` opzionale via DI sia su `WhatsAppAutoReplyService` sia su `WhatsAppWebhookService` sia su `WhatsAppVoicePipelineWorker`. I test esistenti (Codex) continuano a passare null e mantengono il comportamento pre-takeover.
- Service+repository in singolo file, factory `createUsageLimitsService()` legge il default config.
- Limiti per piano configurabili via `UsageLimitsConfig` (DI), per testabilita' e per future modifiche operative.

Test:

- `tests/server/usage/limits.test.ts` (10 test): snapshot trial, soft warning a 80%, hard block conversazioni, hard block voce, checkAutoReplyAllowed con e senza voiceQuota, registerInboundConversation idempotente nel mese, registerVoiceMessage.
- `tests/server/usage/auto-reply-guard.test.ts` (2 test): integrazione tra `WhatsAppAutoReplyService` e `UsageLimitsService` — outbound bloccato quando exceed, passa quando under-limit.

## Manual Operator Messaging - Fatto da Claude Code 2026-04-27

Step 3 dell'handoff Codex: l'operatore (owner/admin) puo' inviare un messaggio manuale dall'inbox. Diventa cruciale ora che l'auto-reply puo' essere bloccato per usage limit.

Modulo:

- `src/server/conversations/operator-messages.ts`: `OperatorMessagesService` + `SupabaseOperatorMessagesRepository`. Vincoli applicati upfront prima di accodare nell'outbox:
  - solo owner/admin del tenant possono inviare;
  - conversazione deve esistere ed essere tenant-scoped;
  - canale supportato in MVP: solo WhatsApp (Instagram/Web/SMS rifiutati con `bad_request`);
  - opt-out customer rifiutato con `forbidden` (no bypass);
  - free-form solo dentro la finestra 24h dall'ultimo messaggio del cliente; fuori finestra `conflict` con messaggio "send an approved template instead (not yet supported)";
  - lunghezza testo allineata a WhatsApp (max 4096 char), trim e non vuoto;
  - `external_id` generato server-side come `manual:{uuid}` per evitare doppi invii.
- Sender_type del messaggio: `'human'` (gia' previsto dal CHECK constraint su `messages.sender_type`).
- Outbox payload: `{ type: 'text', text: { body }, metadata: { source: 'manual_operator', operatorUserId, conversationId } }`. L'outbox worker rispetta gia' la finestra 24h e l'opt-out (vedi `claim_whatsapp_outbox_jobs` SQL e `outbox.ts`); il check upfront del service serve a fallire fast prima di sporcare la coda.

Route:

- `POST /api/conversations/[conversationId]/messages` (owner/admin): body `{ content: string }` (Zod strict, 1..4096). Risposta:
  ```json
  { "ok": true, "data": { "messageId", "externalId", "conversationId", "enqueuedJobId", "customerServiceWindowExpiresAt" } }
  ```

Audit:

- Ogni invio scrive `audit_log` con `action='conversations.message.sent'`, `resource_type='message'`, `resource_id=messageId`, IP, user agent, e metadata (conversation, externalId, senderType, channel, contentLength, windowExpiresAt).

Test:

- `tests/server/conversations/operator-messages.test.ts` (7 test): inserimento+enqueue+audit dentro finestra, member rifiutato, conversazione mancante, channel non WhatsApp, opt-out blocca senza accodare, finestra chiusa rifiutata, contenuto vuoto/whitespace.
