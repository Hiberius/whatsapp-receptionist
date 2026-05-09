import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import {
  WhatsAppTemplateMessageService,
  getWhatsAppTemplateDefinition,
  type ApprovedWhatsAppTemplate,
  type WhatsAppTemplateMessageRepository,
} from '@/server/whatsapp/templates';
import type {
  EnqueueOutboundMessageInput,
  EnqueueOutboundMessageResult,
  InsertOutboundMessageInput,
  InsertOutboundMessageResult,
} from '@/server/whatsapp/repository';

const now = new Date('2026-04-25T10:00:00.000Z');

describe('WhatsAppTemplateMessageService', () => {
  it('enqueues approved appointment reminder templates', async () => {
    const repository = new FakeTemplateRepository();
    repository.approvedTemplates.set(templateKey('tenant_1', 'appointment_reminder_24h', 'it'), {
      id: 'template_1',
      name: 'appointment_reminder_24h',
      languageCode: 'it',
      category: 'utility',
    });
    const service = new WhatsAppTemplateMessageService(repository);

    const result = await service.enqueueTemplateMessage({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      recipientIdentifier: '393331112233',
      templateKey: 'appointment_reminder_24h',
      idempotencyKey: 'appointment_123:reminder_24h',
      createdAt: now,
      variables: {
        customerName: 'Mario Rossi',
        scheduledAt: 'domani alle 10:00',
        studioName: 'Studio Ambrogio',
      },
      metadata: {
        appointmentId: 'appointment_123',
      },
    });

    expect(result).toEqual({
      queued: true,
      skippedReason: null,
      outboundMessageId: 'outbound_1',
      outboxJobId: 'job_1',
      templateName: 'appointment_reminder_24h',
      languageCode: 'it',
    });
    expect(repository.outboundMessages[0]).toMatchObject({
      externalId: 'template:appointment_reminder_24h:appointment_123:reminder_24h',
      content: 'Promemoria per Mario Rossi: appuntamento domani alle 10:00 presso Studio Ambrogio.',
      metadata: {
        source: 'whatsapp_template',
        templateKey: 'appointment_reminder_24h',
        templateId: 'template_1',
        appointmentId: 'appointment_123',
      },
    });
    expect(repository.outboxJobs[0]?.payload).toMatchObject({
      type: 'template',
      template: {
        name: 'appointment_reminder_24h',
        languageCode: 'it',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Mario Rossi' },
              { type: 'text', text: 'domani alle 10:00' },
              { type: 'text', text: 'Studio Ambrogio' },
            ],
          },
        ],
      },
      metadata: {
        source: 'whatsapp_template',
        templateId: 'template_1',
      },
    });
    expect(repository.usageIncrements).toEqual([
      { tenantId: 'tenant_1', metricMonth: '2026-04-01', messagesDelta: 1 },
    ]);
  });

  it('requires every variable declared by the template definition', async () => {
    const repository = new FakeTemplateRepository();
    const service = new WhatsAppTemplateMessageService(repository);

    await expect(
      service.enqueueTemplateMessage({
        tenantId: 'tenant_1',
        conversationId: 'conversation_1',
        recipientIdentifier: '393331112233',
        templateKey: 'appointment_confirmation',
        idempotencyKey: 'appointment_123:confirmation',
        variables: {
          customerName: 'Mario Rossi',
          scheduledAt: 'domani alle 10:00',
          studioName: 'Studio Ambrogio',
        },
      }),
    ).rejects.toMatchObject({
      code: 'bad_request',
      message: 'Missing WhatsApp template variable: serviceName',
    });
    expect(repository.outboundMessages).toHaveLength(0);
  });

  it('does not enqueue templates that are not approved for the tenant', async () => {
    const repository = new FakeTemplateRepository();
    const service = new WhatsAppTemplateMessageService(repository);

    await expect(
      service.enqueueTemplateMessage({
        tenantId: 'tenant_1',
        conversationId: 'conversation_1',
        recipientIdentifier: '393331112233',
        templateKey: 'appointment_cancellation',
        idempotencyKey: 'appointment_123:cancellation',
        variables: {
          customerName: 'Mario Rossi',
          scheduledAt: 'domani alle 10:00',
          studioName: 'Studio Ambrogio',
        },
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(repository.outboundMessages).toHaveLength(0);
    expect(repository.outboxJobs).toHaveLength(0);
  });

  it('returns duplicate_outbound when the outbound message already exists', async () => {
    const repository = new FakeTemplateRepository();
    repository.approvedTemplates.set(templateKey('tenant_1', 'appointment_reminder_1h', 'it'), {
      id: 'template_2',
      name: 'appointment_reminder_1h',
      languageCode: 'it',
      category: 'utility',
    });
    repository.duplicateExternalIds.add(
      'template:appointment_reminder_1h:appointment_123:reminder_1h',
    );
    const service = new WhatsAppTemplateMessageService(repository);

    const result = await service.enqueueTemplateMessage({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      recipientIdentifier: '393331112233',
      templateKey: 'appointment_reminder_1h',
      idempotencyKey: 'appointment_123:reminder_1h',
      variables: {
        customerName: 'Mario Rossi',
        scheduledAt: 'oggi alle 10:00',
        studioName: 'Studio Ambrogio',
      },
    });

    expect(result).toMatchObject({
      queued: false,
      skippedReason: 'duplicate_outbound',
      outboundMessageId: null,
      outboxJobId: null,
    });
    expect(repository.outboxJobs).toHaveLength(0);
  });

  it('exposes template definitions for schedulers and booking workers', () => {
    expect(getWhatsAppTemplateDefinition('appointment_confirmation')).toMatchObject({
      name: 'appointment_confirmation',
      category: 'utility',
      requiredVariables: ['customerName', 'serviceName', 'scheduledAt', 'studioName'],
    });
  });
});

function templateKey(tenantId: string, name: string, languageCode: string): string {
  return `${tenantId}:${name}:${languageCode}`;
}

class FakeTemplateRepository implements WhatsAppTemplateMessageRepository {
  readonly approvedTemplates = new Map<string, ApprovedWhatsAppTemplate>();
  readonly outboundMessages: InsertOutboundMessageInput[] = [];
  readonly outboxJobs: EnqueueOutboundMessageInput[] = [];
  readonly usageIncrements: Array<{
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
  }> = [];
  readonly duplicateExternalIds = new Set<string>();

  async findApprovedTemplate(input: {
    tenantId: string;
    name: string;
    languageCode: string;
  }): Promise<ApprovedWhatsAppTemplate | null> {
    return (
      this.approvedTemplates.get(templateKey(input.tenantId, input.name, input.languageCode)) ??
      null
    );
  }

  async insertOutboundMessage(
    input: InsertOutboundMessageInput,
  ): Promise<InsertOutboundMessageResult> {
    if (this.duplicateExternalIds.has(input.externalId)) {
      return { messageId: null, created: false };
    }

    this.outboundMessages.push(input);

    return {
      messageId: `outbound_${this.outboundMessages.length}`,
      created: true,
    };
  }

  async enqueueOutboundMessage(
    input: EnqueueOutboundMessageInput,
  ): Promise<EnqueueOutboundMessageResult> {
    this.outboxJobs.push(input);

    return {
      jobId: `job_${this.outboxJobs.length}`,
      created: true,
    };
  }

  async incrementUsage(input: {
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
  }): Promise<void> {
    this.usageIncrements.push(input);
  }
}
