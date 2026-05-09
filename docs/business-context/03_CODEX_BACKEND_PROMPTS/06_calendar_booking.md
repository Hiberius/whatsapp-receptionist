# PROMPT 06 - CALENDAR INTEGRATION E BOOKING

## PROMPT OPERATIVO CODEX

Implementa integrazione con Google Calendar come primary + supporto Cal.com e Calendly come alternative.

Nota 2026-04-25 - Fatto da Codex:

- Base booking/calendar gia' implementata in `src/server/appointments/booking.ts`.
- Provider Google Calendar gia' implementato in `src/server/calendar/google.ts`.
- Bridge WhatsApp AI -> booking gia' implementato in `src/server/ai/booking-bridge.ts`.
- Route interne gia' disponibili:
  - `POST /api/internal/booking/availability`;
  - `POST /api/internal/booking/appointments`;
  - `PATCH /api/internal/booking/appointments`;
  - `DELETE /api/internal/booking/appointments`.
- Test gia' presenti:
  - `tests/server/appointments/booking.test.ts`;
  - `tests/server/calendar/google.test.ts`.
- Estrattore booking rule-based gia' implementato in `src/server/ai/booking-extractor.ts` per servizio, data, fascia oraria, urgenza, nome e telefono.
- OAuth Google Calendar connect/callback/disconnect gia' implementato da Codex con state firmato, token cifrati e refresh persistito.
- Status API Google Calendar gia' implementata per dashboard settings.
- Reschedule/cancel calendar-aware gia' implementati da Codex con update/delete evento Google, route interne protette e notifiche WhatsApp.
- Mancano ancora UI dashboard settings per usare OAuth ed estrazione AI strutturata con eval per frasi complesse.

STEP 1 - Google Calendar OAuth

Stato: completato da Codex.

File creati:
- `src/app/api/integrations/google-calendar/connect/route.ts`: inizia OAuth flow;
- `src/app/api/integrations/google-calendar/callback/route.ts`: riceve token e salva credenziali cifrate;
- `src/app/api/integrations/google-calendar/disconnect/route.ts`: revoca token e marca integration `revoked`;
- `src/app/api/integrations/google-calendar/status/route.ts`: stato safe per dashboard;
- `src/server/integrations/google-calendar-oauth.ts`;
- `src/server/integrations/credential-encryption.ts`;
- `src/server/integrations/oauth-state.ts`.

Scopes richiesti: calendar.events.readonly, calendar.events.

Refresh token salvato cifrato per refresh automatico.

STEP 2 - Calendar service layer

Stato: base completata da Codex in:

- `src/server/calendar/google.ts`;
- `src/server/appointments/booking.ts`.

Non creare un secondo layer duplicato in `src/lib/calendar/google-calendar.ts` senza motivo. Estendere quello esistente.

Contratto gia' disponibile:

Funzioni:
- getAvailableSlots(tenantId, dateFrom, dateTo, duration): ritorna array slot liberi
- createEvent(tenantId, appointmentData): crea evento Google Calendar
- updateEvent(tenantId, eventId, changes)
- cancelEvent(tenantId, eventId)
- listUpcoming(tenantId): prossimi 20 eventi

Logica getAvailableSlots:
1. Carica calendario tenant
2. Leggi busy slots (events esistenti)
3. Leggi orari apertura studio (da tenant config)
4. Calcola slot liberi: orario_apertura - busy - pause_pranzo
5. Rispetta buffer time tra appuntamenti (default 15 min)
6. Non proporre slot prima di +2h da now (per esigenze logistiche)
7. Proponi max 5 slot distribuiti nei prossimi 7 giorni

STEP 3 - Abstraction layer

Stato: base completata da Codex come interfaccia `AppointmentCalendarProvider` in `src/server/appointments/booking.ts`.

Se servono Cal.com/Calendly, aggiungere provider separati senza cambiare il service booking.

```typescript
interface CalendarProvider {
  getAvailableSlots(params): Promise<Slot[]>
  createEvent(params): Promise<string> // ritorna event_id
  updateEvent(eventId, changes): Promise<void>
  cancelEvent(eventId): Promise<void>
}
```

Implementazioni: GoogleCalendarProvider, CalComProvider, CalendlyProvider.

Factory: getCalendarProvider(tenantId) ritorna il provider giusto.

STEP 4 - Booking flow completo

Stato: base completata da Codex in `src/server/appointments/booking.ts`.

Contratti attuali:

- `getAvailableSlots(input)`;
- `createAppointment(input)`;
- `rescheduleAppointment(input)`;
- `cancelAppointment(input)`;
- `BookingBridgeService.createBookingReply(input)`;
- Google Calendar optional se `integrations.provider='google_calendar'`;
- conferma/cancellazione WhatsApp via `AppointmentNotificationService` dopo booking riuscito o cancel.

Da completare:

- proposeSlots(tenantId, preferredDate, serviceType): base fatta da Codex con `BookingBridgeService` + extractor rule-based; completare con adapter AI/eval fixtures
- confirmBooking(slot, customerData): usare `AppointmentBookingService.createAppointment()`
- sendConfirmation(appointmentId): Fatto da Codex come backend slice in `src/server/appointments/notifications.ts`, usando `AppointmentNotificationService.enqueueNotification({ kind: 'confirmation' })`
- rescheduleBooking(appointmentId, newSlot): backend service e flow conversazionale completati da Codex
- cancelBooking(appointmentId, reason): backend service e flow conversazionale completati da Codex

Handle concurrent booking: Fatto da Codex lato DB con constraint `appointments_no_confirmed_overlap`. Redis lock resta opzionale per UX/latency, non come unica garanzia.

STEP 5 - Reminder system

- Base gia' preparata da Codex:
  - `src/app/api/internal/jobs/appointment-reminders/route.ts`
  - `AppointmentNotificationService.processDueReminders()`
  - marker DB `reminder_24h_queued_at`, `reminder_1h_queued_at`
- 24h prima appuntamento: send reminder template WhatsApp
- 1h prima: send reminder
- 30 min prima: send location/info se visita in presenza

Utente puo' disattivare reminder da link in messaggio (opt-out granulare).

STEP 6 - Business hours configuration

Stato backend: colonne di configurazione base gia' aggiunte da Codex:

- `tenant_config.booking_min_lead_minutes`;
- `tenant_config.booking_slot_step_minutes`;
- `tenant_config.booking_buffer_minutes`;
- `tenant_config.booking_max_days_ahead`;
- tabella `business_hours` gia' usata da `AppointmentBookingService`.

UI in dashboard per tenant:
- Orari per ogni giorno settimana (es. lun-ven 9-13, 15-19, sab 9-13, dom chiuso)
- Ferie e chiusure straordinarie (date range)
- Durata default appuntamento per tipo servizio
- Buffer time tra appuntamenti
- Max bookings al giorno

Storage in tenants.config jsonb o tabella business_hours dedicata.

STEP 7 - Smart scheduling

Features avanzate (fase 2):
- AI propone slot in base a storico cliente (se preferisce mattina, proponi mattina)
- Optimal slot packing (evita buchi nel calendario)
- No-show prediction: flag clienti con alto tasso no-show, richiede conferma anticipata

STEP 8 - Test

Stato MVP fatto da Codex:
- `tests/server/e2e/whatsapp-booking-flow.test.ts` copre booking flow end-to-end via WhatsApp simulato.
- La stessa suite copre reschedule flow e cancel flow attraversando webhook, auto-reply, orchestrator, bridge booking e appointment service fake.

Da aggiungere:
- Conflict detection (cliente prenota slot appena occupato da altro)
- No-show handling
- Playwright solo quando esiste UI/backoffice o una preview deploy da attraversare.

Coverage > 80% su modulo calendar.
