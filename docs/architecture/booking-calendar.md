# Booking Calendar - Ambrogio.ai

Fatto da Codex il 25 aprile 2026.

## Obiettivo

Preparare una base booking solida per beta: Ambrogio puo' proporre slot, confermare appuntamenti, spostarli, cancellarli, sincronizzare Google Calendar e accodare notifiche WhatsApp.

## Moduli

- `src/server/appointments/booking.ts`
  - `AppointmentBookingService.getAvailableSlots()`
  - `AppointmentBookingService.createAppointment()`
  - `AppointmentBookingService.rescheduleAppointment()`
  - `AppointmentBookingService.cancelAppointment()`
  - repository Supabase per tenant, servizi, business hours, appuntamenti e integration Google.
- `src/server/calendar/google.ts`
  - `GoogleCalendarProvider.listBusy()` usando Google Calendar `freeBusy`;
  - `GoogleCalendarProvider.createEvent()` usando Google Calendar `events.insert`;
  - `GoogleCalendarProvider.updateEvent()` usando Google Calendar `events.patch`;
  - `GoogleCalendarProvider.cancelEvent()` usando Google Calendar `events.delete`;
  - legge credenziali cifrate;
  - refresh access token da `refresh_token` quando serve;
  - persiste il nuovo access token cifrato tramite callback repository.
- `src/server/integrations/google-calendar-oauth.ts`
  - costruisce URL OAuth con state firmato;
  - scambia `code` -> token;
  - salva `access_token` e `refresh_token` cifrati in `integrations.credentials`;
  - disconnette/revoca token Google.
- `src/server/integrations/credential-encryption.ts`
  - cifra segreti provider con AES-256-GCM;
  - mantiene compatibilita' con credenziali legacy in chiaro nei test.
- `src/server/ai/booking-bridge.ts`
  - propone slot dentro le risposte WhatsApp quando l'intent e' `booking_request`;
  - usa `src/server/ai/booking-extractor.ts` per estrarre servizio, data, fascia oraria, urgenza e dati cliente;
  - filtra gli slot proposti in base a preferenze come "domani pomeriggio" o "giovedi dopo le 18";
  - salva lo stato slot proposti in `conversations.metadata.ambrogioBooking`;
  - conferma slot con risposte tipo "confermo 1";
  - chiama `AppointmentBookingService.createAppointment()`;
  - gestisce `reschedule_request` cercando appuntamenti futuri dal numero WhatsApp, proponendo nuovi slot e chiamando `rescheduleAppointment()`;
  - gestisce `cancellation_request` cercando appuntamenti futuri dal numero WhatsApp e chiamando `cancelAppointment()`.
- Route interne protette da `INTERNAL_JOB_SECRET`:
  - `POST /api/internal/booking/availability`
  - `POST /api/internal/booking/appointments`
  - `PATCH /api/internal/booking/appointments`
  - `DELETE /api/internal/booking/appointments`
- Route OAuth tenant-authenticated:
  - `GET /api/integrations/google-calendar/status`
  - `GET /api/integrations/google-calendar/connect`
  - `GET /api/integrations/google-calendar/callback`
  - `POST /api/integrations/google-calendar/disconnect`

Fonti primarie consultate:

- Google Calendar FreeBusy query: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- Google Calendar Events insert/update/delete: https://developers.google.com/workspace/calendar/api/v3/reference/events

## Availability

Input minimo:

- `tenantId`
- `serviceId`
- `from`
- `to`

Regole applicate:

- legge `services.duration_minutes`;
- legge `tenant_config.booking_min_lead_minutes`;
- legge `tenant_config.booking_slot_step_minutes`;
- legge `tenant_config.booking_buffer_minutes`;
- legge `tenant_config.booking_max_days_ahead`;
- usa `business_hours` nella timezone tenant;
- esclude appuntamenti locali `confirmed`;
- se `integrations.provider='google_calendar'` e `status='active'`, esclude anche i busy intervals Google Calendar;
- ritorna max slot configurabile, default 5.

## Creazione Appuntamento

`createAppointment()`:

1. valida servizio attivo e slot richiesto;
2. ricontrolla availability per lo slot esatto;
3. inserisce `appointments`;
4. se Google Calendar e' configurato, crea evento e aggiorna:
   - `calendar_event_id`;
   - `calendar_event_html_link`;
   - `calendar_sync_status='synced'`;
5. se Google fallisce, marca `calendar_sync_status='failed'` e interrompe la conferma salvo `requireCalendarSync=false`;
6. se booking completato, chiama `AppointmentNotificationService.enqueueNotification({ kind: 'confirmation' })`.

## Reschedule Appuntamento

`rescheduleAppointment()`:

1. legge l'appuntamento confermato e il servizio collegato;
2. ricontrolla availability per il nuovo slot escludendo l'appuntamento originale;
3. aggiorna `scheduled_at`, durata, note e resetta marker reminder/conferma;
4. se Google Calendar e' configurato, chiama `events.patch` oppure crea l'evento mancante;
5. marca `calendar_sync_status='synced'` o `failed`;
6. accoda una nuova conferma WhatsApp con idempotency scope basato sul nuovo orario.

## Cancellazione Appuntamento

`cancelAppointment()`:

1. legge l'appuntamento confermato;
2. se Google Calendar e' configurato e l'evento esiste, chiama `events.delete`;
3. marca l'appuntamento `status='cancelled'`;
4. salva lo stato sync calendar;
5. accoda notifica WhatsApp `appointment_cancellation`.

## Flow Conversazionale WhatsApp

Il ponte booking ora usa lo stesso metadata key `ambrogioBooking` per stati diversi:

- `slots_proposed`: prenotazione nuova;
- `reschedule_appointment_selection`: piu appuntamenti futuri trovati, serve scelta;
- `reschedule_date_requested`: appuntamento trovato, serve nuova data/fascia;
- `reschedule_slots_proposed`: nuovi slot proposti;
- `cancellation_selection`: piu appuntamenti futuri trovati, serve scelta.

Il bridge puo' essere chiamato anche se l'intent corrente e' `other`, cosi risposte brevi come "1" o "confermo 2" usano lo stato conversazionale gia' salvato.

Fatto da Codex il 26 aprile 2026: il lookup appuntamenti ora usa anche indizi naturali nel testo cliente:

- giorno/data, per esempio "quello di domani";
- orario o fascia, per esempio "quello delle 15" o "mattina";
- nome cliente salvato sull'appuntamento, per esempio "la visita di Mario";
- servizio citato, per esempio "igiene" o "prima visita".

Nel reschedule, frasi come "sposta quello di domani" vengono trattate come ricerca dell'appuntamento sorgente: dopo aver trovato l'appuntamento, Ambrogio chiede la nuova data/fascia invece di riusare "domani" come target.

Sempre fatto da Codex il 26 aprile 2026: il bridge copre anche casi sorgente + target nella stessa frase. Esempi coperti:

- "sposta la visita di Mario a venerdi mattina": usa "Mario" e il servizio per trovare l'appuntamento esistente, ma conserva "venerdi mattina" come nuova preferenza di disponibilita';
- "sposta quello di domani a venerdi mattina": usa "domani" per trovare l'appuntamento sorgente e "venerdi mattina" per cercare i nuovi slot.

La suite `tests/server/ai/booking-extraction-evals.test.ts` blocca questi casi come eval fixture deterministic.

## Test E2E Backend

`tests/server/e2e/whatsapp-booking-flow.test.ts` simula il percorso WhatsApp backend senza provider esterni:

1. inbound webhook testuale per prenotare;
2. proposta slot;
3. conferma booking;
4. richiesta reschedule;
5. proposta nuovi slot;
6. conferma reschedule;
7. cancellation;
8. verifica appointment, outbox, usage e intent analysis.

Fatto da Codex il 26 aprile 2026: la stessa suite copre anche il percorso vocale senza provider esterni:

1. webhook audio WhatsApp;
2. enqueue voice job;
3. download/storage/STT fake;
4. transcript passato a `WhatsAppAutoReplyService`;
5. proposta slot via booking bridge;
6. conferma testuale dello slot;
7. creazione appointment e completamento voice job.

Fatto da Codex il 26 aprile 2026: la suite copre anche opt-out E2E. Ambrogio analizza l'intent inbound, ma non accoda auto-reply, non chiama availability e non salva stato booking quando il cliente WhatsApp e' opted-out. Il webhook persiste inoltre keyword opt-out come `STOP`, `unsubscribe`, `rimuovimi`, `cancellami` e frasi tipo "non scrivetemi", senza confonderle con "annulla appuntamento". Dopo una keyword opt-out, accoda una conferma service idempotente separata dall'auto-reply.

Route consenso owner/admin:

- `GET /api/whatsapp/opt-outs?customerIdentifier=<numero>`: stato opt-out WhatsApp tenant-scoped;
- `DELETE /api/whatsapp/opt-outs?customerIdentifier=<numero>`: revoca opt-out idempotente.

Fatto da Codex il 26 aprile 2026: ogni revoca consenso WhatsApp scrive anche `audit_log` con tenant, utente, IP, user agent, numero normalizzato, esito idempotente e stato precedente dell'opt-out.

## Anti Double Booking

La migrazione aggiunge:

- `create extension if not exists "btree_gist"`;
- constraint `appointments_no_confirmed_overlap`;
- indice `appointments_tenant_status_scheduled_idx`.

Il constraint impedisce overlap tra appointment `confirmed` dello stesso tenant usando `tstzrange(scheduled_at, scheduled_at + duration_minutes)`.

## Limiti Noti

- Non ci sono ancora chiusure straordinarie/ferie.
- L'estrattore booking e' rule-based: copre preferenze comuni in italiano e ha fixture eval deterministic, ma non usa ancora un adapter AI strutturato per frasi molto complesse o ambigue.
- Le route OAuth richiedono sessione Supabase e claim tenant/role gia' configurati.

## Prossimo Step

Rafforzare il booking conversazionale:

1. UI dashboard settings per consumare status/connect/disconnect Google Calendar;
2. adapter AI provider-aware ed eval fixtures per migliorare l'estrazione booking oltre le regole;
3. pannello inbox/settings per consultare e revocare consenso WhatsApp usando le API owner/admin;
4. aggiungere eval AI strutturata quando sara' collegato un extractor LLM dedicato.
