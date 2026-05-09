# WhatsApp Templates And 24h Window

## Fatto da Codex - 2026-04-25

Questo documento registra la policy backend implementata per Ambrogio.ai.

## Regola

- I messaggi free-form WhatsApp (`type='text'` nel nostro outbox payload) possono essere inviati solo mentre la customer service window e' aperta.
- La finestra dura 24 ore dall'ultimo messaggio ricevuto dal cliente e viene tracciata con `conversations.last_message_at`.
- I messaggi fuori finestra devono essere template approvati da Meta/360dialog (`type='template'`).
- Se il worker outbox non riesce a dimostrare che la finestra e' aperta, fallisce chiuso e marca il job `dead_letter`.

Riferimenti verificati il 25 aprile 2026:

- 360dialog Messaging Overview: customer service window e template fuori finestra.
  https://docs.360dialog.com/docs/messaging/overview
- 360dialog Templates: template approvati, stati e categorie.
  https://docs.360dialog.com/docs/resources/templates
- 360dialog Messages API: payload `type='template'`.
  https://docs.360dialog.com/docs/messaging-api/api-reference/messages

## Implementazione

- `src/server/whatsapp/client.ts`
  - `sendText()` invia free-form text.
  - `sendTemplate()` invia template tramite `POST /messages`.
- `src/server/whatsapp/outbox.ts`
  - valida payload `text` e `template`;
  - blocca text se `customerServiceWindowExpiresAt <= now`;
  - permette template anche fuori finestra;
  - salva `sendError.code='whatsapp_window_closed'` nei metadata quando blocca.
- `src/server/whatsapp/outbox-repository.ts`
  - legge `customer_service_window_expires_at` restituito dalla RPC.
- `src/server/whatsapp/templates.ts`
  - espone `enqueueTemplateMessage()` tramite `WhatsAppTemplateMessageService`;
  - verifica che il template sia `approved` per tenant, nome e lingua;
  - costruisce payload outbox `type='template'` per confirmation/reminder/cancellation;
  - usa `idempotencyKey` per evitare duplicati.
- `src/server/whatsapp/template-sync.ts`
  - legge `GET /v1/configs/templates` da 360dialog;
  - normalizza status/categorie provider;
  - aggiorna `whatsapp_message_templates`.
- `src/app/api/internal/jobs/whatsapp-template-sync/route.ts`
  - route interna protetta da `INTERNAL_JOB_SECRET`;
  - sincronizza i template di un tenant.
- `src/server/appointments/notifications.ts`
  - collega `appointments` a `enqueueTemplateMessage()`;
  - invia confirmation/reminder/cancellation solo tramite template approvati;
  - rispetta opt-out WhatsApp;
  - marca `confirmation_queued_at`, `reminder_24h_queued_at`, `reminder_1h_queued_at`, `cancellation_queued_at`.
- `src/app/api/internal/jobs/appointment-reminders/route.ts`
  - route interna protetta da `INTERNAL_JOB_SECRET`;
  - processa reminder 24h e 1h dovuti.
- `supabase/migrations/202604240001_initial_backend_mvp.sql`
  - `claim_whatsapp_outbox_jobs()` calcola `customer_service_window_expires_at`;
  - `whatsapp_message_templates` conserva registry tenant-scoped dei template.

## Payload supportati

Text:

```json
{
  "type": "text",
  "text": {
    "body": "Ciao, sono Ambrogio.",
    "previewUrl": false
  },
  "metadata": {
    "source": "ai_auto_reply"
  }
}
```

Template:

```json
{
  "type": "template",
  "template": {
    "name": "appointment_reminder_24h",
    "languageCode": "it",
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Mario" },
          { "type": "text", "text": "domani alle 10:00" }
        ]
      }
    ]
  },
  "metadata": {
    "source": "appointment_reminder"
  }
}
```

## Template MVP

Template utility previsti per appointment workflow:

- `appointment_confirmation`
- `appointment_reminder_24h`
- `appointment_reminder_1h`
- `appointment_cancellation`

Tutti richiedono `customerName`, `scheduledAt`, `studioName`; `appointment_confirmation` richiede anche `serviceName`.

## Appointment Workflow

- Conferma appuntamento: `AppointmentNotificationService.enqueueNotification({ kind: 'confirmation' })`.
- Reminder 24h/1h: `POST /api/internal/jobs/appointment-reminders` o chiamata diretta a `processDueReminders()`.
- Disdetta: `enqueueNotification({ kind: 'cancellation' })` dopo che l'appuntamento e' in stato `cancelled`.
- Idempotenza: `template:{templateName}:{appointmentId}:{kind}`.
- Se il cliente e' in `opt_outs`, il template non viene accodato.

## Test Policy

Fatto da Codex il 26 aprile 2026:

- `tests/server/whatsapp/outbox.test.ts` copre batch misto fuori finestra 24h:
  - job text/free-form marcato `dead_letter` con `sendError.code='whatsapp_window_closed'`;
  - job template nello stesso batch inviato correttamente;
  - nessuna chiamata `sendText()` quando la finestra e' chiusa.
- `tests/server/e2e/whatsapp-booking-flow.test.ts` copre opt-out E2E:
  - intent inbound analizzato;
  - nessun outbound accodato;
  - nessuna mutation dello stato booking conversazionale.
- `tests/server/whatsapp/webhook-service.test.ts` copre keyword opt-out:
  - `STOP` persiste `opt_outs`;
  - viene accodata una conferma service idempotente;
  - "annulla appuntamento" resta cancellation intent e non viene trattato come opt-out.
- `tests/server/whatsapp/opt-outs.test.ts` copre consultazione/revoca consenso:
  - stato tenant-scoped;
  - owner/admin required;
  - revoca idempotente;
  - audit log della revoca con IP, user agent, utente, stato precedente ed esito.

## Prossimo passo

- Creare o approvare i template reali nel 360dialog Hub/Meta.
- Gestire webhook status template (`template_message_update`) quando disponibile nel setup reale.
- Collegare il pannello settings/inbox alla gestione consenso WhatsApp owner/admin.
