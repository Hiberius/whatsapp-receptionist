# PROMPT 04 - INTEGRAZIONE WHATSAPP (360dialog BSP)

## PROMPT OPERATIVO CODEX

Ora integriamo WhatsApp Business API via 360dialog come BSP. Motivazione: 360dialog e' un BSP certificato Meta basato in EU (Germania), fatturazione in Euro, onboarding piu' veloce di Meta Cloud API diretta, supporto EU/Italia.

Prerequisito: devi gia' avere un account 360dialog attivo con numero WhatsApp verificato. Se non lo hai, fermati e apri prima ticket con loro (serve P.IVA + documenti business).

STEP 1 - Webhook endpoint

Crea src/app/api/webhook/whatsapp/route.ts:

```typescript
// Endpoint che riceve messaggi da 360dialog
// Deve:
// 1. Verificare header segreto custom configurato in 360dialog
// 2. Parse payload JSON
// 3. Identificare tenant dal "to" field (il nostro numero)
// 4. Inserire messaggio in DB
// 5. Queue background job per processarlo
// 6. Ritornare 200 OK velocemente (< 5 sec)
```

Implementa:
- POST handler per ricezione messaggi
- GET handler per verifica webhook (hub.verify_token)
- Verifica sicurezza webhook MVP con header segreto custom configurato in 360dialog:
  - Env: `WHATSAPP_WEBHOOK_HEADER_NAME=x-ambrogio-webhook-secret`
  - Env: `WHATSAPP_WEBHOOK_HEADER_SECRET=<random 32+ bytes>`
  - In 360dialog Hub/API aggiungi lo stesso header al webhook.
  - Se 360dialog/Meta espone `X-Hub-Signature-256` per il tuo setup specifico, supportala come protezione aggiuntiva, ma NON assumerla come obbligatoria finche' non e' verificata in dashboard/documentazione del tenant.
  - Aggiungi idempotenza su `messages.id` / `statuses.id` e reject replay duplicati.
- Parsing payload tipizzato con Zod
- Rate limiting per IP (Upstash)
- Error handling che non blocca la response (loggare e continuare)

Schema Zod per payload WhatsApp (semplificato):
```typescript
const WhatsAppWebhookPayload = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      value: z.object({
        messaging_product: z.literal('whatsapp'),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string(),
        }),
        messages: z.array(z.object({
          from: z.string(),
          id: z.string(),
          timestamp: z.string(),
          type: z.enum(['text', 'image', 'audio', 'document', 'location']),
          text: z.object({ body: z.string() }).optional(),
          audio: z.object({
            id: z.string(),
            mime_type: z.string().optional(),
            sha256: z.string().optional(),
            voice: z.boolean().optional(),
          }).optional(),
          // altri tipi messaggio
        })).optional(),
        statuses: z.array(z.object({
          id: z.string(),
          status: z.enum(['sent', 'delivered', 'read', 'failed']).optional(),
          timestamp: z.string().optional(),
          recipient_id: z.string().optional(),
        }).passthrough()).optional(),
      }),
      field: z.literal('messages'),
    })),
  })),
})
```

STEP 2 - Tenant identification

Base gia' preparata da Codex:
- `src/server/whatsapp/webhook-events.ts`
- `src/server/whatsapp/repository.ts`
- `src/server/whatsapp/service.ts`
- `src/lib/rate-limit/*`

Tenant resolution:
- Usa `integrations.provider='whatsapp_360dialog'`
- Campo primario: `integrations.external_account_id = phone_number_id`
- Fallback compatibilita': `integrations.config.phone_number_id`
- Se non trovato: registra `webhook_events.status='failed'` con `tenant_not_found`, log warning e ritorna 200 al provider per evitare retry infiniti.
- Prossimo miglioramento: cache Redis TTL 5 minuti quando Upstash e' configurato.

STEP 3 - Incoming message processor

Crea src/lib/whatsapp/incoming-processor.ts:
- La logica iniziale e' in `WhatsAppWebhookService.processPayload()`.
- 1. Registra `webhook_events` con idempotency key
- 2. Trova o crea conversation per (tenant_id, channel, customer_identifier)
- 3. Inserisci message inbound con `external_id=message:{wamid}`
- 4. Aggiorna `usage_metrics` via funzione SQL `increment_usage_metrics`
- 4. Se conversation.ai_enabled = true, queue job per AI reply
- 5. Se ai_enabled = false, notifica titolare (human takeover mode)
- Rate limiting per customer: max 20 messaggi/minuto per evitare abuse

STEP 4 - Trigger.dev job per AI reply

Crea src/trigger/generate-ai-reply.ts:

```typescript
// Job Trigger.dev che:
// 1. Carica conversation context (ultimi 20 messaggi)
// 2. Carica knowledge base del tenant (FAQ)
// 3. Carica orari e disponibilita' calendario
// 4. Chiama intent router (Anthropic Haiku)
// 5. In base a intent, chiama il giusto agent
// 6. Salva risposta AI in DB
// 7. Chiama sendWhatsAppMessage() per inviare
// 8. Log audit
```

STEP 5 - Outgoing message sender + outbox durabile

Base gia' preparata da Codex:
- `src/server/whatsapp/client.ts`
- `src/server/whatsapp/outbox.ts`
- `src/server/whatsapp/outbox-repository.ts`
- `src/app/api/internal/jobs/whatsapp-outbox/route.ts`

Mantieni il pattern:
- Il webhook inbound NON chiama direttamente 360dialog.
- Il webhook crea messaggio outbound e accoda `whatsapp_outbox_jobs`.
- Il worker interno `POST /api/internal/jobs/whatsapp-outbox` reclama job pronti via `claim_whatsapp_outbox_jobs()`.
- Il worker invia a `https://waba-v2.360dialog.io/messages`.
- Retry con backoff su 429/5xx.
- Dead-letter su 4xx non retryable o max attempts.
- `complete_whatsapp_outbox_job()` completa job e messaggio outbound in modo atomico.
- `fail_whatsapp_outbox_job()` riprogramma retry o marca dead-letter in modo atomico.
- Fatto da Codex: `src/server/whatsapp/client.ts` supporta sia `sendText()` sia `sendTemplate()`.
- Fatto da Codex: `src/server/whatsapp/outbox.ts` valida payload `type='text'` e `type='template'`.
- Fatto da Codex: `claim_whatsapp_outbox_jobs()` restituisce `customer_service_window_expires_at`.
- Fatto da Codex: il worker blocca free-form text fuori customer service window 24h e marca dead-letter con `whatsapp_window_closed`; fuori finestra va accodato un template approvato.

STEP 6 - Template messages manager

Base gia' preparata da Codex:
- tabella `whatsapp_message_templates`
- indice `whatsapp_message_templates_tenant_status_idx`
- RLS tenant/admin
- invio template via `Dialog360WhatsAppClient.sendTemplate()`
- `src/server/whatsapp/templates.ts` con `WhatsAppTemplateMessageService.enqueueTemplateMessage()`
- `src/server/whatsapp/template-sync.ts` con sync `GET /v1/configs/templates`
- `src/app/api/internal/jobs/whatsapp-template-sync/route.ts` protetta da `INTERNAL_JOB_SECRET`
- `src/server/appointments/notifications.ts` con `AppointmentNotificationService`
- `src/app/api/internal/jobs/appointment-reminders/route.ts` per reminder 24h/1h

Fatto da Codex:
- 360dialog richiede template pre-approvati per messaggi proattivi (fuori 24h window)
- Template MVP:
  - appointment_confirmation (confermo appuntamento)
  - appointment_reminder_24h (promemoria 24h prima)
  - appointment_reminder_1h (promemoria 1h prima)
  - appointment_cancellation (disdetta)
- Ogni template ha variabili ({{1}} nome, {{2}} data, ecc)
- L'helper controlla `whatsapp_message_templates.status='approved'` prima di accodare.
- Funzione `enqueueTemplateMessage()` accoda payload outbox `type='template'`.
- Sync stato template da API 360dialog/Meta in `whatsapp_message_templates`.
- Booking notification bridge:
  - `enqueueNotification({ kind: 'confirmation' })`;
  - `enqueueNotification({ kind: 'reminder_24h' })`;
  - `enqueueNotification({ kind: 'reminder_1h' })`;
  - `enqueueNotification({ kind: 'cancellation' })`.

Da completare in step successivo:
- Sottomissione template via API o Hub per approval Meta.
- Collegare AI booking e Google Calendar alla creazione/modifica di `appointments`.
- Gestire webhook `template_message_update` se disponibile nel setup reale.

STEP 7 - Media handling

Per messaggi con immagini/audio/documenti:
- Scarica media via 360dialog API (auth richiesto)
- Upload a Supabase Storage in bucket tenant-specific
- Salva URL in messages.media_urls
- Rispetta file size limits WhatsApp (max 100MB)

STEP 7B - Vocali WhatsApp con ElevenLabs (CORE)

Base gia' preparata da Codex:
- `src/server/whatsapp/media.ts`
- `src/server/storage/media-storage.ts`
- `src/server/whatsapp/auto-reply.ts`
- `src/server/whatsapp/voice-repository.ts`
- `src/server/whatsapp/voice-pipeline.ts`
- `src/app/api/internal/jobs/whatsapp-voice/route.ts`
- tabella `whatsapp_voice_jobs`
- tabella audit `voice_events`

Per messaggi `type='audio'`:
- Il webhook accoda `whatsapp_voice_jobs` e ritorna velocemente.
- Worker interno protetto da `INTERNAL_JOB_SECRET` scarica il media audio da WhatsApp/360dialog.
- Salva l'audio originale in Supabase Storage tenant-scoped (`SUPABASE_MEDIA_BUCKET`).
- Trascrivi con ElevenLabs Speech-to-Text modello `scribe_v2`.
- Salva transcript in `messages.transcript_text`, lingua in `messages.transcript_language`, durata in `messages.audio_duration_secs`.
- Inserisci record in `voice_events` con direction='stt', provider='elevenlabs', model='scribe_v2'.
- Fatto da Codex: passa `transcript_text` a `WhatsAppAutoReplyService`, mantenendo `message_type='audio'` per audit.
- Fatto da Codex: riusa intent router, disclosure AI, doppio gate `AMBROGIO_AI_AUTOREPLY_ENABLED` + `tenant_config.auto_reply_enabled`, opt-out e outbox durabile.
- Fatto da Codex: se un retry trova gia' `messages.transcript_text`, non ripete STT e prova solo la parte auto-reply.
- Se transcript e' vuoto, bassa confidence (`AMBROGIO_VOICE_STT_MIN_CONFIDENCE`), emergenza, clinico severo o legale: marcatura `human_handoff` e nessun outbound automatico.

Per risposte vocali outbound:
- Se `tenant_config.voice_replies_enabled = true`, genera anche una nota vocale con ElevenLabs Text-to-Speech.
- Default TTS: `eleven_flash_v2_5`, output `mp3_44100_128`, lingua `it`.
- Salva MP3 in storage tenant-scoped e URL in `messages.generated_audio_url`.
- Invia via WhatsApp come media audio.
- Non inviare vocali per emergenze, richieste cliniche/legali delicate o confidence bassa: usa testo breve + escalation.
- Non clonare la voce del titolare senza consenso scritto esplicito.

STEP 8 - Status updates

360dialog manda status updates (sent, delivered, read, failed):
- Update messages.status in DB
- Metrics per dashboard (tasso delivery, read rate)

STEP 9 - Number opt-out

Obbligo GDPR: utente puo' dire "STOP" e smettere di ricevere messaggi.
- Rileva parole chiave: stop, annulla, rimuovimi, cancellami, unsubscribe
- Salva in tabella opt_outs (tenant_id, customer_identifier, opted_out_at)
- Blocca futuri messaggi marketing/utility a quel numero
- Conferma opt-out via messaggio service

STEP 10 - Test end-to-end

Stato MVP fatto da Codex:
- `tests/server/e2e/whatsapp-booking-flow.test.ts` copre webhook inbound simulato, salvataggio messaggio, auto-reply, proposta slot, conferma booking, reschedule conversazionale, cancellazione e outbox.
- Il test usa repository e provider in-memory, quindi valida il percorso backend senza chiamate esterne reali.

Da aggiungere quando sono disponibili credenziali sandbox/reali:
1. script provider reale in `scripts/test-whatsapp.ts`;
2. invio messaggio via API al numero provider;
3. verifica consegna webhook reale;
4. verifica risposta finale al cliente;
5. report completo con request id, external message id e stato outbox.

REQUISITI DI SICUREZZA (non skippare):
- Header segreto custom obbligatorio su webhook 360dialog; HMAC `X-Hub-Signature-256` solo se disponibile e verificato per lo specifico account.
- Idempotenza obbligatoria su external message id/status id per evitare double-processing.
- Rate limiting per IP (100 req/min)
- Validation Zod su ogni payload
- Sanitization input (customer puo' mandare payload malicious)
- Escape caratteri speciali prima di salvare in DB (Supabase lo fa, ma verifica)
- Audit log di ogni messaggio ricevuto e inviato
- Monitoring via Sentry su errori webhook

FALLBACK E RESILIENZA:
- Se Anthropic API e' down: rispondi con messaggio "Ti rispondo a breve", notifica titolare
- Se DB e' down: queue message in Redis, processa quando torna up
- Se 360dialog e' down: outbox retry con backoff, alert se > 5 min down
- Deadletter queue per messaggi falliti dopo max attempts

Dopo aver completato, crea un report con:
- Architettura del flusso (diagramma testuale)
- Lista endpoint creati
- Env variables necessarie aggiuntive
- Setup richiesto in 360dialog dashboard
- Test eseguiti + risultati
