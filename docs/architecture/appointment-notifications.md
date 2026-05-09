# Appointment Notifications

## Fatto da Codex - 2026-04-25

Ambrogio.ai ora ha una prima slice backend per notifiche appuntamento via template WhatsApp.

## Moduli

- `src/server/appointments/notifications.ts`
  - `AppointmentNotificationService`
  - `SupabaseAppointmentNotificationRepository`
- `src/app/api/internal/jobs/appointment-reminders/route.ts`
  - worker interno per reminder 24h/1h
- `src/server/whatsapp/templates.ts`
  - accoda template approvati in outbox

## Flussi

Conferma:

1. Booking crea `appointments` con `status='confirmed'`.
2. Backend chiama `enqueueNotification({ kind: 'confirmation' })`.
3. Il servizio legge tenant, appointment, conversation e tenant_config.
4. Verifica opt-out WhatsApp.
5. Accoda `appointment_confirmation`.
6. Marca `appointments.confirmation_queued_at`.

Reminder:

1. Scheduler chiama `POST /api/internal/jobs/appointment-reminders`.
2. Il worker cerca appuntamenti confermati:
   - 1h: `scheduled_at` entro 1 ora e `reminder_1h_queued_at is null`;
   - 24h: `scheduled_at` tra 1h e 24h e `reminder_24h_queued_at is null`.
3. Accoda `appointment_reminder_1h` o `appointment_reminder_24h`.
4. Marca il relativo `*_queued_at` e `reminded_at`.

Disdetta:

1. Backend imposta appointment `status='cancelled'`.
2. Backend chiama `enqueueNotification({ kind: 'cancellation' })`.
3. Accoda `appointment_cancellation`.
4. Marca `appointments.cancellation_queued_at`.

## Guardrail

- Non invia reminder per appuntamenti non `confirmed`.
- Non invia cancellation per appuntamenti non `cancelled`.
- Non invia nulla se manca `conversation_id` o recipient WhatsApp.
- Rispetta `opt_outs`.
- Usa idempotenza `appointmentId:kind` nel template helper.
- Un duplicate outbound viene considerato gia' accodato e marca il relativo `*_queued_at` per evitare loop.

## Prossimo passo

- Il servizio booking base e' stato creato da Codex in `src/server/appointments/booking.ts`.
- `AppointmentBookingService.createAppointment()` chiama gia' `enqueueNotification({ kind: 'confirmation' })` dopo booking riuscito.
- Collegare ora AI intent booking a `AppointmentBookingService`.
- Chiamare cancellation notification dopo cancel su calendario + update appointment.
