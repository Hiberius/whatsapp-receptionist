import { randomUUID } from 'node:crypto';

import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  GoogleCalendarProvider,
  type CalendarBusyInterval,
  type GoogleCalendarEventResult,
  type GoogleCalendarIntegration,
} from '@/server/calendar/google';
import { createAppointmentNotificationService } from '@/server/appointments/notifications';
import { encryptedCredentialPatch } from '@/server/integrations/credential-encryption';

export type BookingSource = 'manual' | 'whatsapp_ai' | 'dashboard' | 'api';
export type CalendarSyncStatus = 'not_configured' | 'pending' | 'synced' | 'failed';
export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export type BookingSlot = {
  tenantId: string;
  serviceId: string;
  serviceName: string;
  start: string;
  end: string;
  durationMinutes: number;
  timezone: string;
};

export type BookingServiceContext = {
  tenantId: string;
  timezone: string;
  studioName: string;
  address: string | null;
  bookingMinLeadMinutes: number;
  bookingSlotStepMinutes: number;
  bookingBufferMinutes: number;
  bookingMaxDaysAhead: number;
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    active: boolean;
  };
  businessHours: BusinessHourWindow[];
  googleCalendarIntegration: GoogleCalendarIntegration | null;
};

export type BusinessHourWindow = {
  weekday: number;
  opensAt: string;
  closesAt: string;
};

export type InsertAppointmentInput = {
  id: string;
  tenantId: string;
  conversationId: string | null;
  serviceId: string;
  serviceName: string;
  customerIdentifier: string;
  customerName: string;
  customerPhone: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  notes: string | null;
  bookingSource: BookingSource;
  calendarProvider: 'google_calendar' | null;
  calendarSyncStatus: CalendarSyncStatus;
};

export type CreatedAppointment = {
  id: string;
  tenantId: string;
  scheduledAt: Date;
  durationMinutes: number;
  calendarSyncStatus: CalendarSyncStatus;
  calendarEventId: string | null;
  calendarEventHtmlLink: string | null;
};

export type AppointmentForChange = {
  id: string;
  tenantId: string;
  conversationId: string | null;
  serviceId: string | null;
  serviceName: string | null;
  customerIdentifier: string;
  customerName: string;
  customerPhone: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  calendarProvider: 'google_calendar' | null;
  calendarSyncStatus: CalendarSyncStatus;
  calendarEventId: string | null;
  calendarEventHtmlLink: string | null;
  notes: string | null;
};

export type AppointmentCalendarProvider = {
  listBusy(input: {
    integration: GoogleCalendarIntegration;
    from: Date;
    to: Date;
    timezone: string;
  }): Promise<CalendarBusyInterval[]>;
  createEvent(input: {
    integration: GoogleCalendarIntegration;
    appointmentId: string;
    tenantId: string;
    summary: string;
    description?: string;
    location?: string;
    start: Date;
    end: Date;
    timezone: string;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
  }): Promise<GoogleCalendarEventResult>;
  updateEvent(input: {
    integration: GoogleCalendarIntegration;
    eventId: string;
    appointmentId: string;
    tenantId: string;
    summary: string;
    description?: string;
    location?: string;
    start: Date;
    end: Date;
    timezone: string;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
  }): Promise<GoogleCalendarEventResult>;
  cancelEvent(input: {
    integration: GoogleCalendarIntegration;
    eventId: string;
  }): Promise<{ cancelled: true }>;
};

export type AppointmentNotificationEnqueuer = {
  enqueueNotification(input: {
    tenantId: string;
    appointmentId: string;
    kind: 'confirmation' | 'cancellation';
    idempotencyScope?: string;
    now?: Date;
  }): Promise<{ queued: boolean }>;
};

export type AppointmentBookingRepository = {
  getBookingContext(input: {
    tenantId: string;
    serviceId: string;
  }): Promise<BookingServiceContext | null>;
  listLocalBusyIntervals(input: {
    tenantId: string;
    from: Date;
    to: Date;
    excludeAppointmentId?: string;
  }): Promise<CalendarBusyInterval[]>;
  insertAppointment(input: InsertAppointmentInput): Promise<CreatedAppointment>;
  updateAppointmentCalendarSync(input: {
    tenantId: string;
    appointmentId: string;
    status: CalendarSyncStatus;
    eventId?: string | null;
    htmlLink?: string | null;
    errorMessage?: string | null;
  }): Promise<void>;
  updateGoogleCalendarAccessToken(input: {
    tenantId: string;
    integrationId: string;
    accessToken: string;
    expiresAt: number | null;
    scope: string | null;
    tokenType: string | null;
  }): Promise<void>;
  getAppointmentForChange(input: {
    tenantId: string;
    appointmentId: string;
  }): Promise<AppointmentForChange | null>;
  updateAppointmentSchedule(input: {
    tenantId: string;
    appointmentId: string;
    scheduledAt: Date;
    durationMinutes: number;
    notes: string | null;
    calendarProvider: 'google_calendar' | null;
    calendarSyncStatus: CalendarSyncStatus;
  }): Promise<void>;
  cancelAppointmentRecord(input: {
    tenantId: string;
    appointmentId: string;
    calendarSyncStatus: CalendarSyncStatus;
    errorMessage?: string | null;
  }): Promise<void>;
};

export type GetAvailableSlotsInput = {
  tenantId: string;
  serviceId: string;
  from: Date;
  to: Date;
  durationMinutes?: number;
  now?: Date;
  maxSlots?: number;
  slotStepMinutes?: number;
  excludeAppointmentId?: string;
};

export type CreateAppointmentInput = {
  tenantId: string;
  serviceId: string;
  conversationId?: string | null;
  customerIdentifier: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  scheduledAt: Date;
  durationMinutes?: number;
  notes?: string | null;
  bookingSource?: BookingSource;
  appointmentId?: string;
  requireCalendarSync?: boolean;
  sendConfirmation?: boolean;
  now?: Date;
};

export type CreateAppointmentResult = {
  appointmentId: string;
  scheduledAt: string;
  endsAt: string;
  durationMinutes: number;
  calendarSyncStatus: CalendarSyncStatus;
  calendarEventId: string | null;
  calendarEventHtmlLink: string | null;
  confirmationQueued: boolean;
  confirmationErrorCode: string | null;
};

export type RescheduleAppointmentInput = {
  tenantId: string;
  appointmentId: string;
  scheduledAt: Date;
  durationMinutes?: number;
  notes?: string | null;
  customerEmail?: string | null;
  requireCalendarSync?: boolean;
  sendConfirmation?: boolean;
  now?: Date;
};

export type CancelAppointmentInput = {
  tenantId: string;
  appointmentId: string;
  requireCalendarSync?: boolean;
  sendCancellation?: boolean;
  now?: Date;
};

export type ChangeAppointmentResult = {
  appointmentId: string;
  scheduledAt: string;
  endsAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  calendarSyncStatus: CalendarSyncStatus;
  calendarEventId: string | null;
  calendarEventHtmlLink: string | null;
  notificationQueued: boolean;
  notificationErrorCode: string | null;
};

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  active: boolean;
};

type TenantRow = {
  timezone: string;
};

type TenantConfigBookingRow = {
  studio_name: string;
  address: string | null;
  booking_min_lead_minutes: number;
  booking_slot_step_minutes: number;
  booking_buffer_minutes: number;
  booking_max_days_ahead: number;
};

type BusinessHoursRow = {
  weekday: number;
  opens_at: string;
  closes_at: string;
};

type IntegrationRow = {
  id: string;
  tenant_id: string;
  external_account_id: string | null;
  credentials: unknown;
  config: unknown;
};

type AppointmentBusyRow = {
  scheduled_at: string;
  duration_minutes: number;
};

type AppointmentRow = {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  service_id: string | null;
  customer_identifier: string;
  customer_name: string;
  customer_phone: string | null;
  scheduled_at: string;
  duration_minutes: number;
  service_type: string | null;
  status: AppointmentStatus;
  calendar_provider: 'google_calendar' | null;
  calendar_sync_status: CalendarSyncStatus;
  calendar_event_id: string | null;
  calendar_event_html_link: string | null;
  notes: string | null;
};

export class AppointmentBookingService {
  constructor(
    private readonly repository: AppointmentBookingRepository,
    private readonly calendarProvider: AppointmentCalendarProvider,
    private readonly notifications: AppointmentNotificationEnqueuer,
  ) {}

  async getAvailableSlots(input: GetAvailableSlotsInput): Promise<BookingSlot[]> {
    const context = await this.getRequiredContext(input);
    const now = input.now ?? new Date();
    const from = assertValidDate(input.from, 'from');
    const rawTo = assertValidDate(input.to, 'to');

    if (from >= rawTo) {
      throw new AppError('bad_request', 'Availability window must have from < to');
    }

    const to = minDate(rawTo, addDays(now, context.bookingMaxDaysAhead));
    const earliestStart = maxDate(from, addMinutes(now, context.bookingMinLeadMinutes));

    if (earliestStart >= to) {
      return [];
    }

    const durationMinutes = input.durationMinutes ?? context.service.durationMinutes;

    const localBusy = await this.repository.listLocalBusyIntervals({
      tenantId: input.tenantId,
      from: earliestStart,
      to,
      ...(input.excludeAppointmentId !== undefined
        ? { excludeAppointmentId: input.excludeAppointmentId }
        : {}),
    });
    const googleBusy = context.googleCalendarIntegration
      ? await this.calendarProvider.listBusy({
          integration: context.googleCalendarIntegration,
          from: earliestStart,
          to,
          timezone: context.timezone,
        })
      : [];

    return buildAvailableSlots({
      context,
      from: earliestStart,
      to,
      durationMinutes,
      slotStepMinutes: input.slotStepMinutes ?? context.bookingSlotStepMinutes,
      maxSlots: input.maxSlots ?? 5,
      busyIntervals: [...localBusy, ...googleBusy],
    });
  }

  async createAppointment(input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
    const context = await this.getRequiredContext(input);
    const scheduledAt = assertValidDate(input.scheduledAt, 'scheduledAt');
    const durationMinutes = input.durationMinutes ?? context.service.durationMinutes;

    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      throw new AppError('bad_request', 'Appointment duration must be positive');
    }

    const endsAt = addMinutes(scheduledAt, durationMinutes);
    const availableSlots = await this.getAvailableSlots({
      tenantId: input.tenantId,
      serviceId: input.serviceId,
      from: scheduledAt,
      to: endsAt,
      ...(input.now !== undefined ? { now: input.now } : {}),
      maxSlots: 1,
      slotStepMinutes: context.bookingSlotStepMinutes,
      durationMinutes,
    });
    const requestedSlotAvailable = availableSlots.some(
      (slot) => slot.start === scheduledAt.toISOString() && slot.end === endsAt.toISOString(),
    );

    if (!requestedSlotAvailable) {
      throw new AppError('conflict', 'Requested appointment slot is unavailable');
    }

    const appointment = await this.repository.insertAppointment({
      id: input.appointmentId ?? randomUUID(),
      tenantId: input.tenantId,
      conversationId: input.conversationId ?? null,
      serviceId: input.serviceId,
      serviceName: context.service.name,
      customerIdentifier: requiredTrimmed(input.customerIdentifier, 'customerIdentifier'),
      customerName: requiredTrimmed(input.customerName, 'customerName'),
      customerPhone: input.customerPhone?.trim() || null,
      scheduledAt,
      durationMinutes,
      notes: input.notes?.trim() || null,
      bookingSource: input.bookingSource ?? 'whatsapp_ai',
      calendarProvider: context.googleCalendarIntegration ? 'google_calendar' : null,
      calendarSyncStatus: context.googleCalendarIntegration ? 'pending' : 'not_configured',
    });

    let calendarSyncStatus = appointment.calendarSyncStatus;
    let calendarEventId = appointment.calendarEventId;
    let calendarEventHtmlLink = appointment.calendarEventHtmlLink;

    if (context.googleCalendarIntegration) {
      try {
        const event = await this.calendarProvider.createEvent({
          integration: context.googleCalendarIntegration,
          appointmentId: appointment.id,
          tenantId: input.tenantId,
          summary: `${context.studioName}: ${context.service.name} - ${input.customerName}`,
          description: appointmentDescription(input, context),
          ...(context.address !== null && context.address !== undefined
            ? { location: context.address }
            : {}),
          start: scheduledAt,
          end: endsAt,
          timezone: context.timezone,
          customerName: input.customerName,
          ...(input.customerPhone !== undefined ? { customerPhone: input.customerPhone } : {}),
          ...(input.customerEmail !== undefined ? { customerEmail: input.customerEmail } : {}),
        });

        await this.repository.updateAppointmentCalendarSync({
          tenantId: input.tenantId,
          appointmentId: appointment.id,
          status: 'synced',
          eventId: event.eventId,
          htmlLink: event.htmlLink,
        });
        calendarSyncStatus = 'synced';
        calendarEventId = event.eventId;
        calendarEventHtmlLink = event.htmlLink;
      } catch (error) {
        await this.repository.updateAppointmentCalendarSync({
          tenantId: input.tenantId,
          appointmentId: appointment.id,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'unknown error',
        });

        if (input.requireCalendarSync ?? true) {
          throw error;
        }

        calendarSyncStatus = 'failed';
      }
    }

    const confirmation = await this.enqueueConfirmationSafely({
      tenantId: input.tenantId,
      appointmentId: appointment.id,
      shouldSend: input.sendConfirmation ?? true,
      ...(input.now !== undefined ? { now: input.now } : {}),
    });

    return {
      appointmentId: appointment.id,
      scheduledAt: scheduledAt.toISOString(),
      endsAt: endsAt.toISOString(),
      durationMinutes,
      calendarSyncStatus,
      calendarEventId,
      calendarEventHtmlLink,
      confirmationQueued: confirmation.queued,
      confirmationErrorCode: confirmation.errorCode,
    };
  }

  async rescheduleAppointment(input: RescheduleAppointmentInput): Promise<ChangeAppointmentResult> {
    const appointment = await this.getChangeableAppointment(input);
    const serviceId = requiredServiceId(appointment);
    const context = await this.getRequiredContext({
      tenantId: input.tenantId,
      serviceId,
    });
    const scheduledAt = assertValidDate(input.scheduledAt, 'scheduledAt');
    const durationMinutes = input.durationMinutes ?? appointment.durationMinutes;

    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      throw new AppError('bad_request', 'Appointment duration must be positive');
    }

    const endsAt = addMinutes(scheduledAt, durationMinutes);
    const availableSlots = await this.getAvailableSlots({
      tenantId: input.tenantId,
      serviceId,
      from: scheduledAt,
      to: endsAt,
      ...(input.now !== undefined ? { now: input.now } : {}),
      maxSlots: 1,
      slotStepMinutes: context.bookingSlotStepMinutes,
      durationMinutes,
      excludeAppointmentId: appointment.id,
    });
    const requestedSlotAvailable = availableSlots.some(
      (slot) => slot.start === scheduledAt.toISOString() && slot.end === endsAt.toISOString(),
    );

    if (!requestedSlotAvailable) {
      throw new AppError('conflict', 'Requested appointment slot is unavailable');
    }

    const hasCalendar = Boolean(context.googleCalendarIntegration);
    await this.repository.updateAppointmentSchedule({
      tenantId: input.tenantId,
      appointmentId: appointment.id,
      scheduledAt,
      durationMinutes,
      notes: input.notes?.trim() || appointment.notes,
      calendarProvider: hasCalendar ? 'google_calendar' : null,
      calendarSyncStatus: hasCalendar ? 'pending' : 'not_configured',
    });

    let calendarSyncStatus: CalendarSyncStatus = hasCalendar ? 'pending' : 'not_configured';
    let calendarEventId = appointment.calendarEventId;
    let calendarEventHtmlLink = appointment.calendarEventHtmlLink;

    if (context.googleCalendarIntegration) {
      try {
        const calendarEventInput = {
          integration: context.googleCalendarIntegration,
          appointmentId: appointment.id,
          tenantId: input.tenantId,
          summary: `${context.studioName}: ${context.service.name} - ${appointment.customerName}`,
          description: appointmentDescription(
            {
              tenantId: input.tenantId,
              serviceId,
              customerIdentifier: appointment.customerIdentifier,
              customerName: appointment.customerName,
              customerPhone: appointment.customerPhone,
              ...(input.customerEmail !== undefined ? { customerEmail: input.customerEmail } : {}),
              scheduledAt,
              durationMinutes,
              notes: input.notes ?? appointment.notes,
            },
            context,
          ),
          ...(context.address !== null && context.address !== undefined
            ? { location: context.address }
            : {}),
          start: scheduledAt,
          end: endsAt,
          timezone: context.timezone,
          customerName: appointment.customerName,
          customerPhone: appointment.customerPhone,
          ...(input.customerEmail !== undefined ? { customerEmail: input.customerEmail } : {}),
        };
        const event = appointment.calendarEventId
          ? await this.calendarProvider.updateEvent({
              ...calendarEventInput,
              eventId: appointment.calendarEventId,
            })
          : await this.calendarProvider.createEvent(calendarEventInput);

        await this.repository.updateAppointmentCalendarSync({
          tenantId: input.tenantId,
          appointmentId: appointment.id,
          status: 'synced',
          eventId: event.eventId,
          htmlLink: event.htmlLink,
        });
        calendarSyncStatus = 'synced';
        calendarEventId = event.eventId;
        calendarEventHtmlLink = event.htmlLink;
      } catch (error) {
        await this.repository.updateAppointmentCalendarSync({
          tenantId: input.tenantId,
          appointmentId: appointment.id,
          status: 'failed',
          eventId: appointment.calendarEventId,
          htmlLink: appointment.calendarEventHtmlLink,
          errorMessage: error instanceof Error ? error.message : 'unknown error',
        });

        if (input.requireCalendarSync ?? true) {
          throw error;
        }

        calendarSyncStatus = 'failed';
      }
    }

    const confirmation = await this.enqueueNotificationSafely({
      tenantId: input.tenantId,
      appointmentId: appointment.id,
      kind: 'confirmation',
      shouldSend: input.sendConfirmation ?? true,
      idempotencyScope: `rescheduled:${scheduledAt.toISOString()}`,
      ...(input.now !== undefined ? { now: input.now } : {}),
    });

    return {
      appointmentId: appointment.id,
      scheduledAt: scheduledAt.toISOString(),
      endsAt: endsAt.toISOString(),
      durationMinutes,
      status: 'confirmed',
      calendarSyncStatus,
      calendarEventId,
      calendarEventHtmlLink,
      notificationQueued: confirmation.queued,
      notificationErrorCode: confirmation.errorCode,
    };
  }

  async cancelAppointment(input: CancelAppointmentInput): Promise<ChangeAppointmentResult> {
    const appointment = await this.getChangeableAppointment(input);
    const context = appointment.serviceId
      ? await this.getRequiredContext({
          tenantId: input.tenantId,
          serviceId: appointment.serviceId,
        })
      : null;
    const endsAt = addMinutes(appointment.scheduledAt, appointment.durationMinutes);
    let calendarSyncStatus: CalendarSyncStatus = context?.googleCalendarIntegration
      ? 'pending'
      : 'not_configured';

    if (context?.googleCalendarIntegration && appointment.calendarEventId) {
      try {
        await this.calendarProvider.cancelEvent({
          integration: context.googleCalendarIntegration,
          eventId: appointment.calendarEventId,
        });
        calendarSyncStatus = 'synced';
      } catch (error) {
        await this.repository.updateAppointmentCalendarSync({
          tenantId: input.tenantId,
          appointmentId: appointment.id,
          status: 'failed',
          eventId: appointment.calendarEventId,
          htmlLink: appointment.calendarEventHtmlLink,
          errorMessage: error instanceof Error ? error.message : 'unknown error',
        });

        if (input.requireCalendarSync ?? true) {
          throw error;
        }

        calendarSyncStatus = 'failed';
      }
    } else if (context?.googleCalendarIntegration) {
      calendarSyncStatus = 'failed';
    }

    await this.repository.cancelAppointmentRecord({
      tenantId: input.tenantId,
      appointmentId: appointment.id,
      calendarSyncStatus,
      errorMessage:
        calendarSyncStatus === 'failed' && context?.googleCalendarIntegration
          ? 'Appointment is missing Google Calendar event id'
          : null,
    });

    const cancellation = await this.enqueueNotificationSafely({
      tenantId: input.tenantId,
      appointmentId: appointment.id,
      kind: 'cancellation',
      shouldSend: input.sendCancellation ?? true,
      ...(input.now !== undefined ? { now: input.now } : {}),
    });

    return {
      appointmentId: appointment.id,
      scheduledAt: appointment.scheduledAt.toISOString(),
      endsAt: endsAt.toISOString(),
      durationMinutes: appointment.durationMinutes,
      status: 'cancelled',
      calendarSyncStatus,
      calendarEventId: appointment.calendarEventId,
      calendarEventHtmlLink: appointment.calendarEventHtmlLink,
      notificationQueued: cancellation.queued,
      notificationErrorCode: cancellation.errorCode,
    };
  }

  private async enqueueConfirmationSafely(input: {
    tenantId: string;
    appointmentId: string;
    shouldSend: boolean;
    now?: Date;
  }): Promise<{ queued: boolean; errorCode: string | null }> {
    return this.enqueueNotificationSafely({
      ...input,
      kind: 'confirmation',
    });
  }

  private async enqueueNotificationSafely(input: {
    tenantId: string;
    appointmentId: string;
    kind: 'confirmation' | 'cancellation';
    shouldSend: boolean;
    idempotencyScope?: string;
    now?: Date;
  }): Promise<{ queued: boolean; errorCode: string | null }> {
    if (!input.shouldSend) {
      return { queued: false, errorCode: null };
    }

    try {
      const result = await this.notifications.enqueueNotification({
        tenantId: input.tenantId,
        appointmentId: input.appointmentId,
        kind: input.kind,
        ...(input.idempotencyScope !== undefined
          ? { idempotencyScope: input.idempotencyScope }
          : {}),
        ...(input.now !== undefined ? { now: input.now } : {}),
      });

      return { queued: result.queued, errorCode: null };
    } catch (error) {
      return {
        queued: false,
        errorCode: error instanceof AppError ? error.code : 'internal',
      };
    }
  }

  private async getRequiredContext(input: {
    tenantId: string;
    serviceId: string;
  }): Promise<BookingServiceContext> {
    const context = await this.repository.getBookingContext(input);

    if (!context) {
      throw new AppError('not_found', 'Booking service or tenant not found');
    }

    if (!context.service.active) {
      throw new AppError('bad_request', 'Service is not active');
    }

    return context;
  }

  private async getChangeableAppointment(input: {
    tenantId: string;
    appointmentId: string;
  }): Promise<AppointmentForChange> {
    const appointment = await this.repository.getAppointmentForChange(input);

    if (!appointment) {
      throw new AppError('not_found', 'Appointment not found');
    }

    if (appointment.status !== 'confirmed') {
      throw new AppError('bad_request', 'Only confirmed appointments can be changed');
    }

    return appointment;
  }
}

export class SupabaseAppointmentBookingRepository implements AppointmentBookingRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getBookingContext(input: {
    tenantId: string;
    serviceId: string;
  }): Promise<BookingServiceContext | null> {
    const service = await this.supabase
      .from('services')
      .select('id, name, duration_minutes, active')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.serviceId)
      .maybeSingle();

    if (service.error) {
      throw toRepositoryError('Failed to read booking service', service.error);
    }

    if (!service.data) {
      return null;
    }

    const tenant = await this.supabase
      .from('tenants')
      .select('timezone')
      .eq('id', input.tenantId)
      .single();

    if (tenant.error) {
      throw toRepositoryError('Failed to read tenant timezone', tenant.error);
    }

    const config = await this.supabase
      .from('tenant_config')
      .select(
        'studio_name, address, booking_min_lead_minutes, booking_slot_step_minutes, booking_buffer_minutes, booking_max_days_ahead',
      )
      .eq('tenant_id', input.tenantId)
      .maybeSingle();

    if (config.error) {
      throw toRepositoryError('Failed to read tenant booking config', config.error);
    }

    const businessHours = await this.supabase
      .from('business_hours')
      .select('weekday, opens_at, closes_at')
      .eq('tenant_id', input.tenantId)
      .eq('active', true)
      .order('weekday', { ascending: true })
      .order('opens_at', { ascending: true });

    if (businessHours.error) {
      throw toRepositoryError('Failed to read business hours', businessHours.error);
    }

    const integrations = await this.supabase
      .from('integrations')
      .select('id, tenant_id, external_account_id, credentials, config')
      .eq('tenant_id', input.tenantId)
      .eq('provider', 'google_calendar')
      .eq('status', 'active')
      .limit(1);

    if (integrations.error) {
      throw toRepositoryError('Failed to read Google Calendar integration', integrations.error);
    }

    const serviceRow = service.data as ServiceRow;
    const tenantRow = tenant.data as TenantRow;
    const configRow = config.data as TenantConfigBookingRow | null;
    const integrationRow = (integrations.data?.[0] ?? null) as IntegrationRow | null;

    return {
      tenantId: input.tenantId,
      timezone: tenantRow.timezone || 'Europe/Rome',
      studioName: configRow?.studio_name ?? 'Studio',
      address: configRow?.address ?? null,
      bookingMinLeadMinutes: configRow?.booking_min_lead_minutes ?? 120,
      bookingSlotStepMinutes: configRow?.booking_slot_step_minutes ?? 15,
      bookingBufferMinutes: configRow?.booking_buffer_minutes ?? 0,
      bookingMaxDaysAhead: configRow?.booking_max_days_ahead ?? 30,
      service: {
        id: serviceRow.id,
        name: serviceRow.name,
        durationMinutes: serviceRow.duration_minutes,
        active: serviceRow.active,
      },
      businessHours: ((businessHours.data ?? []) as BusinessHoursRow[]).map((row) => ({
        weekday: row.weekday,
        opensAt: row.opens_at,
        closesAt: row.closes_at,
      })),
      googleCalendarIntegration: integrationRow
        ? {
            id: integrationRow.id,
            tenantId: integrationRow.tenant_id,
            externalAccountId: integrationRow.external_account_id,
            credentials: toPlainRecord(integrationRow.credentials),
            config: toPlainRecord(integrationRow.config),
          }
        : null,
    };
  }

  async listLocalBusyIntervals(input: {
    tenantId: string;
    from: Date;
    to: Date;
    excludeAppointmentId?: string;
  }): Promise<CalendarBusyInterval[]> {
    const lookback = addDays(input.from, -1);
    let query = this.supabase
      .from('appointments')
      .select('scheduled_at, duration_minutes')
      .eq('tenant_id', input.tenantId)
      .eq('status', 'confirmed')
      .lt('scheduled_at', input.to.toISOString())
      .gte('scheduled_at', lookback.toISOString())
      .order('scheduled_at', { ascending: true });

    if (input.excludeAppointmentId) {
      query = query.neq('id', input.excludeAppointmentId);
    }

    const { data, error } = await query;

    if (error) {
      throw toRepositoryError('Failed to read local appointment busy slots', error);
    }

    return ((data ?? []) as AppointmentBusyRow[])
      .map((row) => {
        const start = new Date(row.scheduled_at);
        return {
          start,
          end: addMinutes(start, row.duration_minutes),
          source: 'local_appointment' as const,
        };
      })
      .filter((interval) => interval.start < input.to && interval.end > input.from);
  }

  async insertAppointment(input: InsertAppointmentInput): Promise<CreatedAppointment> {
    const { data, error } = await this.supabase
      .from('appointments')
      .insert({
        id: input.id,
        tenant_id: input.tenantId,
        conversation_id: input.conversationId,
        service_id: input.serviceId,
        customer_identifier: input.customerIdentifier,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        scheduled_at: input.scheduledAt.toISOString(),
        duration_minutes: input.durationMinutes,
        service_type: input.serviceName,
        status: 'confirmed',
        notes: input.notes,
        booking_source: input.bookingSource,
        calendar_provider: input.calendarProvider,
        calendar_sync_status: input.calendarSyncStatus,
      })
      .select(
        'id, tenant_id, scheduled_at, duration_minutes, calendar_sync_status, calendar_event_id, calendar_event_html_link',
      )
      .single();

    if (error) {
      if (isAppointmentConflict(error)) {
        throw new AppError('conflict', 'Appointment slot is no longer available', { cause: error });
      }

      throw toRepositoryError('Failed to insert appointment', error);
    }

    const row = data as AppointmentRow;

    return {
      id: row.id,
      tenantId: row.tenant_id,
      scheduledAt: new Date(row.scheduled_at),
      durationMinutes: row.duration_minutes,
      calendarSyncStatus: row.calendar_sync_status,
      calendarEventId: row.calendar_event_id,
      calendarEventHtmlLink: row.calendar_event_html_link,
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
    const { error } = await this.supabase
      .from('appointments')
      .update({
        calendar_sync_status: input.status,
        calendar_event_id: input.eventId ?? null,
        calendar_event_html_link: input.htmlLink ?? null,
        calendar_sync_error: input.errorMessage ? input.errorMessage.slice(0, 1000) : null,
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.appointmentId);

    if (error) {
      throw toRepositoryError('Failed to update appointment calendar sync', error);
    }
  }

  async getAppointmentForChange(input: {
    tenantId: string;
    appointmentId: string;
  }): Promise<AppointmentForChange | null> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select(
        'id, tenant_id, conversation_id, service_id, customer_identifier, customer_name, customer_phone, scheduled_at, duration_minutes, service_type, status, calendar_provider, calendar_sync_status, calendar_event_id, calendar_event_html_link, notes',
      )
      .eq('tenant_id', input.tenantId)
      .eq('id', input.appointmentId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read appointment for change', error);
    }

    if (!data) {
      return null;
    }

    const row = data as AppointmentRow;

    return {
      id: row.id,
      tenantId: row.tenant_id,
      conversationId: row.conversation_id,
      serviceId: row.service_id,
      serviceName: row.service_type,
      customerIdentifier: row.customer_identifier,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      scheduledAt: new Date(row.scheduled_at),
      durationMinutes: row.duration_minutes,
      status: row.status,
      calendarProvider: row.calendar_provider,
      calendarSyncStatus: row.calendar_sync_status,
      calendarEventId: row.calendar_event_id,
      calendarEventHtmlLink: row.calendar_event_html_link,
      notes: row.notes,
    };
  }

  async updateAppointmentSchedule(input: {
    tenantId: string;
    appointmentId: string;
    scheduledAt: Date;
    durationMinutes: number;
    notes: string | null;
    calendarProvider: 'google_calendar' | null;
    calendarSyncStatus: CalendarSyncStatus;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('appointments')
      .update({
        scheduled_at: input.scheduledAt.toISOString(),
        duration_minutes: input.durationMinutes,
        notes: input.notes,
        status: 'confirmed',
        calendar_provider: input.calendarProvider,
        calendar_sync_status: input.calendarSyncStatus,
        calendar_sync_error: null,
        confirmation_queued_at: null,
        reminder_24h_queued_at: null,
        reminder_1h_queued_at: null,
        cancellation_queued_at: null,
        reminded_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.appointmentId)
      .eq('status', 'confirmed');

    if (error) {
      if (isAppointmentConflict(error)) {
        throw new AppError('conflict', 'Appointment slot is no longer available', {
          cause: error,
        });
      }

      throw toRepositoryError('Failed to update appointment schedule', error);
    }
  }

  async cancelAppointmentRecord(input: {
    tenantId: string;
    appointmentId: string;
    calendarSyncStatus: CalendarSyncStatus;
    errorMessage?: string | null;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        calendar_sync_status: input.calendarSyncStatus,
        calendar_sync_error: input.errorMessage ? input.errorMessage.slice(0, 1000) : null,
        reminder_24h_queued_at: null,
        reminder_1h_queued_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.appointmentId)
      .eq('status', 'confirmed');

    if (error) {
      throw toRepositoryError('Failed to cancel appointment', error);
    }
  }

  async updateGoogleCalendarAccessToken(input: {
    tenantId: string;
    integrationId: string;
    accessToken: string;
    expiresAt: number | null;
    scope: string | null;
    tokenType: string | null;
  }): Promise<void> {
    const existing = await this.supabase
      .from('integrations')
      .select('credentials')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.integrationId)
      .eq('provider', 'google_calendar')
      .maybeSingle();

    if (existing.error) {
      throw toRepositoryError(
        'Failed to read Google Calendar credentials for refresh',
        existing.error,
      );
    }

    const credentials = encryptedCredentialPatch({
      accessToken: input.accessToken,
      expiresAt: input.expiresAt,
      scope: input.scope,
      tokenType: input.tokenType,
      existing: toPlainRecord(existing.data?.credentials),
    });
    const { error } = await this.supabase
      .from('integrations')
      .update({
        credentials,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.integrationId)
      .eq('provider', 'google_calendar');

    if (error) {
      throw toRepositoryError('Failed to persist refreshed Google Calendar token', error);
    }
  }
}

export function createAppointmentBookingService(): AppointmentBookingService {
  const repository = new SupabaseAppointmentBookingRepository();

  return new AppointmentBookingService(
    repository,
    new GoogleCalendarProvider({
      onTokenRefresh: async (input) => {
        await repository.updateGoogleCalendarAccessToken({
          tenantId: input.integration.tenantId,
          integrationId: input.integration.id,
          accessToken: input.accessToken,
          expiresAt: input.expiresAt,
          scope: input.scope,
          tokenType: input.tokenType,
        });
      },
    }),
    createAppointmentNotificationService(),
  );
}

function buildAvailableSlots(input: {
  context: BookingServiceContext;
  from: Date;
  to: Date;
  durationMinutes: number;
  slotStepMinutes: number;
  maxSlots: number;
  busyIntervals: CalendarBusyInterval[];
}): BookingSlot[] {
  if (input.maxSlots <= 0 || input.durationMinutes <= 0) {
    return [];
  }

  const slots: BookingSlot[] = [];
  const startLocalDate = localDateParts(input.from, input.context.timezone);
  const endLocalDate = localDateParts(input.to, input.context.timezone);
  const hoursByWeekday = groupBusinessHoursByWeekday(input.context.businessHours);

  for (
    let localDate = startLocalDate;
    compareLocalDate(localDate, endLocalDate) <= 0 && slots.length < input.maxSlots;
    localDate = nextLocalDate(localDate)
  ) {
    const weekday = weekdayForLocalDate(localDate);
    const dayHours = hoursByWeekday.get(weekday) ?? [];

    for (const window of dayHours) {
      const openTime = parseTime(window.opensAt);
      const closeTime = parseTime(window.closesAt);

      if (minutesSinceMidnight(closeTime) <= minutesSinceMidnight(openTime)) {
        continue;
      }

      const openUtc = zonedLocalTimeToUtc(localDate, openTime, input.context.timezone);
      const closeUtc = zonedLocalTimeToUtc(localDate, closeTime, input.context.timezone);
      let candidate = ceilToStepFromAnchor(
        maxDate(openUtc, input.from),
        input.slotStepMinutes,
        openUtc,
      );

      while (slots.length < input.maxSlots) {
        const end = addMinutes(candidate, input.durationMinutes);

        if (end > closeUtc || end > input.to) {
          break;
        }

        if (
          candidate >= input.from &&
          !overlapsBusyInterval({
            start: candidate,
            end,
            bufferMinutes: input.context.bookingBufferMinutes,
            busyIntervals: input.busyIntervals,
          })
        ) {
          slots.push({
            tenantId: input.context.tenantId,
            serviceId: input.context.service.id,
            serviceName: input.context.service.name,
            start: candidate.toISOString(),
            end: end.toISOString(),
            durationMinutes: input.durationMinutes,
            timezone: input.context.timezone,
          });
        }

        candidate = addMinutes(candidate, input.slotStepMinutes);
      }
    }
  }

  return slots;
}

function appointmentDescription(
  input: CreateAppointmentInput,
  context: BookingServiceContext,
): string {
  const lines = [
    `Prenotazione creata da Ambrogio.ai`,
    `Servizio: ${context.service.name}`,
    `Cliente: ${input.customerName}`,
  ];

  if (input.customerPhone) {
    lines.push(`Telefono: ${input.customerPhone}`);
  }

  if (input.notes) {
    lines.push('', input.notes);
  }

  return lines.join('\n');
}

function groupBusinessHoursByWeekday(
  rows: BusinessHourWindow[],
): Map<number, BusinessHourWindow[]> {
  const grouped = new Map<number, BusinessHourWindow[]>();

  for (const row of rows) {
    const list = grouped.get(row.weekday) ?? [];
    list.push(row);
    grouped.set(row.weekday, list);
  }

  return grouped;
}

function overlapsBusyInterval(input: {
  start: Date;
  end: Date;
  bufferMinutes: number;
  busyIntervals: CalendarBusyInterval[];
}): boolean {
  const bufferedStart = addMinutes(input.start, -input.bufferMinutes);
  const bufferedEnd = addMinutes(input.end, input.bufferMinutes);

  return input.busyIntervals.some((busy) => bufferedStart < busy.end && bufferedEnd > busy.start);
}

function parseTime(value: string): { hour: number; minute: number; second: number } {
  const [hourRaw, minuteRaw, secondRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw ?? '0');

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || !Number.isInteger(second)) {
    throw new AppError('bad_request', `Invalid business hour time: ${value}`);
  }

  return { hour, minute, second };
}

function minutesSinceMidnight(time: { hour: number; minute: number; second: number }): number {
  return time.hour * 60 + time.minute + time.second / 60;
}

function localDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = zonedParts(date, timeZone);

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

function zonedParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map = new Map(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    year: numberPart(map, 'year'),
    month: numberPart(map, 'month'),
    day: numberPart(map, 'day'),
    hour: numberPart(map, 'hour'),
    minute: numberPart(map, 'minute'),
    second: numberPart(map, 'second'),
  };
}

function zonedLocalTimeToUtc(
  localDate: { year: number; month: number; day: number },
  time: { hour: number; minute: number; second: number },
  timeZone: string,
): Date {
  const utcWallTime = Date.UTC(
    localDate.year,
    localDate.month - 1,
    localDate.day,
    time.hour,
    time.minute,
    time.second,
  );
  let candidate = new Date(utcWallTime);

  for (let index = 0; index < 3; index += 1) {
    const offset = timezoneOffsetMs(candidate, timeZone);
    const next = new Date(utcWallTime - offset);

    if (Math.abs(next.getTime() - candidate.getTime()) < 1000) {
      return next;
    }

    candidate = next;
  }

  return candidate;
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

function numberPart(map: Map<string, string>, key: string): number {
  const value = map.get(key);
  const parsed = value ? Number(value) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new AppError('internal', `Could not format timezone part ${key}`, {
      expose: false,
    });
  }

  return parsed;
}

function weekdayForLocalDate(date: { year: number; month: number; day: number }): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function compareLocalDate(
  left: { year: number; month: number; day: number },
  right: { year: number; month: number; day: number },
): number {
  const leftValue = Date.UTC(left.year, left.month - 1, left.day);
  const rightValue = Date.UTC(right.year, right.month - 1, right.day);

  return Math.sign(leftValue - rightValue);
}

function nextLocalDate(date: { year: number; month: number; day: number }): {
  year: number;
  month: number;
  day: number;
} {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function ceilToStepFromAnchor(date: Date, stepMinutes: number, anchor: Date): Date {
  const safeStepMinutes = Math.max(1, stepMinutes);
  const stepMs = safeStepMinutes * 60_000;
  const delta = date.getTime() - anchor.getTime();

  if (delta <= 0) {
    return anchor;
  }

  return new Date(anchor.getTime() + Math.ceil(delta / stepMs) * stepMs);
}

function assertValidDate(date: Date, name: string): Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new AppError('bad_request', `${name} must be a valid date`);
  }

  return date;
}

function requiredTrimmed(value: string, name: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new AppError('bad_request', `${name} is required`);
  }

  return trimmed;
}

function requiredServiceId(appointment: AppointmentForChange): string {
  if (!appointment.serviceId) {
    throw new AppError('bad_request', 'Appointment does not have a service');
  }

  return appointment.serviceId;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

function minDate(left: Date, right: Date): Date {
  return left <= right ? left : right;
}

function maxDate(left: Date, right: Date): Date {
  return left >= right ? left : right;
}

function toPlainRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function isAppointmentConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === '23P01' || error.code === '23505')
  );
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
