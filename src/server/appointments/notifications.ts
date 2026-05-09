import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  createWhatsAppTemplateMessageService,
  type EnqueueTemplateMessageResult,
  type WhatsAppTemplateKey,
} from '@/server/whatsapp/templates';

export const appointmentNotificationKinds = [
  'confirmation',
  'reminder_24h',
  'reminder_1h',
  'cancellation',
] as const;

export type AppointmentNotificationKind = (typeof appointmentNotificationKinds)[number];

export type AppointmentNotificationContext = {
  tenantId: string;
  appointmentId: string;
  conversationId: string | null;
  customerIdentifier: string;
  customerPhone: string | null;
  customerName: string;
  scheduledAt: Date;
  serviceName: string | null;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  studioName: string;
  timezone: string;
};

export type DueAppointmentReminder = {
  tenantId: string;
  appointmentId: string;
  kind: Extract<AppointmentNotificationKind, 'reminder_24h' | 'reminder_1h'>;
};

export type EnqueueAppointmentNotificationInput = {
  tenantId: string;
  appointmentId: string;
  kind: AppointmentNotificationKind;
  idempotencyScope?: string;
  now?: Date;
};

export type EnqueueAppointmentNotificationResult = {
  appointmentId: string;
  kind: AppointmentNotificationKind;
  queued: boolean;
  skippedReason: 'appointment_not_confirmed' | 'duplicate_outbound' | 'opted_out' | null;
  templateResult: EnqueueTemplateMessageResult | null;
};

export type ProcessAppointmentReminderJobsResult = {
  candidateReminders: number;
  queuedReminders: number;
  skippedReminders: number;
  failedReminders: number;
};

export interface AppointmentNotificationRepository {
  getAppointmentNotificationContext(input: {
    tenantId: string;
    appointmentId: string;
  }): Promise<AppointmentNotificationContext | null>;
  listDueReminders(input: {
    tenantId?: string;
    now: Date;
    limit: number;
  }): Promise<DueAppointmentReminder[]>;
  isCustomerOptedOut(input: { tenantId: string; customerIdentifier: string }): Promise<boolean>;
  markNotificationQueued(input: {
    tenantId: string;
    appointmentId: string;
    kind: AppointmentNotificationKind;
    queuedAt: Date;
  }): Promise<void>;
}

export type TemplateMessageEnqueuer = {
  enqueueTemplateMessage(input: {
    tenantId: string;
    conversationId: string;
    recipientIdentifier: string;
    templateKey: WhatsAppTemplateKey;
    variables: Record<string, string>;
    idempotencyKey: string;
    languageCode?: string;
    createdAt?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<EnqueueTemplateMessageResult>;
};

type AppointmentRow = {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  customer_identifier: string;
  customer_phone: string | null;
  customer_name: string;
  scheduled_at: string;
  service_type: string | null;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
};

type TenantRow = {
  timezone: string;
};

type TenantConfigRow = {
  studio_name: string;
};

type DueReminderRow = {
  id: string;
  tenant_id: string;
};

export class AppointmentNotificationService {
  constructor(
    private readonly repository: AppointmentNotificationRepository,
    private readonly templateMessages: TemplateMessageEnqueuer,
  ) {}

  async enqueueNotification(
    input: EnqueueAppointmentNotificationInput,
  ): Promise<EnqueueAppointmentNotificationResult> {
    const context = await this.repository.getAppointmentNotificationContext({
      tenantId: input.tenantId,
      appointmentId: input.appointmentId,
    });

    if (!context) {
      throw new AppError('not_found', 'Appointment not found');
    }

    if (!isValidAppointmentStatusForNotification(context.status, input.kind)) {
      return {
        appointmentId: input.appointmentId,
        kind: input.kind,
        queued: false,
        skippedReason: 'appointment_not_confirmed',
        templateResult: null,
      };
    }

    if (!context.conversationId) {
      throw new AppError('bad_request', 'Appointment does not have a WhatsApp conversation');
    }

    const recipientIdentifier = context.customerPhone?.trim() || context.customerIdentifier.trim();

    if (!recipientIdentifier) {
      throw new AppError(
        'bad_request',
        'Appointment does not have a WhatsApp recipient identifier',
      );
    }

    const optedOut = await this.repository.isCustomerOptedOut({
      tenantId: input.tenantId,
      customerIdentifier: recipientIdentifier,
    });

    if (optedOut) {
      return {
        appointmentId: input.appointmentId,
        kind: input.kind,
        queued: false,
        skippedReason: 'opted_out',
        templateResult: null,
      };
    }

    const templateResult = await this.templateMessages.enqueueTemplateMessage({
      tenantId: input.tenantId,
      conversationId: context.conversationId,
      recipientIdentifier,
      templateKey: templateKeyForNotification(input.kind),
      variables: variablesForAppointment(context),
      idempotencyKey: notificationIdempotencyKey(input),
      createdAt: input.now ?? new Date(),
      metadata: {
        appointmentId: input.appointmentId,
        appointmentNotificationKind: input.kind,
        appointmentNotificationScope: input.idempotencyScope ?? null,
      },
    });

    if (templateResult.queued || templateResult.skippedReason === 'duplicate_outbound') {
      await this.repository.markNotificationQueued({
        tenantId: input.tenantId,
        appointmentId: input.appointmentId,
        kind: input.kind,
        queuedAt: input.now ?? new Date(),
      });
    }

    return {
      appointmentId: input.appointmentId,
      kind: input.kind,
      queued: templateResult.queued,
      skippedReason: templateResult.skippedReason,
      templateResult,
    };
  }

  async processDueReminders(
    input: {
      tenantId?: string;
      limit?: number;
      now?: Date;
    } = {},
  ): Promise<ProcessAppointmentReminderJobsResult> {
    const now = input.now ?? new Date();
    const reminders = await this.repository.listDueReminders({
      ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
      now,
      limit: input.limit ?? 50,
    });
    const result: ProcessAppointmentReminderJobsResult = {
      candidateReminders: reminders.length,
      queuedReminders: 0,
      skippedReminders: 0,
      failedReminders: 0,
    };

    for (const reminder of reminders) {
      try {
        const queued = await this.enqueueNotification({
          tenantId: reminder.tenantId,
          appointmentId: reminder.appointmentId,
          kind: reminder.kind,
          now,
        });

        result.queuedReminders += queued.queued ? 1 : 0;
        result.skippedReminders += queued.queued ? 0 : 1;
      } catch {
        result.failedReminders += 1;
      }
    }

    return result;
  }
}

function notificationIdempotencyKey(input: EnqueueAppointmentNotificationInput): string {
  const scope = input.idempotencyScope?.trim();

  return scope
    ? `${input.appointmentId}:${input.kind}:${scope}`
    : `${input.appointmentId}:${input.kind}`;
}

export class SupabaseAppointmentNotificationRepository implements AppointmentNotificationRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getAppointmentNotificationContext(input: {
    tenantId: string;
    appointmentId: string;
  }): Promise<AppointmentNotificationContext | null> {
    const appointment = await this.supabase
      .from('appointments')
      .select(
        'id, tenant_id, conversation_id, customer_identifier, customer_phone, customer_name, scheduled_at, service_type, status',
      )
      .eq('tenant_id', input.tenantId)
      .eq('id', input.appointmentId)
      .maybeSingle();

    if (appointment.error) {
      throw toRepositoryError('Failed to read appointment', appointment.error);
    }

    if (!appointment.data) {
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
      .select('studio_name')
      .eq('tenant_id', input.tenantId)
      .maybeSingle();

    if (config.error) {
      throw toRepositoryError('Failed to read tenant config', config.error);
    }

    const row = appointment.data as AppointmentRow;
    const tenantRow = tenant.data as TenantRow;
    const configRow = config.data as TenantConfigRow | null;

    return {
      tenantId: row.tenant_id,
      appointmentId: row.id,
      conversationId: row.conversation_id,
      customerIdentifier: row.customer_identifier,
      customerPhone: row.customer_phone,
      customerName: row.customer_name,
      scheduledAt: new Date(row.scheduled_at),
      serviceName: row.service_type,
      status: row.status,
      studioName: configRow?.studio_name ?? 'lo studio',
      timezone: tenantRow.timezone,
    };
  }

  async listDueReminders(input: {
    tenantId?: string;
    now: Date;
    limit: number;
  }): Promise<DueAppointmentReminder[]> {
    const safeLimit = Math.max(1, Math.min(input.limit, 100));
    const nowIso = input.now.toISOString();
    const oneHourFromNow = new Date(input.now.getTime() + 60 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(input.now.getTime() + 24 * 60 * 60 * 1000);
    const oneHourRows = await this.queryDueReminderRows({
      ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
      queuedAtColumn: 'reminder_1h_queued_at',
      scheduledAfterIso: nowIso,
      scheduledBeforeOrAtIso: oneHourFromNow.toISOString(),
      limit: safeLimit,
    });
    const remainingLimit = Math.max(safeLimit - oneHourRows.length, 0);
    const twentyFourHourRows =
      remainingLimit > 0
        ? await this.queryDueReminderRows({
            ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
            queuedAtColumn: 'reminder_24h_queued_at',
            scheduledAfterIso: oneHourFromNow.toISOString(),
            scheduledBeforeOrAtIso: twentyFourHoursFromNow.toISOString(),
            limit: remainingLimit,
          })
        : [];

    return [
      ...oneHourRows.map((row) => ({
        tenantId: row.tenant_id,
        appointmentId: row.id,
        kind: 'reminder_1h' as const,
      })),
      ...twentyFourHourRows.map((row) => ({
        tenantId: row.tenant_id,
        appointmentId: row.id,
        kind: 'reminder_24h' as const,
      })),
    ];
  }

  async isCustomerOptedOut(input: {
    tenantId: string;
    customerIdentifier: string;
  }): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('opt_outs')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('channel', 'whatsapp')
      .eq('customer_identifier', input.customerIdentifier)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read appointment opt-out', error);
    }

    return Boolean(data?.id);
  }

  async markNotificationQueued(input: {
    tenantId: string;
    appointmentId: string;
    kind: AppointmentNotificationKind;
    queuedAt: Date;
  }): Promise<void> {
    const column = queuedAtColumnForNotification(input.kind);
    const { error } = await this.supabase
      .from('appointments')
      .update({
        [column]: input.queuedAt.toISOString(),
        ...(input.kind === 'reminder_24h' || input.kind === 'reminder_1h'
          ? { reminded_at: input.queuedAt.toISOString() }
          : {}),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.appointmentId);

    if (error) {
      throw toRepositoryError('Failed to mark appointment notification queued', error);
    }
  }

  private async queryDueReminderRows(input: {
    tenantId?: string;
    queuedAtColumn: 'reminder_24h_queued_at' | 'reminder_1h_queued_at';
    scheduledAfterIso: string;
    scheduledBeforeOrAtIso: string;
    limit: number;
  }): Promise<DueReminderRow[]> {
    let query = this.supabase
      .from('appointments')
      .select('id, tenant_id')
      .eq('status', 'confirmed')
      .is(input.queuedAtColumn, null)
      .gt('scheduled_at', input.scheduledAfterIso)
      .lte('scheduled_at', input.scheduledBeforeOrAtIso)
      .order('scheduled_at', { ascending: true })
      .limit(input.limit);

    if (input.tenantId) {
      query = query.eq('tenant_id', input.tenantId);
    }

    const { data, error } = await query;

    if (error) {
      throw toRepositoryError('Failed to list due appointment reminders', error);
    }

    return (data ?? []) as DueReminderRow[];
  }
}

export function createAppointmentNotificationService(): AppointmentNotificationService {
  return new AppointmentNotificationService(
    new SupabaseAppointmentNotificationRepository(),
    createWhatsAppTemplateMessageService(),
  );
}

function templateKeyForNotification(kind: AppointmentNotificationKind): WhatsAppTemplateKey {
  switch (kind) {
    case 'confirmation':
      return 'appointment_confirmation';
    case 'reminder_24h':
      return 'appointment_reminder_24h';
    case 'reminder_1h':
      return 'appointment_reminder_1h';
    case 'cancellation':
      return 'appointment_cancellation';
  }
}

function queuedAtColumnForNotification(
  kind: AppointmentNotificationKind,
):
  | 'confirmation_queued_at'
  | 'reminder_24h_queued_at'
  | 'reminder_1h_queued_at'
  | 'cancellation_queued_at' {
  switch (kind) {
    case 'confirmation':
      return 'confirmation_queued_at';
    case 'reminder_24h':
      return 'reminder_24h_queued_at';
    case 'reminder_1h':
      return 'reminder_1h_queued_at';
    case 'cancellation':
      return 'cancellation_queued_at';
  }
}

function variablesForAppointment(context: AppointmentNotificationContext): Record<string, string> {
  return {
    customerName: context.customerName,
    serviceName: context.serviceName ?? 'appuntamento',
    scheduledAt: formatAppointmentDate(context.scheduledAt, context.timezone),
    studioName: context.studioName,
  };
}

function formatAppointmentDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: timezone || 'Europe/Rome',
  }).format(date);
}

function isValidAppointmentStatusForNotification(
  status: AppointmentNotificationContext['status'],
  kind: AppointmentNotificationKind,
): boolean {
  if (kind === 'cancellation') {
    return status === 'cancelled';
  }

  return status === 'confirmed';
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
