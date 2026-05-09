import { describe, expect, it } from 'vitest';

import {
  AppointmentNotificationService,
  type AppointmentNotificationContext,
  type AppointmentNotificationKind,
  type AppointmentNotificationRepository,
  type DueAppointmentReminder,
  type TemplateMessageEnqueuer,
} from '@/server/appointments/notifications';
import type {
  EnqueueTemplateMessageInput,
  EnqueueTemplateMessageResult,
} from '@/server/whatsapp/templates';

const now = new Date('2026-04-25T10:00:00.000Z');

describe('AppointmentNotificationService', () => {
  it('enqueues appointment confirmations through approved WhatsApp templates', async () => {
    const repository = new FakeAppointmentNotificationRepository([appointmentContext()]);
    const templates = new FakeTemplateMessageEnqueuer();
    const service = new AppointmentNotificationService(repository, templates);

    const result = await service.enqueueNotification({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      kind: 'confirmation',
      now,
    });

    expect(result).toMatchObject({
      appointmentId: 'appointment_1',
      kind: 'confirmation',
      queued: true,
      skippedReason: null,
    });
    expect(templates.calls[0]).toMatchObject({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      recipientIdentifier: '393331112233',
      templateKey: 'appointment_confirmation',
      idempotencyKey: 'appointment_1:confirmation',
      variables: {
        customerName: 'Mario Rossi',
        serviceName: 'Prima visita',
        studioName: 'Studio Ambrogio',
      },
      metadata: {
        appointmentId: 'appointment_1',
        appointmentNotificationKind: 'confirmation',
      },
    });
    expect(templates.calls[0]?.variables.scheduledAt).toContain('2026');
    expect(repository.queuedNotifications[0]).toEqual({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      kind: 'confirmation',
      queuedAt: now,
    });
  });

  it('processes due 1h and 24h reminders', async () => {
    const repository = new FakeAppointmentNotificationRepository([
      appointmentContext({ appointmentId: 'appointment_1' }),
      appointmentContext({ appointmentId: 'appointment_2' }),
    ]);
    repository.dueReminders = [
      {
        tenantId: 'tenant_1',
        appointmentId: 'appointment_1',
        kind: 'reminder_1h',
      },
      {
        tenantId: 'tenant_1',
        appointmentId: 'appointment_2',
        kind: 'reminder_24h',
      },
    ];
    const templates = new FakeTemplateMessageEnqueuer();
    const service = new AppointmentNotificationService(repository, templates);

    const result = await service.processDueReminders({
      now,
      limit: 10,
    });

    expect(result).toEqual({
      candidateReminders: 2,
      queuedReminders: 2,
      skippedReminders: 0,
      failedReminders: 0,
    });
    expect(templates.calls.map((call) => call.templateKey)).toEqual([
      'appointment_reminder_1h',
      'appointment_reminder_24h',
    ]);
    expect(repository.queuedNotifications.map((item) => item.kind)).toEqual([
      'reminder_1h',
      'reminder_24h',
    ]);
  });

  it('skips opted-out WhatsApp recipients', async () => {
    const repository = new FakeAppointmentNotificationRepository([appointmentContext()]);
    repository.optOuts.add('tenant_1:393331112233');
    const templates = new FakeTemplateMessageEnqueuer();
    const service = new AppointmentNotificationService(repository, templates);

    const result = await service.enqueueNotification({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      kind: 'reminder_24h',
      now,
    });

    expect(result).toMatchObject({
      queued: false,
      skippedReason: 'opted_out',
      templateResult: null,
    });
    expect(templates.calls).toHaveLength(0);
    expect(repository.queuedNotifications).toHaveLength(0);
  });

  it('marks duplicate outbound notifications as queued to avoid reminder loops', async () => {
    const repository = new FakeAppointmentNotificationRepository([appointmentContext()]);
    const templates = new FakeTemplateMessageEnqueuer({
      queued: false,
      skippedReason: 'duplicate_outbound',
      outboundMessageId: null,
      outboxJobId: null,
      templateName: 'appointment_reminder_24h',
      languageCode: 'it',
    });
    const service = new AppointmentNotificationService(repository, templates);

    const result = await service.enqueueNotification({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      kind: 'reminder_24h',
      now,
    });

    expect(result).toMatchObject({
      queued: false,
      skippedReason: 'duplicate_outbound',
    });
    expect(repository.queuedNotifications[0]).toMatchObject({
      kind: 'reminder_24h',
    });
  });

  it('does not send reminders for cancelled appointments', async () => {
    const repository = new FakeAppointmentNotificationRepository([
      appointmentContext({ status: 'cancelled' }),
    ]);
    const templates = new FakeTemplateMessageEnqueuer();
    const service = new AppointmentNotificationService(repository, templates);

    const result = await service.enqueueNotification({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      kind: 'reminder_1h',
      now,
    });

    expect(result).toMatchObject({
      queued: false,
      skippedReason: 'appointment_not_confirmed',
      templateResult: null,
    });
    expect(templates.calls).toHaveLength(0);
  });

  it('allows cancellation notifications only for cancelled appointments', async () => {
    const repository = new FakeAppointmentNotificationRepository([
      appointmentContext({ status: 'cancelled' }),
    ]);
    const templates = new FakeTemplateMessageEnqueuer();
    const service = new AppointmentNotificationService(repository, templates);

    await service.enqueueNotification({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      kind: 'cancellation',
      now,
    });

    expect(templates.calls[0]).toMatchObject({
      templateKey: 'appointment_cancellation',
      idempotencyKey: 'appointment_1:cancellation',
    });
  });
});

function appointmentContext(
  overrides: Partial<AppointmentNotificationContext> = {},
): AppointmentNotificationContext {
  return {
    tenantId: 'tenant_1',
    appointmentId: overrides.appointmentId ?? 'appointment_1',
    conversationId: 'conversation_1',
    customerIdentifier: '393331112233',
    customerPhone: null,
    customerName: 'Mario Rossi',
    scheduledAt: new Date('2026-04-25T10:00:00.000Z'),
    serviceName: 'Prima visita',
    status: 'confirmed',
    studioName: 'Studio Ambrogio',
    timezone: 'Europe/Rome',
    ...overrides,
  };
}

class FakeAppointmentNotificationRepository implements AppointmentNotificationRepository {
  readonly contexts = new Map<string, AppointmentNotificationContext>();
  readonly optOuts = new Set<string>();
  readonly queuedNotifications: Array<{
    tenantId: string;
    appointmentId: string;
    kind: AppointmentNotificationKind;
    queuedAt: Date;
  }> = [];
  dueReminders: DueAppointmentReminder[] = [];

  constructor(contexts: AppointmentNotificationContext[]) {
    for (const context of contexts) {
      this.contexts.set(`${context.tenantId}:${context.appointmentId}`, context);
    }
  }

  async getAppointmentNotificationContext(input: {
    tenantId: string;
    appointmentId: string;
  }): Promise<AppointmentNotificationContext | null> {
    return this.contexts.get(`${input.tenantId}:${input.appointmentId}`) ?? null;
  }

  async listDueReminders(): Promise<DueAppointmentReminder[]> {
    return this.dueReminders;
  }

  async isCustomerOptedOut(input: {
    tenantId: string;
    customerIdentifier: string;
  }): Promise<boolean> {
    return this.optOuts.has(`${input.tenantId}:${input.customerIdentifier}`);
  }

  async markNotificationQueued(input: {
    tenantId: string;
    appointmentId: string;
    kind: AppointmentNotificationKind;
    queuedAt: Date;
  }): Promise<void> {
    this.queuedNotifications.push(input);
  }
}

class FakeTemplateMessageEnqueuer implements TemplateMessageEnqueuer {
  readonly calls: EnqueueTemplateMessageInput[] = [];

  constructor(
    private readonly result: EnqueueTemplateMessageResult = {
      queued: true,
      skippedReason: null,
      outboundMessageId: 'outbound_1',
      outboxJobId: 'job_1',
      templateName: 'appointment_confirmation',
      languageCode: 'it',
    },
  ) {}

  async enqueueTemplateMessage(
    input: EnqueueTemplateMessageInput,
  ): Promise<EnqueueTemplateMessageResult> {
    this.calls.push(input);

    return this.result;
  }
}
