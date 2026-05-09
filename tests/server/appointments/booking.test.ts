import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import {
  AppointmentBookingService,
  type AppointmentBookingRepository,
  type AppointmentCalendarProvider,
  type AppointmentForChange,
  type AppointmentNotificationEnqueuer,
  type AppointmentStatus,
  type BookingServiceContext,
  type CalendarSyncStatus,
  type CreatedAppointment,
  type InsertAppointmentInput,
} from '@/server/appointments/booking';
import type { CalendarBusyInterval, GoogleCalendarEventResult } from '@/server/calendar/google';

const now = new Date('2026-04-27T07:00:00.000Z');

describe('AppointmentBookingService', () => {
  it('returns business-hour slots excluding local and Google busy intervals', async () => {
    const repository = new FakeBookingRepository();
    repository.localBusy = [busy('2026-04-27T09:30:00.000Z', '2026-04-27T10:00:00.000Z')];
    const calendar = new FakeCalendarProvider([
      busy('2026-04-27T10:30:00.000Z', '2026-04-27T11:00:00.000Z'),
    ]);
    const service = new AppointmentBookingService(
      repository,
      calendar,
      new FakeNotificationEnqueuer(),
    );

    const slots = await service.getAvailableSlots({
      tenantId: 'tenant_1',
      serviceId: 'service_1',
      from: new Date('2026-04-27T09:00:00.000Z'),
      to: new Date('2026-04-27T12:00:00.000Z'),
      now,
      maxSlots: 10,
      slotStepMinutes: 30,
    });

    expect(slots.map((slot) => slot.start)).toEqual([
      '2026-04-27T09:00:00.000Z',
      '2026-04-27T10:00:00.000Z',
      '2026-04-27T11:00:00.000Z',
      '2026-04-27T11:30:00.000Z',
    ]);
  });

  it('creates an appointment, syncs Google Calendar and queues confirmation', async () => {
    const repository = new FakeBookingRepository();
    const calendar = new FakeCalendarProvider();
    const notifications = new FakeNotificationEnqueuer();
    const service = new AppointmentBookingService(repository, calendar, notifications);

    const result = await service.createAppointment({
      tenantId: 'tenant_1',
      serviceId: 'service_1',
      appointmentId: 'appointment_1',
      conversationId: 'conversation_1',
      customerIdentifier: '393331112233',
      customerName: 'Mario Rossi',
      customerPhone: '393331112233',
      scheduledAt: new Date('2026-04-27T09:00:00.000Z'),
      now,
    });

    expect(result).toMatchObject({
      appointmentId: 'appointment_1',
      calendarSyncStatus: 'synced',
      calendarEventId: 'event_1',
      confirmationQueued: true,
      confirmationErrorCode: null,
    });
    expect(repository.insertedAppointments[0]).toMatchObject({
      id: 'appointment_1',
      bookingSource: 'whatsapp_ai',
      calendarProvider: 'google_calendar',
      calendarSyncStatus: 'pending',
    });
    expect(calendar.createdEvents[0]).toMatchObject({
      appointmentId: 'appointment_1',
      summary: 'Studio Ambrogio: Prima visita - Mario Rossi',
    });
    expect(repository.calendarSyncUpdates[0]).toMatchObject({
      appointmentId: 'appointment_1',
      status: 'synced',
      eventId: 'event_1',
    });
    expect(notifications.calls[0]).toEqual({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      kind: 'confirmation',
      now,
    });
  });

  it('rejects unavailable appointment slots before inserting', async () => {
    const repository = new FakeBookingRepository();
    repository.localBusy = [busy('2026-04-27T09:00:00.000Z', '2026-04-27T09:30:00.000Z')];
    const service = new AppointmentBookingService(
      repository,
      new FakeCalendarProvider(),
      new FakeNotificationEnqueuer(),
    );

    await expect(
      service.createAppointment({
        tenantId: 'tenant_1',
        serviceId: 'service_1',
        customerIdentifier: '393331112233',
        customerName: 'Mario Rossi',
        scheduledAt: new Date('2026-04-27T09:00:00.000Z'),
        now,
      }),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Requested appointment slot is unavailable',
    });
    expect(repository.insertedAppointments).toHaveLength(0);
  });

  it('marks calendar sync failed and stops confirmation when Google fails', async () => {
    const repository = new FakeBookingRepository();
    const calendar = new FakeCalendarProvider();
    calendar.createError = new AppError('upstream_error', 'Google Calendar event insert failed');
    const notifications = new FakeNotificationEnqueuer();
    const service = new AppointmentBookingService(repository, calendar, notifications);

    await expect(
      service.createAppointment({
        tenantId: 'tenant_1',
        serviceId: 'service_1',
        appointmentId: 'appointment_1',
        customerIdentifier: '393331112233',
        customerName: 'Mario Rossi',
        scheduledAt: new Date('2026-04-27T09:00:00.000Z'),
        now,
      }),
    ).rejects.toMatchObject({
      code: 'upstream_error',
    });
    expect(repository.calendarSyncUpdates[0]).toMatchObject({
      appointmentId: 'appointment_1',
      status: 'failed',
    });
    expect(notifications.calls).toHaveLength(0);
  });

  it('supports tenants without Google Calendar integration', async () => {
    const repository = new FakeBookingRepository({
      googleCalendarIntegration: null,
    });
    const calendar = new FakeCalendarProvider();
    const notifications = new FakeNotificationEnqueuer();
    const service = new AppointmentBookingService(repository, calendar, notifications);

    const result = await service.createAppointment({
      tenantId: 'tenant_1',
      serviceId: 'service_1',
      appointmentId: 'appointment_1',
      customerIdentifier: '393331112233',
      customerName: 'Mario Rossi',
      scheduledAt: new Date('2026-04-27T09:00:00.000Z'),
      now,
    });

    expect(result).toMatchObject({
      calendarSyncStatus: 'not_configured',
      calendarEventId: null,
      confirmationQueued: true,
    });
    expect(calendar.createdEvents).toHaveLength(0);
  });

  it('reschedules an appointment, updates Google Calendar and queues a scoped confirmation', async () => {
    const repository = new FakeBookingRepository();
    repository.appointments.set('appointment_1', appointmentForChange());
    const calendar = new FakeCalendarProvider();
    const notifications = new FakeNotificationEnqueuer();
    const service = new AppointmentBookingService(repository, calendar, notifications);

    const result = await service.rescheduleAppointment({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      scheduledAt: new Date('2026-04-27T10:00:00.000Z'),
      now,
    });

    expect(result).toMatchObject({
      appointmentId: 'appointment_1',
      status: 'confirmed',
      calendarSyncStatus: 'synced',
      notificationQueued: true,
    });
    expect(repository.scheduleUpdates[0]).toMatchObject({
      appointmentId: 'appointment_1',
      scheduledAt: new Date('2026-04-27T10:00:00.000Z'),
      calendarSyncStatus: 'pending',
    });
    expect(repository.lastLocalBusyInput).toMatchObject({
      excludeAppointmentId: 'appointment_1',
    });
    expect(calendar.updatedEvents[0]).toMatchObject({
      eventId: 'event_1',
      appointmentId: 'appointment_1',
      summary: 'Studio Ambrogio: Prima visita - Mario Rossi',
    });
    expect(notifications.calls[0]).toMatchObject({
      kind: 'confirmation',
      idempotencyScope: 'rescheduled:2026-04-27T10:00:00.000Z',
    });
  });

  it('creates a missing Google Calendar event during reschedule', async () => {
    const repository = new FakeBookingRepository();
    repository.appointments.set(
      'appointment_1',
      appointmentForChange({
        calendarEventId: null,
        calendarEventHtmlLink: null,
      }),
    );
    const calendar = new FakeCalendarProvider();
    const service = new AppointmentBookingService(
      repository,
      calendar,
      new FakeNotificationEnqueuer(),
    );

    const result = await service.rescheduleAppointment({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      scheduledAt: new Date('2026-04-27T10:00:00.000Z'),
      now,
    });

    expect(result).toMatchObject({
      calendarSyncStatus: 'synced',
      calendarEventId: 'event_1',
    });
    expect(calendar.createdEvents[0]).toMatchObject({
      appointmentId: 'appointment_1',
    });
    expect(calendar.updatedEvents).toHaveLength(0);
  });

  it('cancels an appointment, deletes Google Calendar event and queues cancellation', async () => {
    const repository = new FakeBookingRepository();
    repository.appointments.set('appointment_1', appointmentForChange());
    const calendar = new FakeCalendarProvider();
    const notifications = new FakeNotificationEnqueuer();
    const service = new AppointmentBookingService(repository, calendar, notifications);

    const result = await service.cancelAppointment({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      now,
    });

    expect(result).toMatchObject({
      appointmentId: 'appointment_1',
      status: 'cancelled',
      calendarSyncStatus: 'synced',
      notificationQueued: true,
    });
    expect(calendar.cancelledEvents[0]).toEqual({
      integration: repository.context.googleCalendarIntegration,
      eventId: 'event_1',
    });
    expect(repository.cancelUpdates[0]).toMatchObject({
      appointmentId: 'appointment_1',
      calendarSyncStatus: 'synced',
    });
    expect(notifications.calls[0]).toMatchObject({
      kind: 'cancellation',
    });
  });
});

class FakeBookingRepository implements AppointmentBookingRepository {
  readonly context: BookingServiceContext;
  localBusy: CalendarBusyInterval[] = [];
  insertedAppointments: InsertAppointmentInput[] = [];
  appointments = new Map<string, AppointmentForChange>();
  lastLocalBusyInput: {
    tenantId: string;
    from: Date;
    to: Date;
    excludeAppointmentId?: string;
  } | null = null;
  calendarSyncUpdates: Array<{
    appointmentId: string;
    status: CalendarSyncStatus;
    eventId?: string | null;
    htmlLink?: string | null;
    errorMessage?: string | null;
  }> = [];
  scheduleUpdates: Array<{
    tenantId: string;
    appointmentId: string;
    scheduledAt: Date;
    durationMinutes: number;
    notes: string | null;
    calendarSyncStatus: CalendarSyncStatus;
  }> = [];
  cancelUpdates: Array<{
    tenantId: string;
    appointmentId: string;
    calendarSyncStatus: CalendarSyncStatus;
    errorMessage?: string | null;
  }> = [];

  constructor(overrides: Partial<BookingServiceContext> = {}) {
    this.context = {
      tenantId: 'tenant_1',
      timezone: 'UTC',
      studioName: 'Studio Ambrogio',
      address: 'Via Roma 1',
      bookingMinLeadMinutes: 0,
      bookingSlotStepMinutes: 30,
      bookingBufferMinutes: 0,
      bookingMaxDaysAhead: 30,
      service: {
        id: 'service_1',
        name: 'Prima visita',
        durationMinutes: 30,
        active: true,
      },
      businessHours: [
        {
          weekday: 1,
          opensAt: '09:00:00',
          closesAt: '12:00:00',
        },
      ],
      googleCalendarIntegration: {
        id: 'integration_1',
        tenantId: 'tenant_1',
        externalAccountId: null,
        credentials: { access_token: 'access_1' },
        config: { calendar_id: 'primary' },
      },
      ...overrides,
    };
  }

  async getBookingContext(): Promise<BookingServiceContext | null> {
    return this.context;
  }

  async listLocalBusyIntervals(input: {
    tenantId: string;
    from: Date;
    to: Date;
    excludeAppointmentId?: string;
  }): Promise<CalendarBusyInterval[]> {
    this.lastLocalBusyInput = input;
    return this.localBusy;
  }

  async insertAppointment(input: InsertAppointmentInput): Promise<CreatedAppointment> {
    this.insertedAppointments.push(input);

    return {
      id: input.id,
      tenantId: input.tenantId,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      calendarSyncStatus: input.calendarSyncStatus,
      calendarEventId: null,
      calendarEventHtmlLink: null,
    };
  }

  async updateAppointmentCalendarSync(input: {
    tenantId: string;
    appointmentId: string;
    status: CalendarSyncStatus;
    eventId?: string | null;
    htmlLink?: string | null;
    errorMessage?: string | null;
  }): Promise<void> {
    this.calendarSyncUpdates.push(input);
  }

  async updateGoogleCalendarAccessToken(): Promise<void> {}

  async getAppointmentForChange(input: {
    appointmentId: string;
  }): Promise<AppointmentForChange | null> {
    return this.appointments.get(input.appointmentId) ?? null;
  }

  async updateAppointmentSchedule(input: {
    tenantId: string;
    appointmentId: string;
    scheduledAt: Date;
    durationMinutes: number;
    notes: string | null;
    calendarSyncStatus: CalendarSyncStatus;
  }): Promise<void> {
    this.scheduleUpdates.push(input);
    const existing = this.appointments.get(input.appointmentId);

    if (existing) {
      this.appointments.set(input.appointmentId, {
        ...existing,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes,
        notes: input.notes,
        calendarSyncStatus: input.calendarSyncStatus,
      });
    }
  }

  async cancelAppointmentRecord(input: {
    tenantId: string;
    appointmentId: string;
    calendarSyncStatus: CalendarSyncStatus;
    errorMessage?: string | null;
  }): Promise<void> {
    this.cancelUpdates.push(input);
    const existing = this.appointments.get(input.appointmentId);

    if (existing) {
      this.appointments.set(input.appointmentId, {
        ...existing,
        status: 'cancelled',
        calendarSyncStatus: input.calendarSyncStatus,
      });
    }
  }
}

class FakeCalendarProvider implements AppointmentCalendarProvider {
  readonly createdEvents: Array<{
    appointmentId: string;
    summary: string;
  }> = [];
  readonly updatedEvents: Array<{
    eventId: string;
    appointmentId: string;
    summary: string;
  }> = [];
  readonly cancelledEvents: Array<{
    integration: unknown;
    eventId: string;
  }> = [];
  createError: Error | null = null;
  updateError: Error | null = null;
  cancelError: Error | null = null;

  constructor(private readonly busyIntervals: CalendarBusyInterval[] = []) {}

  async listBusy(): Promise<CalendarBusyInterval[]> {
    return this.busyIntervals;
  }

  async createEvent(input: {
    appointmentId: string;
    summary: string;
  }): Promise<GoogleCalendarEventResult> {
    if (this.createError) {
      throw this.createError;
    }

    this.createdEvents.push(input);

    return {
      eventId: 'event_1',
      htmlLink: 'https://calendar.google.com/event?eid=event_1',
      raw: {},
    };
  }

  async updateEvent(input: {
    eventId: string;
    appointmentId: string;
    summary: string;
  }): Promise<GoogleCalendarEventResult> {
    if (this.updateError) {
      throw this.updateError;
    }

    this.updatedEvents.push(input);

    return {
      eventId: input.eventId,
      htmlLink: 'https://calendar.google.com/event?eid=event_1',
      raw: {},
    };
  }

  async cancelEvent(input: {
    integration: unknown;
    eventId: string;
  }): Promise<{ cancelled: true }> {
    if (this.cancelError) {
      throw this.cancelError;
    }

    this.cancelledEvents.push(input);
    return { cancelled: true };
  }
}

class FakeNotificationEnqueuer implements AppointmentNotificationEnqueuer {
  calls: Array<{
    tenantId: string;
    appointmentId: string;
    kind: 'confirmation' | 'cancellation';
    idempotencyScope?: string;
    now?: Date;
  }> = [];

  async enqueueNotification(input: {
    tenantId: string;
    appointmentId: string;
    kind: 'confirmation' | 'cancellation';
    idempotencyScope?: string;
    now?: Date;
  }): Promise<{ queued: boolean }> {
    this.calls.push(input);
    return { queued: true };
  }
}

function busy(start: string, end: string): CalendarBusyInterval {
  return {
    start: new Date(start),
    end: new Date(end),
    source: 'local_appointment',
  };
}

function appointmentForChange(overrides: Partial<AppointmentForChange> = {}): AppointmentForChange {
  return {
    id: 'appointment_1',
    tenantId: 'tenant_1',
    conversationId: 'conversation_1',
    serviceId: 'service_1',
    serviceName: 'Prima visita',
    customerIdentifier: '393331112233',
    customerName: 'Mario Rossi',
    customerPhone: '393331112233',
    scheduledAt: new Date('2026-04-27T09:00:00.000Z'),
    durationMinutes: 30,
    status: 'confirmed' as AppointmentStatus,
    calendarProvider: 'google_calendar',
    calendarSyncStatus: 'synced',
    calendarEventId: 'event_1',
    calendarEventHtmlLink: 'https://calendar.google.com/event?eid=event_1',
    notes: null,
    ...overrides,
  };
}
