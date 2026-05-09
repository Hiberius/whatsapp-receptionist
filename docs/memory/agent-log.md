# Ambrogio.ai Agent Memory

## 2026-04-24 - Fatto da Codex

- Trasformata `[project-root]` in repo operativo indipendente con `git init`.
- Aggiunta base backend Next.js 15, TypeScript strict, env Zod, health route, test runner e controllo RLS.
- Corretti gli indirizzi di lavoro: frontend a Codex frontend; backend a Codex + Codex.
- Decisione registrata: trial MVP senza carta, coerente con billing e landing.
- Decisione registrata inizialmente sui model ID Anthropic, poi superseded il 25 aprile 2026 dalla documentazione Anthropic ufficiale.
- Suggerimento per Codex: prima implementare auth/RLS/webhook su una vertical slice minima; evitare piano Agency e white-label finche' il beta non funziona.
- Suggerimento per Codex frontend: mantenere i testi "senza carta" finche' il founder non decide esplicitamente una policy diversa.
- Verifica eseguita da Codex: `npm run verify` passato, `npm run build` passato, `npm audit --audit-level=moderate` passato con 0 vulnerabilita'.
- Nota operativa da Codex: l'ambiente locale sta usando Node 20.18.0, ma il progetto richiede Node 22 per allinearsi allo stack deciso; usare Node 22 in shell/CI.

## 2026-04-24 - Fatto da Codex

- Aggiunta base backend: logger redacted, errori tipizzati, wrapper JSON API, client Supabase server/admin, webhook WhatsApp MVP e schema Zod payload.
- Aggiunta base frontend neutra: route groups `(auth)` e `(dashboard)`, shell minimale, placeholder per login/register/dashboard/conversations/settings.
- Creato `docs/handoff/frontend-contract.md` per Codex frontend.
- Suggerimento per Codex: implementare subito persistenza webhook WhatsApp con idempotenza DB usando la migration gia' presente.
- Suggerimento per Codex frontend: sostituire solo markup/stili dei placeholder e lasciare invariati contratti route/lib backend.

## 2026-04-24 - Fatto da Codex

- Rename totale brand/progetto: Ambrogio.ai.
- Sostituiti tutti i riferimenti testuali, URL, email, package name, service name, bucket, webhook header e documentazione da vecchio nome a Ambrogio.
- Suggerimento per Codex: usare solo `ambrogio-ai`, `ambrogio.ai`, `app.ambrogio.ai`, `api.ambrogio.ai` nei prossimi task.
- Suggerimento per Codex frontend: aggiornare wordmark, handle social e copy visuale su Ambrogio.ai; non reintrodurre il vecchio naming.

## 2026-04-24 - Memoria consolidata - Fatto da Codex

- Stato progetto: repo operativo indipendente in `[project-root]`.
- Nome ufficiale: Ambrogio.ai. Dominio primario previsto: `ambrogio.ai`.
- Package app: `ambrogio-ai`.
- Ownership decisa:
  - Backend, database, sicurezza, webhook, AI engine e billing: Codex + Codex.
  - Frontend visuale, design system, componenti definitivi e copy visuale: Codex frontend.
- Policy MVP decisa: trial 14 giorni senza carta. Non cambiare copy o billing flow senza decisione esplicita del founder.
- Modelli AI default:
  - Conversazioni complesse: model ID Anthropic configurato via env.
  - Intent routing: model ID Anthropic configurato via env.
- Sicurezza webhook WhatsApp MVP:
  - Header custom: `x-ambrogio-webhook-secret`.
  - Env correlate: `WHATSAPP_WEBHOOK_HEADER_NAME`, `WHATSAPP_WEBHOOK_HEADER_SECRET`.
  - Non assumere HMAC provider-specific finche' non viene confermato sul setup reale.
- Backend base gia' creato:
  - Next.js 15 App Router, TypeScript strict, Zod env parsing.
  - Logger Pino con redaction.
  - `AppError` tipizzato.
  - Wrapper JSON per API routes.
  - Client Supabase server/admin.
  - Helper sessione tenant/role.
  - Endpoint `/api/health`.
  - Endpoint `/api/webhook/whatsapp` con validazione Zod payload e idempotency key.
- Database base gia' creato:
  - Migration `supabase/migrations/202604240001_initial_backend_mvp.sql`.
  - RLS coperta su 16 tabelle: tenants, users, tenant_config, services, business_hours, conversations, messages, appointments, knowledge_base, integrations, opt_outs, usage_metrics, invoices, ai_prompts, audit_log, billing_events.
  - Script controllo: `npm run db:lint`.
- Frontend base neutra gia' creata:
  - Route `/login`, `/register`, `/dashboard`, `/conversations`, `/settings`.
  - Shell minimale in `src/components/layout/AppShell.tsx`.
  - CSS base in `src/styles/globals.css`.
  - Documento handoff per Codex frontend: `docs/handoff/frontend-contract.md`.
- Documentazione/review create:
  - `README.md`.
  - `docs/reviews/2026-04-24-codex-backend-spec-review.md`.
  - `docs/handoff/frontend-contract.md`.
- Verifiche passate dopo rename:
  - `npm run verify`.
  - `npm run build`.
  - `npm audit --audit-level=moderate` con 0 vulnerabilita'.
  - Scansione case-insensitive del vecchio naming: 0 occorrenze nei file/cartelle controllati.
- Nota ambiente:
  - La shell locale ha mostrato Node `20.18.0`.
  - Il progetto richiede Node `>=22 <23`; usare Node 22 in CI e nelle prossime sessioni operative.
- Prossimi step consigliati per Codex:
  - Implementare persistenza reale webhook WhatsApp su Supabase con idempotenza DB.
  - Implementare auth multi-tenant Supabase e test RLS tenant A/B.
  - Aggiungere gestione opt-out e usage metrics nel flusso messaggi.
- Prossimi step consigliati per Codex frontend:
  - Sostituire placeholder visuali mantenendo route e contratti backend.
  - Usare solo Ambrogio.ai in wordmark, handle, CTA, legal links e meta title.

## 2026-04-24 - Fatto da Codex

- Integrata direzione sito per Codex frontend nei prompt landing e nel frontend handoff.
- Aggiunte sezioni landing richieste: demo WhatsApp interattiva, Prima/Dopo, verticali, Trust/GDPR, ROI calculator.
- Corretto linguaggio brand: Ambrogio e' assistente/receptionist digitale, non "il tuo ambrogio".
- Suggerimento per Codex frontend: evitare social proof finta e usare beta/pilota finche' non esistono metriche reali.

## 2026-04-24 - Fatto da Codex

- Installate skill globali per basi tecniche/design:
  - `emil-design-eng` da `emilkowalski/skill`.
  - `impeccable` da `pbakaus/impeccable`.
  - 9 skill da `Leonxlnx/taste-skill`: `industrial-brutalist-ui`, `gpt-taste`, `image-taste-frontend`, `minimalist-ui`, `full-output-enforcement`, `redesign-existing-projects`, `high-end-visual-design`, `stitch-design-taste`, `design-taste-frontend`.
- Tutte risultano installate in `~/.agents/skills` e symlinkate agli agenti supportati, inclusi Codex e Codex.
- Nota operativa: riavviare Codex/Codex se le skill non sono visibili nella sessione corrente.

## 2026-04-24 - Fatto da Codex

- Integrato ElevenLabs come capability globale per vocali WhatsApp.
- Aggiunta dipendenza `@elevenlabs/elevenlabs-js`.
- Aggiunte env:
  - `ELEVENLABS_API_KEY`
  - `ELEVENLABS_STT_MODEL=scribe_v2`
  - `ELEVENLABS_TTS_MODEL=eleven_flash_v2_5`
  - `ELEVENLABS_DEFAULT_VOICE_ID`
  - `ELEVENLABS_ENABLE_LOGGING=false`
- Aggiunto wrapper backend:
  - `src/lib/elevenlabs/client.ts`
  - `src/lib/elevenlabs/audio.ts`
- Aggiunto documento architettura: `docs/architecture/voice-whatsapp-elevenlabs.md`.
- Esteso schema DB/migration:
  - `tenant_config` ora supporta `voice_messages_enabled`, `voice_replies_enabled`, `elevenlabs_voice_id`, `elevenlabs_stt_model`, `elevenlabs_tts_model`.
  - `messages` ora supporta transcript e audio outbound: `transcript_text`, `transcript_language`, `audio_duration_secs`, `generated_audio_url`, `voice_id`, `voice_model_id`.
  - nuova tabella `voice_events` per audit/costi STT/TTS.
- Aggiornati prompt e docs globali: tech stack, env template, WhatsApp integration, AI engine, DB schema, dashboard, onboarding, landing, pricing, legal/GDPR, roadmap, launch checklist e deployment.
- Regola: Ambrogio deve capire vocali WhatsApp inbound; risposte vocali outbound sono opzionali per tenant e vietate per emergenze/casi delicati.
- Fonti ufficiali consultate: ElevenLabs API reference per TTS/STT e changelog SDK 2026.

## 2026-04-24 - Fatto da Codex

- Eseguita ricerca legal/GDPR/pricing aggiornata con fonti GDPR/EDPB/Garante/AI Act, Anthropic, ElevenLabs, 360dialog e benchmark competitor.
- Creato report ricerca: `docs/research/2026-04-24-legal-gdpr-pricing-research.md`.
- Riscritti come bozze operative:
  - `05_LEGAL_GDPR/privacy_policy_template.md`
  - `05_LEGAL_GDPR/terms_of_service.md`
  - `05_LEGAL_GDPR/dpa_template.md`
  - `05_LEGAL_GDPR/gdpr_checklist.md`
- Aggiunti:
  - `05_LEGAL_GDPR/cookie_policy_template.md`
  - `05_LEGAL_GDPR/subprocessors.md`
  - `05_LEGAL_GDPR/ropa_template.md`
- Aggiornata strategia prezzi in `01_STRATEGIA/pricing.md` e `pricing.md`.
- Decisione raccomandata da Codex: prezzi pubblici Starter 149 euro/mese, Professional 299 euro/mese, Agency 897 euro/mese con 5 clienti inclusi + 79 euro/cliente extra. Prezzi beta 97/247 solo per early adopter e con costi WhatsApp/BSP chiariti.
- Scoperta pricing critica: 360dialog applica canone per canale/numero; quindi i piani non devono promettere costi WhatsApp inclusi senza fair use/pass-through.
- Aggiornati handoff e GTM per Codex frontend: pagine legal da creare, evitare claim assoluti "GDPR compliant", usare "DPA e privacy-first" o copy equivalente.
- Suggerimento per Codex: implementare billing con cost tracking per tenant (`provider_costs`, `included_whatsapp_numbers`, `included_voice_minutes`, overage/fair use) prima di vendere Agency.
- Suggerimento per Codex frontend: landing pricing pubblico 149/299/897; indicare costi WhatsApp/provider secondo piano; aggiungere footer legal con Privacy, Terms, Cookie, DPA, Subprocessors, Security.

## 2026-04-24 - Fatto da Codex

- Generata libreria visuale per Codex frontend con 20 immagini originali Ambrogio.ai.
- Cartella asset: `public/assets/site-images/ambrogio/`.
- Formati generati per ogni asset: SVG sorgente, PNG 1600x1000, WebP 1600x1000.
- Aggiunti `manifest.json`, `README.md` e `contact-sheet.webp/png` per preview rapida.
- Aggiunto generatore ripetibile: `scripts/generate-ambrogio-site-assets.mjs`.
- Aggiornato `docs/handoff/frontend-contract.md` con percorsi e uso consigliato.
- Suggerimento per Codex frontend: usare WebP per hero e sezioni, SVG per illustrazioni inline modificabili, PNG per deck/export; mantenere gli alt text dal manifest.
- Suggerimento per Codex: se il sito usera' Next Image, puntare ai path `/assets/site-images/ambrogio/webp/...` e usare il manifest come fonte dati per componenti asset-driven.

## 2026-04-24 - Fatto da Codex

- Applicato skill `backend-patterns` per creare fondamenta backend piu' solide.
- Rafforzato API layer:
  - `src/lib/api/json.ts` ora passa context con request id, IP, timing e header `x-request-id`.
  - `src/lib/errors/app-error.ts` supporta `conflict`, `upstream_error` e Zod -> `bad_request`.
  - `src/lib/http/request.ts` centralizza request id, client IP e user agent.
- Aggiunto rate limiting bootstrap:
  - `src/lib/rate-limit/memory.ts`
  - `src/lib/rate-limit/index.ts`
  - env `WHATSAPP_WEBHOOK_RATE_LIMIT_MAX` e `WHATSAPP_WEBHOOK_RATE_LIMIT_WINDOW_MS`.
- Creato service layer WhatsApp:
  - `src/server/whatsapp/webhook-events.ts` estrae message/status/audio events.
  - `src/server/whatsapp/service.ts` gestisce business logic webhook.
  - `src/server/whatsapp/repository.ts` isola accesso Supabase.
- Webhook WhatsApp ora fa: verifica secret, rate limit, validazione Zod, idempotenza DB, tenant resolver, upsert conversation, insert message inbound, update usage metrics, status outbound update.
- Estesa migration Supabase:
  - `integrations.external_account_id` e `external_display_id` per tenant resolver robusto.
  - `messages.metadata`.
  - nuova tabella `webhook_events` con RLS.
  - funzione SQL `increment_usage_metrics`.
  - RLS coverage aggiornata a 18 tabelle.
- Aggiunti test:
  - event extraction WhatsApp.
  - service idempotente.
  - tenant non risolto senza crash verso provider.
  - rate limiter.
- Verifiche passate:
  - `npm run verify`: 6 file test, 8 test passati, RLS OK su 18 tabelle.
  - `npm run build`: passato.
  - scansione vecchio naming: 0 occorrenze.
- Suggerimento per Codex: prossimi backend step sono Upstash Redis limiter, sender WhatsApp con retry/backoff, download media audio -> ElevenLabs STT, e test integrazione Supabase locale per RLS tenant A/B.

## 2026-04-24 - Mega code review, bug fix e polish - Fatto da Codex

- Eseguita review approfondita backend e creato report: `docs/reviews/2026-04-24-codex-mega-code-review.md`.
- Fix P1 RLS: funzioni `current_tenant_id()` e `current_tenant_role()` ora leggono anche `app_metadata`, coerente con Supabase Auth e `requireSession()`.
- Fix P1 sicurezza RPC: `increment_usage_metrics()` revoca execute a `public`, `anon`, `authenticated` e concede solo a `service_role`.
- Fix P1 webhook retry: errori transitori dopo registrazione evento ora producono 502 per consentire retry provider; eventi `failed` o `received` stale vengono riaperti in modo controllato.
- Fix P2 rate limit: webhook usa Upstash Redis quando configurato, con fallback in-memory locale/test.
- Fix P2 supply chain: aggiunto override PostCSS `^8.5.10`; `npm audit --audit-level=moderate` ora passa con 0 vulnerabilita'.
- Fix P2 integrations: schema ora supporta piu' account provider per tenant tramite `external_account_id`, senza bloccare futuri numeri WhatsApp aggiuntivi.
- Polish logging: test silenziosi, redaction estesa a cookie/api_key/access_token/refresh_token.
- Lint migration rafforzato per controllare RLS, `app_metadata`, revoca RPC e indici integrations.
- Verifiche finali passate: `npm run verify`, `npm run build`, `npm audit --audit-level=moderate`, scansione vecchio naming 0 occorrenze.
- Nota per Codex: non eseguire `npm run verify` in parallelo con `npm run build` perche' Next puo' riscrivere `.next/types` mentre TypeScript li legge; in CI usarli in sequenza.

## 2026-04-24 - Memoria per futuri lettori - Fatto da Codex

- Creata memoria consolidata per chiunque continui il progetto: `docs/memory/project-memory.md`.
- Creato `AGENTS.md` alla root con istruzioni operative per Codex, Codex e Codex frontend.
- La memoria include: identita' prodotto, ownership agenti, regole brand, decisioni MVP, stack, comandi, stato backend, schema DB, test, legal/GDPR, pricing, frontend/design, review, rischi residui e prossimi step.
- Regola per tutti gli agenti futuri: leggere `docs/memory/project-memory.md` e `docs/memory/agent-log.md` prima di modificare codice o documentazione.

## 2026-04-25 - Plugin fullstack-dev-skills e piano operativo - Fatto da Codex

- Richiesta ricevuta: installare `fullstack-dev-skills@jeffallan` e proporre un piano d'azione backend.
- Tentativo `npx fullstack-dev-skills@jeffallan`: fallito perche' il pacchetto non esiste su npm.
- Individuata origine corretta: marketplace GitHub `jeffallan/fullstack-dev-skills`, plugin `fullstack-dev-skills` versione `0.4.12`.
- Aggiunto marketplace locale con `codex plugin marketplace add jeffallan/fullstack-dev-skills`.
- Percorso marketplace locale: `[local-codex-marketplace-dir]`.
- Nota operativa: la CLI Codex disponibile in questa sessione espone `codex plugin marketplace add`, ma non espone un sottocomando diretto `codex plugin install`; se il plugin non appare subito nella UI, usare lo slash command `/plugin install fullstack-dev-skills@jeffallan` o riavviare la sessione dopo l'aggiunta del marketplace.
- Skill del marketplace utili per Ambrogio.ai: `nextjs-developer`, `typescript-pro`, `api-designer`, `database-optimizer`, `postgres-pro`, `secure-code-guardian`, `test-master`, `fullstack-guardian`, `code-reviewer`.
- Suggerimento per Codex: usare queste skill come checklist di revisione, ma mantenere come fonti operative primarie la memoria progetto, i test esistenti e le regole backend gia' definite.
- Suggerimento per Codex frontend: il marketplace contiene competenze full-stack, ma il sito deve continuare a seguire il contratto frontend e la libreria visuale Ambrogio gia' preparata da Codex.

## 2026-04-25 - Prima slice backend AI auto-reply WhatsApp - Fatto da Codex

- Implementata prima slice backend dopo piano d'azione:
  - `src/server/ai/intent-router.ts`
  - `src/server/ai/reply-orchestrator.ts`
  - `src/server/whatsapp/client.ts`
  - aggiornati `src/server/whatsapp/service.ts` e `src/server/whatsapp/repository.ts`.
- Aggiunto gate globale `AMBROGIO_AI_AUTOREPLY_ENABLED=false` in env e `.env.example`.
- Aggiunto gate tenant `tenant_config.auto_reply_enabled=false` nella migration.
- Cambiato default `tenant_config.assistant_name` in `Ambrogio`.
- Aggiunto `messages.provider_message_id` e indice unico parziale per collegare status webhook provider ai messaggi outbound.
- Webhook inbound ora puo' classificare messaggi testuali con intent router deterministico e salvare `intent`/`confidence`.
- Auto-reply WhatsApp e' spenta di default e parte solo con doppio gate: env globale attivo + tenant attivo.
- Auto-reply rispetta `opt_outs` prima dell'invio.
- Client 360dialog implementato con endpoint ufficiale `POST /messages`, header `D360-API-KEY` e parsing `messages[0].id`.
- Se l'invio auto-reply fallisce, l'inbound resta accettato: il messaggio outbound viene marcato `failed` e il webhook provider non viene forzato a ritentare l'inbound.
- Aggiunti test per intent router, reply orchestrator, client 360dialog, auto-reply gated, opt-out e send failure.
- Verifiche passate:
  - `npm run verify`: 8 file test, 17 test passati, RLS OK su 18 tabelle.
  - `npm run build`: passato.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming: 0 occorrenze.
- Suggerimento per Codex: prossimo passo backend e' outbox durabile con retry/backoff/429/dead-letter, poi pipeline audio WhatsApp -> ElevenLabs STT.
- Suggerimento per Codex frontend: il backend puo' ora dimostrare una demo testuale AI WhatsApp; per il sito mostrare auto-reply come funzione beta controllata, non come promessa di autonomia completa senza supervisione.

## 2026-04-25 - Outbox WhatsApp durabile - Fatto da Codex

- Implementato outbox durabile per invii WhatsApp, separando webhook inbound da chiamate provider outbound.
- Aggiunta tabella `whatsapp_outbox_jobs` con status `pending`, `processing`, `retry`, `sent`, `failed`, `dead_letter`, tentativi, lock, next attempt e provider message id.
- Aggiunte RPC Supabase service-role only:
  - `claim_whatsapp_outbox_jobs()` con `for update skip locked`;
  - `complete_whatsapp_outbox_job()` per completare job e messaggio outbound insieme;
  - `fail_whatsapp_outbox_job()` per retry/dead-letter e aggiornamento messaggio.
- Aggiunto `messages.updated_at` e trigger `updated_at` anche per `messages`.
- Aggiornato webhook service: l'auto-reply ora crea messaggio outbound e accoda job, senza inviare direttamente a 360dialog.
- Aggiunti:
  - `src/server/whatsapp/outbox.ts`
  - `src/server/whatsapp/outbox-repository.ts`
  - `src/app/api/internal/jobs/whatsapp-outbox/route.ts`
  - `src/lib/security/static-secret.ts`.
- Route interna worker: `POST /api/internal/jobs/whatsapp-outbox`, protetta da `INTERNAL_JOB_SECRET` e header `INTERNAL_JOB_HEADER_NAME`.
- Aggiunte env:
  - `INTERNAL_JOB_SECRET`
  - `INTERNAL_JOB_HEADER_NAME`.
- Retry policy: retry su 429/5xx/upstream senza status, backoff esponenziale da 30s fino a 1h, dead-letter su 4xx non retryable o max attempts.
- Aggiunti test outbox per invio, retry, dead-letter, max attempts, payload invalido e secret statico.
- Verifiche passate:
  - `npm run verify`: 10 file test, 23 test passati, RLS OK su 19 tabelle.
  - `npm run build`: passato con route interna `/api/internal/jobs/whatsapp-outbox`.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming: 0 occorrenze.
- Suggerimento per Codex: prossimo backend step e' pipeline audio WhatsApp -> storage -> ElevenLabs STT -> `voice_events`, poi template messages/finestra 24h.
- Suggerimento per Codex frontend: il sito puo' raccontare "risposte automatiche affidabili con coda e retry", ma senza dettaglio tecnico visibile; mostrare invece affidabilita', supervisione e continuita' operativa.

## 2026-04-25 - Review findings hardening spec - Fatto da Codex

- Rieseguita correzione dei 4 finding riportati dal founder.
- Finding model IDs: verificata documentazione Anthropic aggiornata al 25 aprile 2026. I default hardcoded sono stati rimossi dal repo; i model ID Anthropic vanno configurati via env e ricontrollati su documentazione ufficiale prima del deploy.
- Aggiornati `src/lib/env.ts`, `.env.example`, `07_INFRASTRUCTURE/env_variables_template.md`, test env, prompt AI, roadmap, project context e memoria.
- Finding webhook WhatsApp: rimosse assunzioni HMAC obbligatorie per 360dialog; standard attuale e' header segreto custom 360dialog + idempotenza/replay protection + rate limit. HMAC/Meta signature resta opzionale solo se disponibile e confermata nel setup reale.
- Aggiornati prompt/checklist/security docs per evitare che Codex implementi HMAC inventato su 360dialog.
- Finding trial policy: confermato allineamento su trial 14 giorni senza carta in pricing, billing, landing/onboarding e memoria.
- Finding schema MVP: aggiornato `03_CODEX_BACKEND_PROMPTS/02_database_schema.md` con `auto_reply_enabled`, `provider_message_id`, `metadata`, `updated_at`, integrazioni multi-account, `whatsapp_outbox_jobs` e RPC outbox service-role only.
- Puliti riferimenti residui a "Nora" nei prompt AI/design, sostituendo con Ambrogio.
- Suggerimento per Codex: non reintrodurre model ID retired/deprecated; controllare Anthropic docs prima di ogni release importante.
- Suggerimento per Codex frontend: usare sempre "Ambrogio" nelle chat demo e mantenere "14 giorni gratis senza carta".

## 2026-04-25 - Pipeline vocali WhatsApp con ElevenLabs STT - Fatto da Codex

- Implementata pipeline asincrona per note vocali WhatsApp inbound.
- Webhook WhatsApp ora, quando riceve `message.type='audio'`, salva il messaggio inbound e accoda un job in `whatsapp_voice_jobs`.
- Aggiunta tabella `whatsapp_voice_jobs` con status `pending`, `processing`, `retry`, `completed`, `failed`, `dead_letter`, tentativi, lock e metadata media.
- Aggiunta RPC service-role only `claim_whatsapp_voice_jobs()` con `FOR UPDATE SKIP LOCKED`.
- Aggiunti env:
  - `SUPABASE_MEDIA_BUCKET=ambrogio-media`
  - `WHATSAPP_MEDIA_MAX_BYTES=26214400`
- Aggiunti moduli:
  - `src/server/whatsapp/media.ts`: download metadata/media da 360dialog con `D360-API-KEY`;
  - `src/server/storage/media-storage.ts`: upload Supabase Storage tenant-scoped;
  - `src/server/whatsapp/voice-repository.ts`: claim job, voice events, transcript update, retry/dead-letter;
  - `src/server/whatsapp/voice-pipeline.ts`: worker media -> storage -> ElevenLabs STT -> message transcript;
  - `src/app/api/internal/jobs/whatsapp-voice/route.ts`: route interna protetta da `INTERNAL_JOB_SECRET`.
- ElevenLabs STT usa wrapper esistente `transcribeVoiceMessage()` con modello default `scribe_v2`.
- Il transcript viene salvato su `messages.transcript_text`, `transcript_language`, `audio_duration_secs`, `media_urls` e `metadata`.
- `voice_events` traccia `pending`, `completed` e `failed` per audit STT.
- Retry policy vocali: retry su 429/5xx/upstream senza status, backoff esponenziale da 30s a 1h, dead-letter su errori non retryable o max attempts.
- Aggiunti test:
  - webhook audio -> enqueue voice job;
  - client media 360dialog metadata + download bytes;
  - limite dimensione media;
  - worker success download/storage/STT/transcript;
  - retry transient;
  - dead-letter su errore non retryable/max attempts.
- Verifiche passate:
  - `npm run verify`: 12 file test, 29 test passati, RLS OK su 20 tabelle.
  - `npm run build`: passato con route interna `/api/internal/jobs/whatsapp-voice`.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming: 0 occorrenze.
- Suggerimento per Codex: questo step e' stato completato nell'entry successiva; ora priorita' a template WhatsApp/finestra 24h e AI adapter reale.
- Suggerimento per Codex frontend: demo sito puo' mostrare "vocale ricevuto -> trascritto -> risposta" come flusso prodotto, evitando dettagli su provider e bucket.

## 2026-04-25 - Transcript vocali collegati ad AI auto-reply - Fatto da Codex

- Implementato `src/server/whatsapp/auto-reply.ts`, servizio condiviso per auto-reply da messaggi testuali e da transcript vocali.
- Il webhook testuale ora usa `WhatsAppAutoReplyService` invece di tenere logica duplicata in `WhatsAppWebhookService`.
- Il worker `src/server/whatsapp/voice-pipeline.ts` ora, dopo ElevenLabs STT, legge il contesto del messaggio audio e passa il transcript all'auto-reply handler.
- Aggiunto riuso transcript su retry: se `messages.transcript_text` esiste gia', il worker non riscarica media e non richiama ElevenLabs, ma tenta solo auto-reply e completamento job.
- Aggiunti guardrail auto-reply:
  - transcript vocale vuoto -> `human_handoff`, nessun outbound;
  - confidence STT sotto `AMBROGIO_VOICE_STT_MIN_CONFIDENCE` -> `human_handoff`, nessun outbound;
  - segnali di emergenza, clinici severi, sicurezza o legali -> `human_handoff`, nessun outbound.
- Aggiunta env `AMBROGIO_VOICE_STT_MIN_CONFIDENCE=0.55` in `src/lib/env.ts`, `.env.example` e template infrastruttura.
- Aggiornato `src/server/whatsapp/voice-repository.ts` con `getVoiceReplyContext()` per recuperare conversation, customer identifier, transcript e metadata necessari all'auto-reply.
- Aggiunti test:
  - `tests/server/whatsapp/auto-reply.test.ts`;
  - clear voice transcript -> outbox;
  - bassa confidence STT -> handoff senza outbound;
  - voice pipeline -> auto-reply handler;
  - retry con transcript esistente senza ripetere STT;
  - env threshold.
- Verifiche passate:
  - `npm run verify`: 13 file test, 34 test passati, RLS OK su 20 tabelle.
  - `npm run build`: passato con route interne `/api/internal/jobs/whatsapp-outbox` e `/api/internal/jobs/whatsapp-voice`.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming: 0 occorrenze.
- Suggerimento per Codex: prossimo backend step e' template WhatsApp/finestra 24h prima di abilitare auto-reply in produzione; poi Anthropic adapter reale con eval fixtures.
- Suggerimento per Codex frontend: puo' mostrare "messaggio vocale capito e trasformato in risposta" come demo, ma evitare promessa di intervento automatico su urgenze o casi delicati.

## 2026-04-25 - WhatsApp template payload + 24h window enforcement - Fatto da Codex

- Verificate le docs 360dialog aggiornate:
  - free-form messages solo dentro customer service window;
  - customer service window di 24 ore dall'ultimo messaggio cliente;
  - fuori finestra solo template approvati;
  - invio template tramite `POST /messages` con `type='template'`.
- Aggiornato `src/server/whatsapp/client.ts`:
  - `sendText()` continua a inviare free-form;
  - aggiunto `sendTemplate()` con payload template 360dialog.
- Aggiornato `src/server/whatsapp/outbox.ts`:
  - payload outbox ora supporta `type='text'` e `type='template'`;
  - i text/free-form vengono inviati solo se `customerServiceWindowExpiresAt > now`;
  - se finestra chiusa o non dimostrabile, job in `dead_letter` con `sendError.code='whatsapp_window_closed'`;
  - template permessi anche fuori finestra.
- Aggiornato `src/server/whatsapp/outbox-repository.ts`:
  - `ClaimedWhatsAppOutboxJob` include `customerServiceWindowExpiresAt`.
- Aggiornata migration Supabase:
  - `claim_whatsapp_outbox_jobs()` calcola `customer_service_window_expires_at = conversations.last_message_at + interval '24 hours'`;
  - aggiunta tabella `whatsapp_message_templates` per registry tenant-scoped dei template;
  - aggiunti indice, trigger updated_at, RLS e policy admin;
  - RLS lint ora copre 21 tabelle.
- Aggiunto doc architetturale `docs/architecture/whatsapp-templates-window.md`.
- Aggiunti test:
  - client template payload;
  - outbox invio template;
  - blocco text fuori finestra;
  - finestra mancante trattata come chiusa.
- Verifiche passate:
  - `npm run verify`: 13 file test, 38 test passati, RLS OK su 21 tabelle.
  - `npm run build`: passato.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming: 0 occorrenze.
- Suggerimento per Codex: prossimo step backend e' helper `enqueueTemplateMessage()` + template appointment confirmation/reminder/cancellation + sync stato template da 360dialog.
- Suggerimento per Codex frontend: nella demo sito si puo' dire che Ambrogio rispetta le regole WhatsApp e usa template approvati per promemoria/conferme fuori finestra, senza mostrare dettagli tecnici.

## 2026-04-25 - Helper e sync template WhatsApp - Fatto da Codex

- Implementato `src/server/whatsapp/templates.ts`.
- Aggiunto `WhatsAppTemplateMessageService.enqueueTemplateMessage()`:
  - supporta template MVP `appointment_confirmation`, `appointment_reminder_24h`, `appointment_reminder_1h`, `appointment_cancellation`;
  - valida variabili obbligatorie prima di toccare DB/outbox;
  - controlla `whatsapp_message_templates.status='approved'` per tenant/nome/lingua;
  - crea messaggio outbound idempotente con `external_id=template:{templateName}:{idempotencyKey}`;
  - accoda payload outbox `type='template'`;
  - incrementa usage mensile come gli altri outbound.
- Implementata repository Supabase `SupabaseWhatsAppTemplateMessageRepository`, riusando i metodi outbound esistenti per non duplicare il path di invio.
- Implementato `src/server/whatsapp/template-sync.ts`:
  - client `Dialog360WhatsAppTemplateClient` per `GET /v1/configs/templates`;
  - parser difensivo per risposte array, `data`, `templates`, `business_templates`, `message_templates`;
  - normalizzazione status provider verso `draft`, `pending`, `approved`, `rejected`, `paused`, `disabled`;
  - normalizzazione categorie `utility`, `marketing`, `authentication`;
  - upsert tenant-scoped in `whatsapp_message_templates`.
- Aggiunta route interna `POST /api/internal/jobs/whatsapp-template-sync`, protetta da `INTERNAL_JOB_SECRET`, con body `{ "tenantId": "<uuid>" }`.
- Aggiornati docs:
  - `docs/architecture/whatsapp-templates-window.md`;
  - `docs/architecture/backend-foundation.md`;
  - `03_CODEX_BACKEND_PROMPTS/04_whatsapp_integration.md`;
  - `docs/memory/project-memory.md`.
- Aggiunti test:
  - `tests/server/whatsapp/templates.test.ts`;
  - `tests/server/whatsapp/template-sync.test.ts`;
  - helper template approvato -> outbound + outbox;
  - variabile mancante -> `bad_request`;
  - template non approved -> no enqueue;
  - idempotenza duplicate outbound;
  - fetch endpoint 360dialog template list;
  - normalizzazione status/categorie provider.
- Verifiche passate:
  - `npm run verify`: 15 file test, 48 test passati, RLS OK su 21 tabelle.
  - `npm run build`: passato con route interna `/api/internal/jobs/whatsapp-template-sync`.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming: 0 occorrenze.
- Suggerimento per Codex: prossimo step e' collegare booking/calendar a `enqueueTemplateMessage()` per conferme e promemoria reali.
- Suggerimento per Codex frontend: puo' mostrare promemoria e conferme appuntamento come funzioni concrete, con copy "template approvati WhatsApp" solo in pagina trust/security se serve.

## 2026-04-25 - Skill meeting-notes-and-actions installata - Fatto da Codex

- Clonato `https://github.com/ComposioHQ/awesome-codex-skills.git` in `[local-skills-dir]`.
- Installata skill `meeting-notes-and-actions` in `[local-codex-skills-dir]/meeting-notes-and-actions`.
- Nota tecnica: il repo usa branch `master`, quindi il comando riuscito e' stato:
  - `python3 skill-installer/scripts/install-skill-from-github.py --repo ComposioHQ/awesome-codex-skills --path meeting-notes-and-actions --ref master --method download`
- La skill serve per trasformare trascrizioni/meeting notes in sintesi, decisioni, rischi e action item con owner.
- Serve riavviare Codex per vederla caricata nella lista skill della sessione.
- Suggerimento per Codex: usare `meeting-notes-and-actions` per riunioni founder, decision log, call con provider o handoff lunghi.

## 2026-04-25 - Notifiche appuntamento via template WhatsApp - Fatto da Codex

- Implementato `src/server/appointments/notifications.ts`.
- Aggiunto `AppointmentNotificationService`:
  - `enqueueNotification({ kind: 'confirmation' })` -> `appointment_confirmation`;
  - `enqueueNotification({ kind: 'reminder_24h' })` -> `appointment_reminder_24h`;
  - `enqueueNotification({ kind: 'reminder_1h' })` -> `appointment_reminder_1h`;
  - `enqueueNotification({ kind: 'cancellation' })` -> `appointment_cancellation`;
  - `processDueReminders()` per reminder 24h/1h.
- Aggiunta repository Supabase per leggere appointment, tenant timezone, studio name e opt-out WhatsApp.
- Aggiunti marker idempotenti in `appointments`:
  - `confirmation_queued_at`;
  - `reminder_24h_queued_at`;
  - `reminder_1h_queued_at`;
  - `cancellation_queued_at`.
- Aggiunto indice `appointments_reminder_due_idx`.
- Aggiunta route interna `POST /api/internal/jobs/appointment-reminders`, protetta da `INTERNAL_JOB_SECRET`.
- Guardrail:
  - reminder/conferma solo su appointment `confirmed`;
  - cancellation solo su appointment `cancelled`;
  - opt-out WhatsApp rispettato prima di accodare template;
  - errore se manca `conversation_id` o recipient;
  - duplicate outbound considerato gia' accodato per evitare loop reminder.
- Aggiornati docs:
  - `docs/architecture/appointment-notifications.md`;
  - `docs/architecture/backend-foundation.md`;
  - `docs/architecture/whatsapp-templates-window.md`;
  - `03_CODEX_BACKEND_PROMPTS/02_database_schema.md`;
  - `03_CODEX_BACKEND_PROMPTS/06_calendar_booking.md`;
  - `docs/memory/project-memory.md`.
- Aggiunti test `tests/server/appointments/notifications.test.ts`:
  - conferma via template;
  - due reminders 1h/24h;
  - opt-out;
  - duplicate outbound;
  - skip appointment cancellato per reminder;
  - cancellation notification.
- Verifiche passate:
  - `npm run verify`: 16 file test, 54 test passati, RLS OK su 21 tabelle.
  - `npm run build`: passato con route interna `/api/internal/jobs/appointment-reminders`.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming: 0 occorrenze.
- Suggerimento per Codex: prossimo step e' creare il vero booking service con disponibilita' servizi/orari, lock anti doppia prenotazione e Google Calendar provider; dopo insert appointment chiamare `AppointmentNotificationService`.
- Suggerimento frontend per Codex: puo' presentare conferme e promemoria appuntamento come gia' previsti nel backend, ma senza promettere calendar sync finche' Google Calendar non e' implementato.

## 2026-04-25 - Ownership operativa assegnata a Codex - Fatto da Codex

- Il founder ha assegnato a Codex il controllo operativo dell'intero progetto Ambrogio.ai.
- Aggiornati i documenti vivi:
  - `AGENTS.md`;
  - `README.md`;
  - `docs/memory/project-memory.md`;
  - `docs/architecture/backend-foundation.md`;
  - `docs/handoff/frontend-contract.md`.
- Nuova regola operativa: Codex e' owner di prodotto tecnico, backend, database, sicurezza, webhook, AI engine, billing, infrastruttura, test, frontend coordination, documentazione e memoria.
- I riferimenti a Codex o Codex frontend restano contesto storico/handoff opzionale, non ownership corrente, salvo nuova decisione esplicita del founder.
- Verifiche finali passate:
  - `npm run verify`: 16 file test, 54 test passati, RLS OK su 21 tabelle;
  - `npm run build`: passato, inclusa route `/api/internal/jobs/appointment-reminders`;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming: 0 occorrenze.
- Prossimo step consigliato da Codex: completare il booking service con servizi, business hours, disponibilita', lock anti doppia prenotazione e Google Calendar provider, poi collegarlo ad `AppointmentNotificationService`.

## 2026-04-25 - Booking service e Google Calendar foundation - Fatto da Codex

- Implementato `src/server/appointments/booking.ts`.
- Implementato `AppointmentBookingService`:
  - `getAvailableSlots()` calcola slot da `services`, `business_hours`, config tenant, busy locali e Google Calendar;
  - `createAppointment()` ricontrolla slot, inserisce appointment, sincronizza Google Calendar e accoda conferma WhatsApp.
- Implementato `src/server/calendar/google.ts`:
  - `freeBusy` per leggere intervalli occupati;
  - `events.insert` per creare eventi;
  - refresh access token da `refresh_token` se l'access token manca o risulta scaduto.
- Aggiunte route interne protette da `INTERNAL_JOB_SECRET`:
  - `POST /api/internal/booking/availability`;
  - `POST /api/internal/booking/appointments`.
- Rafforzata migrazione Supabase:
  - `tenant_config.booking_min_lead_minutes`;
  - `tenant_config.booking_slot_step_minutes`;
  - `tenant_config.booking_buffer_minutes`;
  - `tenant_config.booking_max_days_ahead`;
  - `appointments.booking_source`;
  - `appointments.calendar_provider`;
  - `appointments.calendar_sync_status`;
  - `appointments.calendar_sync_error`;
  - `appointments.calendar_event_html_link`;
  - extension `btree_gist`;
  - constraint `appointments_no_confirmed_overlap`;
  - index `appointments_tenant_status_scheduled_idx`.
- Aggiunte env Google:
  - `GOOGLE_OAUTH_CLIENT_ID`;
  - `GOOGLE_OAUTH_CLIENT_SECRET`;
  - `GOOGLE_OAUTH_TOKEN_URL`.
- Aggiornati docs:
  - `docs/architecture/booking-calendar.md`;
  - `docs/architecture/backend-foundation.md`;
  - `docs/architecture/appointment-notifications.md`;
  - `docs/handoff/frontend-contract.md`;
  - `docs/memory/project-memory.md`;
  - `03_CODEX_BACKEND_PROMPTS/02_database_schema.md`;
  - `03_CODEX_BACKEND_PROMPTS/06_calendar_booking.md`;
  - `07_INFRASTRUCTURE/env_variables_template.md`.
- Aggiunti test:
  - `tests/server/appointments/booking.test.ts`;
  - `tests/server/calendar/google.test.ts`;
  - env default Google OAuth token URL.
- Verifiche passate:
  - `npm run verify`: 18 file test, 63 test passati, RLS OK su 21 tabelle;
  - `npm run build`: passato con route `/api/internal/booking/availability` e `/api/internal/booking/appointments`;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming: 0 occorrenze.
- Prossimo step consigliato da Codex: implementare AI booking bridge, cioe' far usare all'orchestrator `getAvailableSlots()` per proporre slot e `createAppointment()` quando l'utente conferma.

## 2026-04-25 - AI booking bridge Codex-only - Fatto da Codex

- Ricevuta direttiva founder: procedere con ownership e attribuzione solo Codex, senza riferimenti operativi a strumenti/agent esterni.
- Rinominati handoff prompt:
  - `03_CODEX_BACKEND_PROMPTS/`;
  - `04_CODEX_FRONTEND_PROMPTS/`.
- Rinominato prompt AI engine:
  - `03_CODEX_BACKEND_PROMPTS/05_ai_engine_anthropic.md`.
- Env AI rinominati in modo provider-oriented:
  - `ANTHROPIC_MODEL_PRIMARY`;
  - `ANTHROPIC_MODEL_FAST`.
- Implementato `src/server/ai/booking-bridge.ts`.
- `BookingBridgeService` ora:
  - legge servizi attivi tenant;
  - chiede chiarimento se il servizio e' ambiguo;
  - propone slot reali da `AppointmentBookingService.getAvailableSlots()`;
  - salva stato in `conversations.metadata.ambrogioBooking`;
  - conferma slot con risposte tipo "confermo 1";
  - chiama `AppointmentBookingService.createAppointment()`;
  - gestisce stato scaduto e conflitti slot.
- `WhatsAppAutoReplyService` usa il bridge quando l'intent e' `booking_request`, mantenendo disclosure AI e gate auto-reply.
- `SupabaseWhatsAppWebhookRepository.upsertConversation()` preserva metadata conversazione esistenti, cosi' lo stato booking non viene sovrascritto a ogni inbound.
- Collegato il bridge anche alla voice pipeline: vocali trascritti possono proporre o confermare slot.
- Aggiunti test `tests/server/ai/booking-bridge.test.ts`.
- Verifiche finali passate:
  - `npm run verify`: 19 file test, 67 test passati, RLS OK su 21 tabelle;
  - `npm run build`: passato;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: aggiungere estrattore AI strutturato per preferenze tipo "giovedi pomeriggio", poi OAuth Google completo con token cifrati.

## 2026-04-25 - Estrattore booking strutturato - Fatto da Codex

- Implementato `src/server/ai/booking-extractor.ts`.
- Aggiunto `RuleBasedBookingRequestExtractor` per richieste booking comuni in italiano:
  - servizio richiesto;
  - date relative come oggi/domani/dopodomani;
  - giorni settimana;
  - preferenze mattina/pomeriggio/sera;
  - frasi tipo "dopo le 18", "prima delle 12", "alle 10";
  - urgenza, nome cliente e telefono.
- Integrato extractor in `src/server/ai/booking-bridge.ts`:
  - legge timezone tenant;
  - usa `serviceQuery` per selezionare il servizio;
  - restringe la finestra availability se data/fascia sono presenti;
  - overfetch a 20 slot quando serve filtrare per fascia;
  - salva la richiesta normalizzata in metadata booking.
- Aggiunta utility `filterSlotsByBookingRequest()` per tenere solo gli slot coerenti con la preferenza oraria.
- Aggiunti test:
  - `tests/server/ai/booking-extractor.test.ts`;
  - aggiornato `tests/server/ai/booking-bridge.test.ts` con preferenza "domani pomeriggio".
- Verifiche passate:
  - `npm run verify`: 20 file test, 72 test passati, RLS OK su 21 tabelle.
  - `npm run build`: passato con 17 pagine/route generate.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: Google Calendar OAuth completo con token cifrati e refresh persistito; subito dopo adapter AI/eval fixtures per migliorare l'estrazione oltre il fallback rule-based.

## 2026-04-25 - Google Calendar OAuth sicuro - Fatto da Codex

- Implementato `src/server/integrations/credential-encryption.ts`:
  - AES-256-GCM per segreti provider;
  - supporto lettura token cifrati e compatibilita' test con token in chiaro;
  - helper per credenziali Google Calendar.
- Implementato `src/server/integrations/oauth-state.ts`:
  - state OAuth firmato HMAC;
  - scadenza 10 minuti;
  - return URL relativo/sicuro.
- Implementato `src/server/integrations/google-calendar-oauth.ts`:
  - URL autorizzazione Google con `access_type=offline`, `prompt=consent` e scopes Calendar;
  - callback code -> token;
  - upsert integration Google Calendar tenant-scoped;
  - disconnect con revoke token;
  - guard owner/admin.
- Aggiunte route:
  - `GET /api/integrations/google-calendar/connect`;
  - `GET /api/integrations/google-calendar/callback`;
  - `POST /api/integrations/google-calendar/disconnect`.
- Aggiornato `src/server/calendar/google.ts`:
  - legge `access_token_encrypted` e `refresh_token_encrypted`;
  - persiste access token rinnovato tramite callback.
- Aggiornato `src/server/appointments/booking.ts` per salvare token refresh cifrati quando Google Calendar rinnova l'access token.
- Aggiunte env:
  - `GOOGLE_OAUTH_AUTH_URL`;
  - `GOOGLE_OAUTH_REVOKE_URL`;
  - `GOOGLE_OAUTH_STATE_SECRET`;
  - `GOOGLE_CALENDAR_REDIRECT_URI`;
  - `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY`.
- Aggiunti test:
  - `tests/server/integrations/credential-encryption.test.ts`;
  - `tests/server/integrations/google-calendar-oauth.test.ts`;
  - copertura aggiunta in `tests/server/calendar/google.test.ts`.
- Verifiche mirate passate:
  - `npm run typecheck`;
  - `npx vitest run tests/server/integrations/credential-encryption.test.ts tests/server/integrations/google-calendar-oauth.test.ts tests/server/calendar/google.test.ts tests/server/appointments/booking.test.ts tests/env.test.ts`: 5 file, 18 test passati.
- Verifiche finali passate:
  - `npm run verify`: 22 file test, 80 test passati, RLS OK su 21 tabelle.
  - `npm run build`: passato con 21 pagine/route generate.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: collegare la dashboard settings a connect/disconnect Google Calendar e mostrare stato integrazione.

## 2026-04-25 - Google Calendar settings status API - Fatto da Codex

- Implementato `GET /api/integrations/google-calendar/status`.
- Esteso `GoogleCalendarOAuthService.getStatus()` per restituire un contratto dashboard-safe:
  - `connected`;
  - `status`;
  - `calendarId`;
  - `externalDisplayId`;
  - `connectedAt`;
  - `disconnectedAt`;
  - `lastSyncAt`;
  - `updatedAt`;
  - `scopes`;
  - `canManage`;
  - `connectUrl`;
  - `disconnectUrl`.
- Il contratto non espone mai `credentials`, access token o refresh token.
- Aggiornato repository Supabase per leggere solo colonne necessarie a status e OAuth.
- Aggiunti test status per calendario connesso e membro senza permesso gestione.
- Aggiornato `docs/handoff/frontend-contract.md` con contratto JSON per il pannello settings.
- Verifiche mirate passate:
  - `npm run typecheck`;
  - `npx vitest run tests/server/integrations/google-calendar-oauth.test.ts`: 1 file, 5 test passati.
- Prossimo step consigliato da Codex: implementare UI settings Google Calendar oppure passare all'AI engine reale con adapter/eval.

## 2026-04-25 - AI engine provider-aware con eval e fallback - Fatto da Codex

- Implementato `src/server/ai/llm.ts` con contratti provider-neutral e parser JSON.
- Implementato `src/server/ai/anthropic-adapter.ts`:
  - chiamata HTTP a Anthropic Messages API;
  - header `anthropic-version`;
  - nessun model ID hardcoded;
  - model scelti da `ANTHROPIC_MODEL_FAST` e `ANTHROPIC_MODEL_PRIMARY` tramite factory.
- Implementato `src/server/ai/llm-intent-classifier.ts`:
  - classificazione JSON con Zod;
  - soglia confidence sotto 0.6 -> `other`;
  - `FallbackIntentClassifier` verso regole deterministicamente testate.
- Implementato `src/server/ai/domain-reply.ts`:
  - generatore risposta domain-aware con JSON validato;
  - metadata token/model per futuri cost tracking;
  - fallback automatico se provider o JSON fallisce.
- Aggiornato `ReplyOrchestrator`:
  - usa classifier/generator LLM solo quando env Anthropic e model sono configurati;
  - mantiene fallback rule-based sempre disponibile;
  - conserva disclosure AI lato sistema.
- Aggiunte eval fixtures in `tests/fixtures/ai/intent-evals.json`.
- Bug fix emerso da eval: domande prezzo/orari/handoff hanno priorita' sul booking generico, cosi "Quanto costa la prima visita?" non viene piu classificato come prenotazione.
- Aggiunti test:
  - `tests/server/ai/anthropic-adapter.test.ts`;
  - `tests/server/ai/llm-intent-classifier.test.ts`;
  - `tests/server/ai/intent-evals.test.ts`;
  - esteso `tests/server/ai/intent-router.test.ts`.
- Verifiche mirate passate:
  - `npm run typecheck`;
  - `npx vitest run tests/server/ai/anthropic-adapter.test.ts tests/server/ai/llm-intent-classifier.test.ts tests/server/ai/intent-router.test.ts tests/server/ai/intent-evals.test.ts tests/server/whatsapp/auto-reply.test.ts`: 5 file, 10 test passati.
- Verifiche finali passate:
  - `npm run verify`: 25 file test, 86 test passati, RLS OK su 21 tabelle.
  - `npm run build`: passato con 21 pagine/route generate.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: aggiungere context loader, active prompt da `ai_prompts` e knowledge base retrieval, poi cost tracking AI.

## 2026-04-25 - AI context, prompt versioning e knowledge retrieval - Fatto da Codex

- Implementato `src/server/ai/context.ts`.
- Aggiunto `AiContextProvider` con repository pattern:
  - carica ultimi messaggi conversazione da `messages`;
  - seleziona prompt attivo tenant-specific da `ai_prompts`;
  - fallback a prompt globale se non esiste prompt tenant;
  - recupera knowledge base attiva da `knowledge_base`;
  - ranking lexical safe per snippet rilevanti.
- Integrato context loader in `ReplyOrchestrator`:
  - passa `tenantId` e `conversationId` dall'auto-reply WhatsApp;
  - si attiva solo quando Supabase admin e' configurato;
  - se il context load fallisce, resta il fallback deterministico.
- Integrato context in `LlmDomainReplyGenerator`:
  - usa prompt attivo se presente;
  - inietta conversationContext e knowledgeBase nel payload LLM;
  - salva metadata safe `aiContext` senza contenuto completo.
- Aggiunti test:
  - `tests/server/ai/context.test.ts`;
  - `tests/server/ai/domain-reply.test.ts`.
- Verifiche mirate passate:
  - `npm run typecheck`;
  - `npx vitest run tests/server/ai/context.test.ts tests/server/ai/domain-reply.test.ts tests/server/ai/intent-router.test.ts tests/server/ai/anthropic-adapter.test.ts tests/server/ai/llm-intent-classifier.test.ts tests/server/ai/intent-evals.test.ts tests/server/whatsapp/auto-reply.test.ts`: 7 file, 12 test passati.
- Verifiche finali passate:
  - `npm run verify`: 27 file test, 88 test passati, RLS OK su 21 tabelle.
  - `npm run build`: passato con 21 pagine/route generate.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: cost tracking AI e usage metrics, poi embeddings/vector retrieval per knowledge base.

## 2026-04-25 - Cost tracking AI, vector retrieval, reschedule/cancel booking - Fatto da Codex

- Implementato `src/server/ai/costs.ts`:
  - stima costo da token input/output e family model;
  - produce metadata `aiUsage` per intent classifier e domain reply;
  - somma token/costi per reply plan.
- Integrato cost tracking in AI/WhatsApp:
  - `LlmIntentClassifier` allega usage metadata;
  - `LlmDomainReplyGenerator` salva model, token, costo stimato e stop reason in `metadata.aiEngine`;
  - `WhatsAppAutoReplyService` salva `tokensUsed`/`costCents` sull'inbound message;
  - `usage_metrics.ai_cost_cents` viene incrementato separatamente dal conteggio messaggi.
- Implementato `src/server/ai/embeddings.ts`:
  - client embeddings OpenAI opzionale;
  - richiesta esplicita di 1536 dimensioni, coerente con `knowledge_base.embedding vector(1536)`;
  - validazione response e errori `AppError`.
- Rafforzato `src/server/ai/context.ts`:
  - retrieval vettoriale con embeddings quando configurati;
  - fallback lessicale automatico su errore o assenza match;
  - metadata `knowledgeBaseRetrieval` per capire se la risposta ha usato vector, lexical o none.
- Aggiornata migration Supabase:
  - nuova RPC `match_knowledge_base(uuid, vector(1536), integer, double precision)`;
  - revoke a public/anon/authenticated;
  - grant solo a `service_role`;
  - lint RLS aggiornato.
- Implementato reschedule/cancel calendar-aware:
  - `AppointmentBookingService.rescheduleAppointment()`;
  - `AppointmentBookingService.cancelAppointment()`;
  - `GoogleCalendarProvider.updateEvent()`;
  - `GoogleCalendarProvider.cancelEvent()`;
  - `PATCH /api/internal/booking/appointments`;
  - `DELETE /api/internal/booking/appointments`;
  - reschedule esclude lo slot originale da busy intervals;
  - reschedule crea l'evento Google mancante se l'appuntamento era rimasto senza event id;
  - reschedule resetta marker reminder/conferma e invia conferma con scope idempotente;
  - cancellazione marca status `cancelled` e invia template cancellation.
- Aggiornata documentazione:
  - `docs/architecture/backend-foundation.md`;
  - `docs/architecture/booking-calendar.md`;
  - `docs/memory/project-memory.md`;
  - `docs/memory/agent-log.md`.
- Aggiunti/aggiornati test:
  - `tests/server/ai/costs.test.ts`;
  - `tests/server/ai/embeddings.test.ts`;
  - `tests/server/ai/context.test.ts`;
  - `tests/server/ai/llm-intent-classifier.test.ts`;
  - `tests/server/ai/domain-reply.test.ts`;
  - `tests/server/whatsapp/auto-reply.test.ts`;
  - `tests/server/whatsapp/webhook-service.test.ts`;
  - `tests/server/calendar/google.test.ts`;
  - `tests/server/appointments/booking.test.ts`;
  - `tests/server/appointments/notifications.test.ts`.
- Verifiche passate:
  - test mirati: 9 file, 33 test;
  - `npm run verify`: 29 file test, 104 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 21 pagine/route generate;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: collegare `reschedule_request` e `cancellation_request` al flusso conversazionale WhatsApp, poi iniziare billing Stripe con usage/cost dashboard.

## 2026-04-25 - WhatsApp reschedule/cancel conversation flow - Fatto da Codex

- Esteso `src/server/ai/booking-bridge.ts`:
  - `BookingBridgeInput` ora riceve l'intent classificato;
  - stato conversazionale `ambrogioBooking` esteso a selezione appuntamento, richiesta nuova data, slot reschedule e selezione cancellazione;
  - lookup appuntamenti futuri confermati da tenant + numero WhatsApp;
  - flow `reschedule_request`:
    - se trova piu appuntamenti chiede quale spostare;
    - se trova un solo appuntamento ma manca la nuova data/fascia, chiede quando spostarlo;
    - propone nuovi slot con `excludeAppointmentId`;
    - conferma con "confermo 1/2/3" e chiama `AppointmentBookingService.rescheduleAppointment()`;
  - flow `cancellation_request`:
    - se trova piu appuntamenti chiede quale annullare;
    - se trova un solo appuntamento chiama `AppointmentBookingService.cancelAppointment()`;
    - accoda notifica disdetta tramite il service appuntamenti.
- Aggiornato `src/server/whatsapp/auto-reply.ts`:
  - il ponte booking viene chiamato anche quando l'intent corrente non e' booking, cosi risposte brevi come "1" o "confermo 2" possono usare lo stato conversazionale salvato.
- Aggiornata documentazione:
  - `docs/architecture/backend-foundation.md`;
  - `docs/architecture/booking-calendar.md`;
  - `03_CODEX_BACKEND_PROMPTS/06_calendar_booking.md`;
  - `docs/memory/project-memory.md`;
  - `docs/memory/agent-log.md`.
- Aggiunti/aggiornati test in `tests/server/ai/booking-bridge.test.ts`:
  - richiesta nuova data per reschedule;
  - proposta slot reschedule;
  - conferma slot reschedule;
  - cancellazione diretta di appuntamento singolo;
  - selezione e cancellazione quando ci sono piu appuntamenti.
- Verifiche mirate passate:
  - `npm run typecheck`;
  - `npm test -- --run tests/server/ai/booking-bridge.test.ts tests/server/whatsapp/auto-reply.test.ts tests/server/appointments/booking.test.ts`: 3 file, 20 test passati.
- Verifica completa passata:
  - `npm run verify`: 29 file test, 104 test, RLS OK su 21 tabelle.
  - `npm run build`: passato con 21 pagine/route generate.
  - `npm audit --audit-level=moderate`: 0 vulnerabilita'.
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: aggiungere lookup piu intelligente per appuntamenti citati con giorno/orario; la suite E2E backend WhatsApp simulata e' stata completata nella sessione successiva.

## 2026-04-26 - E2E backend WhatsApp simulato - Fatto da Codex

- Aggiunta suite `tests/server/e2e/whatsapp-booking-flow.test.ts`.
- La suite attraversa il percorso backend completo senza provider esterni:
  - `WhatsAppWebhookService`;
  - `WhatsAppAutoReplyService`;
  - `ReplyOrchestrator`;
  - `BookingBridgeService`;
  - repository fake condiviso;
  - booking service fake con mutazione appuntamenti in memoria.
- Scenario coperto:
  - messaggio WhatsApp inbound per prenotare;
  - proposta slot;
  - conferma con "confermo 1";
  - creazione appuntamento;
  - richiesta di spostamento;
  - richiesta nuova fascia;
  - proposta nuovi slot;
  - conferma reschedule;
  - cancellazione appuntamento;
  - verifica outbox, appointment, usage metrics e intent analysis.
- Bug reale trovato e corretto:
  - il classificatore rule-based non riconosceva "annulla appuntamento";
  - aggiornata regola cancellation in `src/server/ai/intent-router.ts`;
  - aggiunta copertura in `tests/server/ai/intent-router.test.ts`.
- Verifiche mirate passate:
  - `npm run typecheck`;
  - `npm test -- --run tests/server/e2e/whatsapp-booking-flow.test.ts tests/server/ai/intent-router.test.ts`: 2 file, 4 test passati.
- Specifiche operative aggiornate da Codex:
  - `03_CODEX_BACKEND_PROMPTS/04_whatsapp_integration.md` ora distingue E2E in-memory fatto da test provider reale futuro;
  - `03_CODEX_BACKEND_PROMPTS/06_calendar_booking.md` marca booking/reschedule/cancel E2E backend come MVP fatto;
  - `03_CODEX_BACKEND_PROMPTS/05_ai_engine_anthropic.md` marca integration booking flow come MVP fatto.
- Verifica completa passata:
  - `npm run verify`: 30 file test, 105 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 21 pagine/route generate;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: completare lookup appuntamenti piu intelligente per frasi tipo "quello di domani", "quello delle 15", "la visita di Mario".

## 2026-04-26 - Lookup appuntamenti naturale - Fatto da Codex

- Migliorato `RuleBasedBookingRequestExtractor`:
  - riconosce orari formulati come "delle 15";
  - estrae nomi cliente in frasi come "la visita di Mario";
  - evita di trattare "domani" e parole di servizio come nomi cliente.
- Migliorato `BookingBridgeService`:
  - `CustomerAppointmentForBridge` e `PendingAppointmentReference` includono `customerName`;
  - repository Supabase legge `appointments.customer_name`;
  - il lookup appuntamenti filtra per data, fascia/orario, servizio e nome cliente;
  - nel reschedule, frasi come "sposta quello di domani" sono interpretate come ricerca dell'appuntamento sorgente e Ambrogio chiede poi la nuova data/fascia.
- Test aggiunti:
  - extractor per "quello delle 15", "visita di Mario" e "quello di domani";
  - bridge cancellation su orario;
  - bridge cancellation su nome cliente;
  - bridge reschedule con source-date lookup.
- Documentazione aggiornata:
  - `docs/architecture/booking-calendar.md`;
  - `docs/architecture/backend-foundation.md`;
  - `docs/memory/project-memory.md`;
  - `docs/memory/agent-log.md`.
- Verifica mirata passata:
  - `npm test -- --run tests/server/ai/booking-extractor.test.ts tests/server/ai/booking-bridge.test.ts tests/server/e2e/whatsapp-booking-flow.test.ts`: 3 file, 18 test passati.
- Bugfix di integrazione test fatto da Codex:
  - aggiornato il fake E2E WhatsApp per propagare `customerName` negli appointment in memoria.
- Verifica completa passata:
  - `npm run verify`: 30 file test, 109 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 21 pagine/route generate;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: aggiungere eval fixtures per frasi ambigue con sorgente e target nella stessa frase, per esempio "sposta la visita di Mario a venerdi mattina".

## 2026-04-26 - Eval booking e source/target reschedule - Fatto da Codex

- Aggiunta fixture suite `tests/fixtures/ai/booking-extraction-evals.json`.
- Aggiunto test `tests/server/ai/booking-extraction-evals.test.ts` per bloccare parsing rule-based di:
  - servizio;
  - data;
  - fascia/orario;
  - nome cliente;
  - caso sorgente + target.
- Corretto `RuleBasedBookingRequestExtractor`:
  - "Sposta la visita di Mario a venerdi mattina" ora estrae `customerName='Mario'` senza includere la preposizione del target;
  - il target "venerdi mattina" resta data/fascia richiesta.
- Corretto `BookingBridgeService`:
  - durante reschedule con sorgente + target, il lookup appuntamento usa nome/servizio per trovare l'appuntamento esistente;
  - la disponibilita' usa invece la data/fascia target originale.
- Test aggiunto:
  - reschedule di "Sposta la visita di Mario a venerdi mattina" trova l'appuntamento di Mario e propone slot venerdi mattina.
- Verifica mirata passata:
  - `npm test -- --run tests/server/ai/booking-extraction-evals.test.ts tests/server/ai/booking-extractor.test.ts tests/server/ai/booking-bridge.test.ts`: 3 file, 19 test passati.
- Verifica completa passata:
  - `npm run verify`: 31 file test, 111 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 21 pagine/route generate;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: estendere lo stesso modello a frasi con doppia data, per esempio "sposta quello di domani a venerdi mattina".

## 2026-04-26 - Reschedule con doppia data - Fatto da Codex

- Esteso `BookingBridgeService` con separazione lookup/target per frasi come "sposta quello di domani a venerdi mattina".
- Il bridge ora:
  - usa "domani" come filtro per trovare l'appuntamento sorgente;
  - usa "venerdi mattina" come target per availability;
  - salva stato `reschedule_slots_proposed` sull'appuntamento corretto.
- Aggiunto test in `tests/server/ai/booking-bridge.test.ts` per source date + target date.
- Documentazione aggiornata:
  - `docs/architecture/booking-calendar.md`;
  - `docs/architecture/backend-foundation.md`;
  - `docs/memory/project-memory.md`;
  - `docs/memory/agent-log.md`.
- Verifica mirata passata:
  - `npm test -- --run tests/server/ai/booking-bridge.test.ts tests/server/ai/booking-extraction-evals.test.ts`: 2 file, 15 test passati.
- Verifica completa passata:
  - `npm run verify`: 31 file test, 112 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 21 pagine/route generate;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: estendere E2E backend al voice transcript e ai casi opt-out/template fuori finestra 24h.

## 2026-04-26 - E2E WhatsApp voice booking - Fatto da Codex

- Estesa suite `tests/server/e2e/whatsapp-booking-flow.test.ts`.
- Nuovo percorso coperto senza provider esterni:
  - webhook audio WhatsApp;
  - enqueue voice job;
  - download media fake;
  - storage media fake;
  - transcript STT fake;
  - `WhatsAppVoicePipelineWorker`;
  - `WhatsAppAutoReplyService`;
  - `BookingBridgeService`;
  - conferma slot via messaggio testuale;
  - creazione appointment.
- Esteso repository in-memory E2E per implementare anche `WhatsAppVoiceRepository`.
- Documentazione aggiornata:
  - `docs/architecture/booking-calendar.md`;
  - `docs/architecture/backend-foundation.md`;
  - `docs/memory/project-memory.md`;
  - `docs/memory/agent-log.md`.
- Verifica mirata passata:
  - `npm test -- --run tests/server/e2e/whatsapp-booking-flow.test.ts`: 1 file, 2 test passati.
- Verifica completa passata:
  - `npm run verify`: 31 file test, 113 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 21 pagine/route generate;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: aggiungere E2E per opt-out e template fuori finestra 24h.

## 2026-04-26 - Opt-out e window policy hardening - Fatto da Codex

- Aggiornato `WhatsAppAutoReplyService`:
  - il booking bridge viene chiamato solo se global gate, tenant gate e opt-out permettono davvero una risposta;
  - l'intent inbound viene comunque analizzato;
  - clienti opted-out non ricevono outbound e non generano mutation dello stato booking conversazionale.
- Estesa suite `tests/server/e2e/whatsapp-booking-flow.test.ts`:
  - caso opted-out con booking request;
  - verifica nessun outbox, nessuna availability call, nessuno stato booking salvato.
- Estesa suite `tests/server/whatsapp/outbox.test.ts`:
  - batch misto fuori finestra 24h;
  - free-form text bloccato con `whatsapp_window_closed`;
  - template nello stesso batch inviato correttamente.
- Documentazione aggiornata:
  - `docs/architecture/booking-calendar.md`;
  - `docs/architecture/backend-foundation.md`;
  - `docs/architecture/whatsapp-templates-window.md`;
  - `docs/memory/project-memory.md`;
  - `docs/memory/agent-log.md`.
- Verifica mirata passata:
  - `npm test -- --run tests/server/e2e/whatsapp-booking-flow.test.ts tests/server/whatsapp/outbox.test.ts tests/server/whatsapp/auto-reply.test.ts`: 3 file, 15 test passati.
- Verifica completa passata:
  - `npm run verify`: 31 file test, 115 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 21 pagine/route generate;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: implementare persistenza opt-out da keyword inbound tipo "STOP" e aggiungere endpoint/route interna per gestire cancellazione consenso.

## 2026-04-26 - Persistenza opt-out inbound - Fatto da Codex

- Esteso `WhatsAppWebhookRepository` con `upsertCustomerOptOut()`.
- Implementata persistenza Supabase su `opt_outs` con `onConflict: tenant_id,channel,customer_identifier`.
- Aggiornato `WhatsAppWebhookService`:
  - riconosce keyword opt-out conservative (`STOP`, `unsubscribe`, `rimuovimi`, `cancellami`, `disiscrivimi`, "non scrivetemi", "non contattatemi", "basta messaggi");
  - salva opt-out con reason `keyword_stop`;
  - aggiorna analysis metadata `optOut`;
  - non chiama auto-reply dopo la persistenza;
  - non tratta "annulla appuntamento" come opt-out.
- Aggiornati fake repository nei test E2E/webhook.
- Test aggiunto:
  - `tests/server/whatsapp/webhook-service.test.ts` copre `STOP` persistito e "annulla appuntamento" classificato come cancellation.
- Documentazione aggiornata:
  - `docs/architecture/booking-calendar.md`;
  - `docs/architecture/backend-foundation.md`;
  - `docs/architecture/whatsapp-templates-window.md`;
  - `docs/memory/project-memory.md`;
  - `docs/memory/agent-log.md`.
- Verifica mirata passata:
  - `npm test -- --run tests/server/whatsapp/webhook-service.test.ts tests/server/e2e/whatsapp-booking-flow.test.ts tests/server/whatsapp/auto-reply.test.ts`: 3 file, 14 test passati.
- Verifica completa passata:
  - `npm run verify`: 31 file test, 116 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 21 pagine/route generate;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: aggiungere conferma service opt-out idempotente e un endpoint owner/admin per revocare o consultare il consenso.

## 2026-04-26 - Conferma opt-out e API consenso WhatsApp - Fatto da Codex

- Aggiornato `WhatsAppWebhookService`:
  - dopo keyword opt-out accoda una conferma service idempotente con `externalId=opt-out-confirmation:{inboundExternalId}`;
  - la conferma e' separata dall'auto-reply e non passa dal booking bridge.
- Aggiunto `src/server/whatsapp/opt-outs.ts`:
  - service tenant-scoped per stato/revoca opt-out WhatsApp;
  - repository Supabase su `opt_outs`;
  - guard owner/admin;
  - revoca idempotente.
- Aggiunta route authenticated:
  - `GET /api/whatsapp/opt-outs?customerIdentifier=<numero>`;
  - `DELETE /api/whatsapp/opt-outs?customerIdentifier=<numero>`.
- Aggiunti test:
  - `tests/server/whatsapp/opt-outs.test.ts`;
  - esteso `tests/server/whatsapp/webhook-service.test.ts` per conferma opt-out.
- Documentazione aggiornata:
  - `docs/architecture/booking-calendar.md`;
  - `docs/architecture/backend-foundation.md`;
  - `docs/architecture/whatsapp-templates-window.md`;
  - `docs/handoff/frontend-contract.md`;
  - `docs/memory/project-memory.md`;
  - `docs/memory/agent-log.md`.
- Verifica mirata passata:
  - `npm test -- --run tests/server/whatsapp/webhook-service.test.ts tests/server/whatsapp/opt-outs.test.ts tests/server/e2e/whatsapp-booking-flow.test.ts`: 3 file, 14 test passati.
- Verifica completa passata:
  - `npm run verify`: 32 file test, 119 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 22 pagine/route generate, inclusa `/api/whatsapp/opt-outs`;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: audit log esplicito per revoca consenso e pannello settings/inbox per gestione consenso WhatsApp.

## 2026-04-26 - Audit revoca opt-out WhatsApp - Fatto da Codex

- Aggiornato `WhatsAppOptOutService`:
  - prima della revoca legge lo stato opt-out esistente;
  - chiama la cancellazione idempotente su `opt_outs`;
  - scrive `audit_log` per ogni tentativo di revoca, anche quando l'opt-out era gia' assente;
  - metadata audit: canale, numero normalizzato, esito `revoked`, timestamp revoca, reason precedente e `optedOutAt` precedente.
- Aggiornata route:
  - `DELETE /api/whatsapp/opt-outs?customerIdentifier=<numero>` passa IP e user agent al service.
- Aggiornato repository Supabase:
  - insert in `audit_log` con tenant, user, action `whatsapp.opt_out.revoked`, resource type `opt_out`, resource id, IP, user agent e metadata.
- Aggiornati test:
  - `tests/server/whatsapp/opt-outs.test.ts` verifica audit log su revoca reale e revoca idempotente.
- Documentazione/memoria aggiornata:
  - `docs/architecture/booking-calendar.md`;
  - `docs/architecture/backend-foundation.md`;
  - `docs/architecture/whatsapp-templates-window.md`;
  - `docs/handoff/frontend-contract.md`;
  - `docs/memory/project-memory.md`;
  - `docs/memory/agent-log.md`.
- Verifica mirata passata:
  - `npm test -- --run tests/server/whatsapp/opt-outs.test.ts tests/server/whatsapp/webhook-service.test.ts`: 2 file, 11 test passati.
- Verifica completa passata:
  - `npm run verify`: typecheck, 32 file test, 119 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 22 pagine/route generate, inclusa `/api/whatsapp/opt-outs`;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: costruire il pannello settings/inbox per gestione consenso WhatsApp e stato Google Calendar usando le API gia' pronte.

## 2026-04-26 - Settings, inbox e knowledge base API - Fatto da Codex

- Aggiunto helper backend:
  - `src/lib/api/body.ts` per parsing JSON riusabile con `AppError`.
- Implementata Tenant Settings API:
  - `src/server/settings/tenant-settings.ts`;
  - `GET/PATCH /api/settings/tenant`;
  - `GET/POST /api/settings/services`;
  - `PATCH/DELETE /api/settings/services/[serviceId]`;
  - `GET/PUT /api/settings/business-hours`;
  - owner/admin richiesti per mutazioni;
  - audit log per update settings, servizi e orari;
  - validazione timezone, email, limiti booking, duplicati e overlap business hours.
- Aggiunta migrazione:
  - `supabase/migrations/202604260002_tenant_settings_api.sql`;
  - RPC `replace_tenant_business_hours(uuid, jsonb)` service-role only;
  - `scripts/check-rls-migration.mjs` ora legge tutte le migrazioni e controlla la nuova RPC.
- Implementata Conversation Inbox API:
  - `src/server/conversations/inbox.ts`;
  - `GET /api/conversations`;
  - `GET/PATCH /api/conversations/[conversationId]`;
  - lista conversazioni con filtri, dettaglio messaggi normalizzato, update status/AI/customer name owner/admin e audit log.
- Implementata Knowledge Base API:
  - `src/server/knowledge-base/documents.ts`;
  - `GET/POST /api/knowledge-base`;
  - `GET/PATCH/DELETE /api/knowledge-base/[documentId]`;
  - CRUD tenant-scoped, archiviazione soft, embeddings OpenAI opzionali e audit log.
- Test aggiunti:
  - `tests/server/settings/tenant-settings.test.ts`;
  - `tests/server/conversations/inbox.test.ts`;
  - `tests/server/knowledge-base/documents.test.ts`.
- Documentazione/memoria aggiornata:
  - `docs/architecture/backend-foundation.md`;
  - `docs/handoff/frontend-contract.md`;
  - `docs/memory/project-memory.md`;
  - `docs/memory/agent-log.md`.
- Verifica mirata passata:
  - `npm test -- --run tests/server/settings/tenant-settings.test.ts tests/server/conversations/inbox.test.ts tests/server/knowledge-base/documents.test.ts`: 3 file, 13 test passati.
- Verifica completa passata:
  - `npm run verify`: typecheck, 35 file test, 132 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 27 pagine/route generate, incluse settings, conversations e knowledge base API;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: Auth/onboarding tenant reale, poi Stripe billing e usage limits.

## 2026-04-26 - Onboarding tenant e claim auth - Fatto da Codex

- Aggiornato `src/lib/auth/session.ts`:
  - aggiunto `requireAuthenticatedUser()` per endpoint pre-tenant;
  - `requireSession()` ora riusa lo stesso lettore auth e continua a richiedere `tenant_id`/`role`.
- Implementato `src/server/onboarding/tenant-onboarding.ts`:
  - legge stato onboarding da `users` + `tenants`;
  - crea tenant trial 14 giorni senza carta;
  - normalizza nome tenant, email billing, timezone, business type, studio, servizi e business hours;
  - seed default: servizio "Prima visita" 30 minuti e orari lunedi-venerdi 09:00-18:00;
  - sync claim Supabase `app_metadata.tenant_id` e `app_metadata.role`;
  - retry idempotente se la membership esiste gia';
  - blocco conflitto se auth ha gia' claim tenant ma manca membership DB.
- Aggiunta route authenticated pre-tenant:
  - `GET /api/onboarding/tenant`;
  - `POST /api/onboarding/tenant`.
- Aggiunta migrazione:
  - `supabase/migrations/202604260003_tenant_onboarding.sql`;
  - RPC `create_tenant_onboarding(...)` service-role only;
  - crea tenant, owner, config, services, business hours e audit log in transazione DB.
- Aggiornato `scripts/check-rls-migration.mjs` per controllare la nuova RPC.
- Test aggiunto:
  - `tests/server/onboarding/tenant-onboarding.test.ts`.
- Documentazione/memoria aggiornata:
  - `docs/architecture/backend-foundation.md`;
  - `docs/handoff/frontend-contract.md`;
  - `docs/memory/project-memory.md`;
  - `docs/memory/agent-log.md`.
- Verifica mirata passata:
  - `npm test -- --run tests/server/onboarding/tenant-onboarding.test.ts`: 1 file, 4 test passati;
  - `npm run typecheck`: passato.
- Verifica completa passata:
  - `npm run verify`: typecheck, 36 file test, 136 test, RLS OK su 21 tabelle;
  - `npm run build`: passato con 28 pagine/route generate, inclusa `/api/onboarding/tenant`;
  - `npm audit --audit-level=moderate`: 0 vulnerabilita';
  - scansione vecchio naming e riferimenti non Codex: 0 occorrenze.
- Prossimo step consigliato da Codex: Stripe billing, poi usage limits.

## 2026-04-27 - Handoff temporaneo takeover - Fatto da Codex

- Il founder ha chiesto takeover temporaneo a Claude Code mentre Codex si ferma; rientro Codex previsto il 1 maggio 2026.
- Creato handoff operativo:
  - `docs/handoff/2026-04-27-claude-code-takeover.md`.
- Il documento contiene:
  - stato backend verificato;
  - regole di progetto;
  - mappa dei moduli gia' pronti;
  - migrazioni importanti;
  - piano futuro prioritizzato: Stripe billing, usage limits, invio manuale operatore, security review;
  - comandi di verifica;
  - istruzioni per rientro Codex.
- Prossimo step consigliato da Codex per il takeover: implementare Stripe billing senza cambiare la policy trial 14 giorni senza carta.

## 2026-04-27 - Stripe Billing MVP - Fatto da Claude Code

Takeover temporaneo Claude Code: implementato Stripe billing MVP backend secondo l'handoff Codex.

File creati:

- `supabase/migrations/202604270001_stripe_billing.sql` con colonne Stripe su `tenants` (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `current_period_end`, `cancel_at_period_end`), indici unici parziali e indici di lookup su `invoices`/`billing_events`. RLS su `invoices`/`billing_events` non toccate (gia' coperte dalla migration iniziale).
- `src/lib/stripe/client.ts` con `getStripeClient()` cached, `apiVersion=2026-02-25.clover` allineata a `stripe@20.4.1`.
- `src/lib/stripe/webhook-security.ts` con `constructStripeEvent(rawBody, signature)` che mappa errori a `AppError('webhook_rejected')`.
- `src/server/billing/stripe-billing.ts`: service + repository (`StripeBillingService`, `SupabaseStripeBillingRepository`, `StripeApiAdapter`, `loadStripeBillingConfigFromEnv`). Configurazione iniettata via DI per testabilita'.
- `src/app/api/billing/status/route.ts`: GET requireSession.
- `src/app/api/billing/checkout/route.ts`: POST owner/admin con Zod `{ plan: 'starter'|'professional' }`.
- `src/app/api/billing/portal/route.ts`: POST owner/admin.
- `src/app/api/webhook/stripe/route.ts`: POST con raw body, signature, rate limit Stripe.
- `tests/server/billing/stripe-billing.test.ts`: 11 test (status, checkout, portal, audit, role).
- `tests/server/billing/stripe-webhook.test.ts`: 10 test (sub created/updated/deleted, invoice paid/failed, idempotency, tenant resolution, unknown price, unhandled).

File modificati:

- `src/lib/env.ts`: aggiunti `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_BILLING_PORTAL_RETURN_URL`, `STRIPE_CHECKOUT_SUCCESS_URL`, `STRIPE_CHECKOUT_CANCEL_URL`, `STRIPE_BILLING_RATE_LIMIT_MAX`, `STRIPE_BILLING_RATE_LIMIT_WINDOW_MS`. `STRIPE_PRICE_AGENCY` NON aggiunto (Agency manuale founder come da regola beta).
- `.env.example`: aggiunte stesse chiavi con default sensati.
- `src/lib/rate-limit/index.ts`: aggiunto `enforceStripeWebhookRateLimit` con stesso pattern WhatsApp (Upstash o memory fallback) e reset esteso per i test.
- `scripts/check-rls-migration.mjs`: aggiunti snippet specifici migration billing per evitare regressioni.
- `docs/architecture/backend-foundation.md`: sezione "Stripe Billing - Fatto da Claude Code 2026-04-27".
- `docs/handoff/frontend-contract.md`: contratti `/api/billing/*` con esempi response e note UI.
- `docs/memory/project-memory.md`: modulo billing aggiunto.

Comportamento billing:

- Trial 14 giorni senza carta NON modificato. Stripe non viene mai contattato durante onboarding/trial.
- Customer Stripe creato lazy al primo checkout/portal call.
- Self-checkout MVP espone solo Starter e Professional; Agency resta gestita manualmente dal founder come da regola beta.
- Webhook idempotency via `webhook_events` con `createWebhookIdempotencyKey({ provider: 'stripe', externalId })`. Replay dello stesso event id ritorna `processed=false, reason='duplicate'`.
- Tenant resolution dal webhook: prima `data.object.metadata.tenant_id`, poi `client_reference_id` (per checkout), poi fallback `findTenantByStripeCustomerId(customer)`.
- Plan derivation: dal `price.id` confrontato con la config DI; se non match, billing event con `event_type='unknown_price:<id>'` ma il flusso non si interrompe.
- `customer.subscription.deleted` riporta tenant a `plan='trial'` + `status='cancelled'` e azzera `stripe_subscription_id` (come confermato dal founder).
- `invoice.paid`/`invoice.payment_failed` upsert in `invoices` con `status` corrispondente e billing event.
- Audit log scritto su checkout/portal create.

Pattern rispettato:

- Route sottile -> service (DI) -> repository (Supabase admin) -> test con fake repository.
- AppError per errori applicativi, `jsonHandler` per envelope JSON consistente, `webhook_rejected` su signature invalida.
- Stripe SDK e config iniettate per testabilita' (`StripeApi` interface, `StripeBillingConfig`).
- Nessun refactor su moduli Codex esistenti (whatsapp, booking, ai, settings, conversations, knowledge-base, onboarding).

Verifica completa:

- `npm run typecheck`: passato.
- `npm test`: 38 file test, 157 test passati (pre-esistenti 36/136 + 2 nuovi file billing/21 test).
- `npm run db:lint`: RLS migration coverage OK su 21 tabelle e snippet billing presenti.
- `npm run verify`: typecheck + test + db:lint tutti verdi.
- `npm run build`: passato, 32 pagine/route generate. Le 4 nuove route billing presenti: `/api/billing/checkout`, `/api/billing/portal`, `/api/billing/status`, `/api/webhook/stripe`.
- `npm audit --audit-level=moderate`: 0 vulnerabilita'.

Env mancanti per il founder prima del go-live:

- `STRIPE_PRICE_STARTER` e `STRIPE_PRICE_PROFESSIONAL`: creare prodotti+price in Stripe Dashboard (monthly EUR), copiare `price_xxx`.
- `STRIPE_CHECKOUT_SUCCESS_URL`, `STRIPE_CHECKOUT_CANCEL_URL`, `STRIPE_BILLING_PORTAL_RETURN_URL`: configurare URL pubblici dell'app.
- `STRIPE_WEBHOOK_SECRET`: ricavato dal Dashboard Stripe quando si registra l'endpoint webhook su `/api/webhook/stripe`.
- Customer Portal: configurare features (cancel subscription, payment method, customer details) nel Dashboard Stripe.

Cosa NON e' stato toccato:

- Trial copy, pricing, brand, naming, frontend.
- RLS o schema esistente di `invoices`/`billing_events` (solo aggiunti indici di performance e nuove colonne su `tenants`).
- Moduli Codex (WhatsApp, booking, AI, settings, inbox, knowledge-base, onboarding).
- FattureInCloud integration (campi `fattureincloud_invoice_id`, `sdi_status` esistenti su `invoices` ma fuori scope MVP).

Prossimo step consigliato da Claude Code:

1. Configurare lato Stripe Dashboard: prodotti, price IDs, Customer Portal, webhook endpoint.
2. Implementare lato dashboard frontend i componenti billing usando i contratti documentati in `frontend-contract.md`.
3. Step backend successivo (post takeover): usage limits per piano (Step 2 dell'handoff Codex), in particolare conteggio messaggi/vocali/AI cost con soft warning e hard block configurabile.

## 2026-04-27 - Usage Limits MVP - Fatto da Claude Code

Step 2 dell'handoff Codex implementato durante il takeover Claude Code, dopo Stripe billing MVP.

Scelte di prodotto confermate dal founder:

- Unita' del limite: **conversazioni/mese**, allineato al pricing pubblico (`pricing.md`).
- Comportamento al superamento: soft warning a 80%, hard block solo dell'auto-reply a 100% (resto della pipeline operativo).
- Vocali: metric separata `voice_messages_count` con sublimite per piano.
- Limiti per piano: Trial 100/50, Starter 500/200, Professional 2000/500, Agency 2000/500 per-tenant.

File creati:

- `supabase/migrations/202604270002_usage_limits.sql`: aggiunge `usage_metrics.voice_messages_count` e aggiorna `public.increment_usage_metrics(...)` con il sesto parametro `p_voice_messages_delta`. Revoca/grant execute aggiornati per la nuova firma. Indice `usage_metrics_tenant_month_idx`.
- `src/server/usage/limits.ts`: `UsageLimitsService` + `SupabaseUsageLimitsRepository` + `DEFAULT_USAGE_LIMITS_CONFIG`. Service offre `getSnapshot`, `getDashboardSnapshot`, `checkAutoReplyAllowed`, `registerInboundConversation`, `registerVoiceMessage`. Configurazione DI per testabilita' e per future tuning del founder senza redeploy.
- `src/app/api/usage/status/route.ts`: GET requireSession() che ritorna snapshot per il dashboard.
- `tests/server/usage/limits.test.ts`: 10 test (snapshot trial, soft warning a 80%, hard block conversations, hard block voice, checkAutoReplyAllowed con/senza voiceQuota, registerInboundConversation idempotente nel mese, registerVoiceMessage).
- `tests/server/usage/auto-reply-guard.test.ts`: 2 test integration tra `WhatsAppAutoReplyService` e `UsageLimitsService` (block + pass-through).

File modificati (minimal-touch):

- `src/server/whatsapp/auto-reply.ts`: aggiunto `usageLimits?: UsageLimitsService` al constructor (DI opzionale, backward-compat). Nuovo `skippedReason: 'usage_limit_reached'`. Guard chiamato dopo opt-out, prima di `insertOutboundMessage`. Per inbound `voice_transcript` viene passato `requireVoiceQuota=true`.
- `src/server/whatsapp/service.ts`: `WhatsAppWebhookService` accetta `usageLimits` opzionale. Dopo `insertInboundMessage.created=true` chiama `usageLimits.registerInboundConversation()`. Factory `createWhatsAppWebhookService()` instanzia `createUsageLimitsService()` e lo passa sia al `WhatsAppAutoReplyService` sia al `WhatsAppWebhookService`.
- `src/server/whatsapp/voice-pipeline.ts`: `WhatsAppVoicePipelineWorker` accetta `usageLimits` opzionale. Dopo `markVoiceEventCompleted` chiama `usageLimits.registerVoiceMessage()` (try/catch tracking-only, errori non interrompono la pipeline). Factory `createWhatsAppVoicePipelineWorker()` istanzia il service e lo passa anche all'auto-reply handler usato dal worker.
- `scripts/check-rls-migration.mjs`: aggiunti snippet `voice_messages_count integer not null default 0`, `p_voice_messages_delta integer default 0`, `usage_metrics_tenant_month_idx`.
- `docs/architecture/backend-foundation.md`: sezione "Usage Limits - Fatto da Claude Code 2026-04-27".
- `docs/handoff/frontend-contract.md`: contratto `/api/usage/status` con esempi response, copy banner soft/hard, tabella limiti.
- `docs/memory/project-memory.md`: modulo usage aggiunto.

Comportamento end-to-end:

- Webhook inbound: messaggio inbound ricevuto → `messages_count +1` (Codex) → se prima volta del customer nel mese → `conversations_count +1` (Claude Code).
- Voice worker: trascrive, salva, `voice_messages_count +1` (Claude Code), poi auto-reply.
- Auto-reply: classifica intent, salva costo AI, controlla opt-out → se passa → controlla `checkAutoReplyAllowed()`. Se piano esaurito → ritorna `skippedReason='usage_limit_reached'` senza accodare outbound. Webhook resta 200, conversazione persistita, opt-out e booking continuano.
- Dashboard: `GET /api/usage/status` ritorna `{conversations: {used,limit,percent,exceeded,warning}, voiceMessages: {...}, autoReplyAllowed, blockReason, softWarning}`.

Pattern rispettato:

- Tutti i nuovi argomenti `usageLimits` sono **opzionali**: i test esistenti di Codex (whatsapp service, voice-pipeline, auto-reply) continuano a passare senza modifiche.
- Nessun refactor di moduli Codex: solo aggiunti argomenti DI e una linea di chiamata per ciascuna integrazione.
- Service+repository singolo file con factory `createUsageLimitsService()`.
- AppError standard, audit log non necessario per usage tracking (snapshot live, niente mutazione utente-driven).

Verifica completa:

- `npm run typecheck`: passato.
- `npm test`: 40 file test, 169 test passati (pre-takeover 36/136 + Stripe 2/21 + usage 2/12 = 40/169). 0 regressioni sui test Codex pre-esistenti.
- `npm run db:lint`: RLS migration coverage OK su 21 tabelle, snippet usage limits presenti.
- `npm run verify`: typecheck + test + db:lint tutti verdi.
- `npm run build`: passato, 33 pagine/route generate. Nuova route `/api/usage/status` presente.
- `npm audit --audit-level=moderate`: 0 vulnerabilita'.

Cosa NON e' stato toccato:

- Pricing pubblico, copy, brand, naming.
- Pattern auto-reply esistente (solo aggiunto guard prima dell'enqueue).
- Schema esistente di `usage_metrics`: solo aggiunta colonna `voice_messages_count`.
- Voice pipeline: la trascrizione resta sempre attiva (anche oltre limite voice), il blocco e' solo sull'auto-reply.
- Workflow di escalation umana, opt-out, booking conversazionale: tutti restano operativi anche con auto-reply bloccato.

Prossimo step consigliato da Claude Code:

1. **Founder side:** verificare i numeri dei limiti per piano sui primi clienti reali, raffinare via `UsageLimitsConfig` se serve. Considerare di mostrare i limiti nel dashboard pricing.
2. **Frontend dashboard:** banner soft warning/hard block + barra progresso usage seguendo `frontend-contract.md`.
3. **Backend successivo (Step 3 dell'handoff Codex):** invio manuale operatore dall'inbox (`POST /api/conversations/[conversationId]/messages`) — diventa cruciale ora che l'auto-reply puo' essere bloccato per limit, cosi' l'operatore puo' rispondere manualmente.

## 2026-04-27 - Invio Manuale Operatore - Fatto da Claude Code

Step 3 dell'handoff Codex completato durante il takeover. Owner/admin del tenant possono inviare un messaggio manuale WhatsApp dall'inbox.

File creati:

- `src/server/conversations/operator-messages.ts`: `OperatorMessagesService` + `SupabaseOperatorMessagesRepository`. Vincoli applicati upfront prima di accodare l'outbox:
  - solo owner/admin (member rifiutato con `forbidden`);
  - conversazione esistente e tenant-scoped (`not_found`);
  - canale supportato in MVP: solo WhatsApp (Instagram/Web/SMS rifiutati con `bad_request`);
  - opt-out rifiutato con `forbidden` (no bypass);
  - finestra 24h dall'ultimo messaggio del cliente: fuori finestra `conflict` con messaggio "send an approved template instead (not yet supported)";
  - lunghezza testo 1..4096 caratteri, trim e non vuoto;
  - `external_id` server-side `manual:{uuid}` per evitare doppi invii.
- `src/app/api/conversations/[conversationId]/messages/route.ts`: POST owner/admin con Zod strict body `{ content: string }`, ritorna `{ messageId, externalId, conversationId, enqueuedJobId, customerServiceWindowExpiresAt }`.
- `tests/server/conversations/operator-messages.test.ts`: 7 test (insert+enqueue+audit dentro finestra, member rifiutato, conversazione mancante, channel non WhatsApp, opt-out blocca senza accodare, finestra chiusa rifiutata, contenuto vuoto/whitespace).

Comportamento:

- `messages.sender_type='human'` (constraint gia' supportato dalla migration iniziale Codex).
- Outbox payload: `{ type: 'text', text: { body }, metadata: { source: 'manual_operator', operatorUserId, conversationId } }`.
- L'outbox worker rispetta gia' la finestra 24h (vedi `claim_whatsapp_outbox_jobs` SQL e `outbox.ts:230` con marker `whatsapp_window_closed`); il check upfront del service serve a fail-fast prima di sporcare la coda con job destinati al dead-letter.
- Audit log: `action='conversations.message.sent'`, `resource_type='message'`, metadata con conversation, externalId, senderType, channel, contentLength, windowExpiresAt.
- L'invio manuale NON conta verso usage limits (conversations/voice): operatore puo' rispondere manualmente anche dopo hard block auto-reply.
- Nessuna nuova migration: `messages` + `whatsapp_outbox_jobs` + `audit_log` esistenti gia' coprono il caso d'uso.

Pattern rispettato:

- Service+repository singolo file, factory `createOperatorMessagesService()`.
- Nessun refactor su moduli Codex (whatsapp service, outbox, auto-reply, voice).
- Riusa `whatsapp_outbox_jobs` esistente con payload Zod-compatibile gia' definito in `outbox.ts`.
- AppError standard, `jsonHandler` envelope.

Verifica completa:

- `npm run typecheck`: passato.
- `npm test`: 41 file test, 176 test passati (pre-takeover 36/136 + Stripe 2/21 + usage 2/12 + manual operator 1/7 = 41/176). 0 regressioni.
- `npm run db:lint`: RLS migration coverage OK su 21 tabelle.
- `npm run verify`: typecheck + test + db:lint tutti verdi.
- `npm run build`: passato, 34 pagine/route generate. Nuova route `POST /api/conversations/[conversationId]/messages` presente.
- `npm audit --audit-level=moderate`: 0 vulnerabilita'.

Cosa NON e' stato toccato:

- Auto-reply, voice pipeline, booking conversazionale, opt-out service.
- Schema DB (riusa `messages`/`whatsapp_outbox_jobs`/`audit_log` esistenti).
- Pricing, brand, copy, naming.
- Template manuale fuori finestra 24h: rimandato finche' i template reali non sono approvati lato 360dialog/Meta.

Prossimo step consigliato da Claude Code:

1. **Founder side:** se possibile, configurare uno o due template WhatsApp `utility` approvati (es. `manual_followup`, `appointment_reminder_manual`) cosi' lo Step 3 puo' essere esteso con invio manuale fuori finestra via template.
2. **Frontend dashboard:** componente "Reply" nell'inbox seguendo `frontend-contract.md`. Disabilitare l'input quando opt-out attivo o finestra chiusa.
3. **Backend successivo (Step 4 dell'handoff Codex):** Security Review Mirata pre-beta — review service-role usage, test RLS tenant A/B con Supabase locale, verifica webhook Stripe/WhatsApp, route admin/member, gitleaks, runbook produzione. Suggerirei di lasciare questo step a Codex al rientro (1 maggio) perche' richiede contesto operativo profondo.

## 2026-04-27 - Client API Tipizzato Browser-Side - Fatto da Claude Code

Aggiunto pacchetto plumbing frontend, livello 1 (zero UI, zero copy, zero design). Pensato per essere accettato/esteso/sostituito da Codex senza vincoli sulla direzione visiva.

File creati:

- `src/lib/api-client/types.ts`: `ApiError` class + `ApiErrorCode` union (estende i codici server con `'network_error'` e `'invalid_response'` client-side) + `ApiErrorEnvelopeSchema`.
- `src/lib/api-client/fetch.ts`: `apiFetch<TSchema>(path, options)` core fetcher. Serializza body JSON, normalizza URL (relative o assolute), parsa l'envelope `{ ok, data | error }` di `src/lib/api/json.ts`, valida `data` con uno schema Zod, mappa errori di rete e parsing a `ApiError`. `credentials: 'same-origin'`. Browser-only.
- `src/lib/api-client/billing.ts`: schemi Zod (`BillingStatusSchema`, `CheckoutSessionResultSchema`, `BillingPortalResultSchema`) e factory `createBillingClient({ baseUrl })` con `getStatus`, `createCheckoutSession({ plan })`, `createPortalSession`.
- `src/lib/api-client/usage.ts`: `UsageSnapshotSchema` e `createUsageClient({ baseUrl })` con `getStatus`.
- `src/lib/api-client/conversations.ts`: `SendOperatorMessageInputSchema`, `SendOperatorMessageResultSchema` e `createConversationsClient({ baseUrl })` con `sendOperatorMessage({ conversationId, content })`. Encode-safe del path tramite `encodeURIComponent`. Validazione body sincrona prima di chiamare fetch (fail-fast su input malformato).
- `src/lib/api-client/index.ts`: re-export pubblico.
- `tests/lib/api-client/fetch.test.ts`: 7 test (envelope success, JSON body POST, envelope error, normalize unknown code, network error, JSON invalido, schema mismatch).
- `tests/lib/api-client/clients.test.ts`: 7 test (billing status, checkout body, portal, schema reject su URL invalida, usage snapshot, conversations encode + post, sync rejection di content vuoto).

Scope coperto: SOLO le route Claude Code (Stripe billing, usage, manual operator messages).
Scope NON coperto: route Codex pre-esistenti (settings, conversations GET/PATCH, knowledge-base, onboarding, integrations). Lasciate a Codex per la sua scelta di pattern frontend.

Decisioni di design:

- **Browser-only**: `credentials: 'same-origin'` propaga i cookie Supabase. Per RSC/Server Actions Codex invoca direttamente i service in `src/server/...` senza passare dal client.
- **Nessuna dipendenza nuova**: usa solo `zod` (gia' presente). Niente TanStack Query, SWR, fetcher esterni.
- **Nessuna lib di state management imposta**: Codex sceglie liberamente. Le funzioni del client sono async pure, integrabili con qualsiasi pattern.
- **Validazione runtime**: ogni response viene parsata con Zod. Schema mismatch → `ApiError('invalid_response')`. Costo trascurabile, beneficio grosso (segnale forte se backend e client divergono).
- **Error code unificati**: `ApiErrorCode` unisce i codici server (gli stessi di `src/lib/errors/app-error.ts`) e i due client-side `network_error`/`invalid_response`.
- **Factory + DI di `baseUrl`**: utile per testing e per eventuale SSR-friendly fetch.

Pattern rispettato:

- File per dominio (billing/usage/conversations), in linea con la struttura `src/server/`.
- Schemi Zod in stesso file della factory: niente over-engineering di "schemi separati".
- Niente refactor, niente modifiche a moduli Codex o ai service backend. Niente nuove dipendenze.

Verifica completa:

- `npm run typecheck`: passato.
- `npm test`: 43 file test, 190 test passati (pre-takeover 36/136 + Stripe 2/21 + usage 2/12 + manual operator 1/7 + api-client 2/14 = 43/190). 0 regressioni.
- `npm run db:lint`: RLS migration coverage OK.
- `npm run verify`: passato.
- `npm run build`: passato. Le 34 route restano invariate (il client e' lib, non route).
- `npm audit --audit-level=moderate`: 0 vulnerabilita'.

Cosa Codex puo' fare al rientro:

1. Adottare il client cosi' com'e' nei Client Components che costruira'.
2. Estenderlo aggiungendo `settings.ts`, `inbox.ts`, `knowledge-base.ts`, `integrations.ts` con lo stesso pattern (schema Zod + funzione che chiama `apiFetch`). Vedi `billing.ts` come riferimento di 80 righe.
3. Sostituirlo con un pattern diverso (es. server actions tipizzate) se preferisce. Il costo di rimozione e' nullo: 5 file in `src/lib/api-client/`, 0 dipendenze esterne.
4. Wrappare il client in TanStack Query/SWR/Zustand/Jotai se vuole caching/dedup. Le funzioni async pure si compongono con qualsiasi lib.

Prossimo step consigliato da Claude Code:

- A questo punto il backend e' coperto fino allo Step 3 incluso, piu' la plumbing client-side. Suggerisco di **fermarsi qui** e attendere Codex il 1 maggio per Step 4 (Security Review) e tutta la parte UI/design. Aggiungere altro rischierebbe di pestare territorio Codex.

## 2026-04-27 - Takeover Concluso - Fatto da Claude Code

Il founder mi ha chiesto di fermarmi qui e consegnare a Codex. Confermo chiusura takeover.

Cosa ho consegnato:

1. Stripe Billing MVP (`src/server/billing/`, `src/lib/stripe/`, 4 route, 21 test).
2. Usage Limits (`src/server/usage/`, 1 route, 12 test, integrato in WhatsApp service/auto-reply/voice-pipeline via DI opzionale).
3. Invio Manuale Operatore (`src/server/conversations/operator-messages.ts`, 1 route, 7 test).
4. Client API tipizzato browser-side (`src/lib/api-client/`, 14 test).

Stato finale verificato:

- `npm run typecheck`: passato.
- `npm test`: 43 file test, 190 test passati.
- `npm run db:lint`: OK su 21 tabelle.
- `npm run verify`: passato.
- `npm run build`: passato, 34 route generate.
- `npm audit --audit-level=moderate`: 0 vulnerabilita'.

Documenti consegnati a Codex per il rientro del 1 maggio:

- `docs/handoff/2026-04-27-claude-code-completion.md`: messaggio diretto a Codex con riepilogo, file, vincoli, to-do founder Stripe Dashboard, suggerimenti.
- 4 entry "Fatto da Claude Code 2026-04-27" in questo agent-log (Stripe / Usage Limits / Manual Operator / API Client).
- Sezioni nuove in `docs/architecture/backend-foundation.md` per Stripe / Usage / Manual Operator.
- Sezioni nuove in `docs/handoff/frontend-contract.md` per `/api/billing/*`, `/api/usage/status`, `POST /api/conversations/[conversationId]/messages`, e per il client `src/lib/api-client/`.
- Aggiornamenti in `docs/memory/project-memory.md`.

Cosa Codex deve fare al rientro:

1. Leggere `docs/handoff/2026-04-27-claude-code-completion.md`.
2. Eseguire `npm run verify && npm run build && npm audit --audit-level=moderate` per validare lo stato consegnato.
3. Coordinarsi con il founder per la configurazione Stripe Dashboard (price IDs, Customer Portal, webhook endpoint).
4. Decidere se procedere con Step 4 (Security Review Mirata) oppure se iniziare il frontend reale.

Ownership tornata a Codex il 1 maggio 2026 (rientro previsto).

— Claude Code
