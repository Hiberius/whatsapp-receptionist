import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import {
  WhatsAppWebhookService,
  type ProcessWhatsAppWebhookContext,
} from '@/server/whatsapp/service';
import type {
  EnqueueOutboundMessageInput,
  EnqueueOutboundMessageResult,
  EnqueueVoiceProcessingJobInput,
  EnqueueVoiceProcessingJobResult,
  InsertInboundMessageInput,
  InsertInboundMessageResult,
  InsertOutboundMessageInput,
  InsertOutboundMessageResult,
  RecordWebhookEventInput,
  RecordWebhookEventResult,
  TenantMessagingConfig,
  TenantResolution,
  UpdateInboundMessageAnalysisInput,
  UpsertConversationInput,
  UpsertConversationResult,
  WhatsAppMessageStatus,
  WhatsAppWebhookRepository,
} from '@/server/whatsapp/repository';
import { WhatsAppWebhookPayloadSchema } from '@/types/whatsapp';

const context: ProcessWhatsAppWebhookContext = {
  requestId: 'req_test',
  ipAddress: '127.0.0.1',
};

describe('WhatsAppWebhookService', () => {
  it('persists inbound WhatsApp messages once and increments usage', async () => {
    const repository = new FakeWhatsAppWebhookRepository();
    repository.tenants.set('phone_123', {
      integrationId: 'integration_1',
      tenantId: 'tenant_1',
    });
    const service = new WhatsAppWebhookService(repository);
    const payload = textPayload('wamid.1');

    const first = await service.processPayload(payload, context);
    const second = await service.processPayload(payload, context);

    expect(first).toMatchObject({
      processedEvents: 1,
      duplicateEvents: 0,
      failedEvents: 0,
    });
    expect(second).toMatchObject({
      processedEvents: 0,
      duplicateEvents: 1,
      failedEvents: 0,
    });
    expect(repository.messages).toHaveLength(1);
    expect(repository.messages[0]?.content).toBe('Vorrei prenotare domani');
    expect(repository.usageIncrements).toEqual([
      { tenantId: 'tenant_1', metricMonth: '2025-10-01', messagesDelta: 1 },
    ]);
    expect(repository.outboundMessages).toHaveLength(0);
  });

  it('records unresolved tenants without throwing to the webhook provider', async () => {
    const repository = new FakeWhatsAppWebhookRepository();
    const service = new WhatsAppWebhookService(repository);

    const result = await service.processPayload(textPayload('wamid.2'), context);

    expect(result.unresolvedTenantEvents).toBe(1);
    expect(result.failedEvents).toBe(0);
    expect(repository.failedEvents[0]?.error.code).toBe('tenant_not_found');
  });

  it('rejects payloads without messages or statuses', async () => {
    const repository = new FakeWhatsAppWebhookRepository();
    const service = new WhatsAppWebhookService(repository);
    const payload = WhatsAppWebhookPayloadSchema.parse({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '390212345678',
                  phone_number_id: 'phone_123',
                },
              },
            },
          ],
        },
      ],
    });

    await expect(service.processPayload(payload, context)).rejects.toMatchObject({
      code: 'bad_request',
    });
  });

  it('surfaces transient processing failures so WhatsApp can retry', async () => {
    const repository = new FakeWhatsAppWebhookRepository();
    repository.tenants.set('phone_123', {
      integrationId: 'integration_1',
      tenantId: 'tenant_1',
    });
    repository.failNextMessageInsert = true;
    const service = new WhatsAppWebhookService(repository);

    await expect(service.processPayload(textPayload('wamid.3'), context)).rejects.toMatchObject({
      code: 'upstream_error',
    });

    expect(repository.failedEvents[0]?.error.code).toBe('upstream_error');
  });

  it('classifies inbound text and queues a gated AI auto-reply', async () => {
    const repository = new FakeWhatsAppWebhookRepository();
    repository.tenants.set('phone_123', {
      integrationId: 'integration_1',
      tenantId: 'tenant_1',
    });
    repository.tenantConfigs.set('tenant_1', {
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: true,
      autoReplyEnabled: true,
      defaultLocale: 'it-IT',
    });
    const service = new WhatsAppWebhookService(repository, {
      autoReplyEnabled: true,
    });

    const result = await service.processPayload(textPayload('wamid.4'), context);

    expect(result.processedEvents).toBe(1);
    expect(repository.messageAnalyses[0]).toMatchObject({
      intent: 'booking_request',
    });
    expect(repository.outboundMessages).toHaveLength(1);
    expect(repository.outboundMessages[0]?.externalId).toBe('auto-reply:message:wamid.4');
    expect(repository.outboxJobs[0]).toMatchObject({
      recipientIdentifier: '393331112233',
    });
    expect(repository.outboxJobs[0]?.payload).toMatchObject({
      type: 'text',
      text: {
        body: expect.stringContaining('sono Ambrogio'),
      },
    });
    expect(repository.usageIncrements).toEqual([
      { tenantId: 'tenant_1', metricMonth: '2025-10-01', messagesDelta: 1 },
      {
        tenantId: 'tenant_1',
        metricMonth: '2025-10-01',
        messagesDelta: 1,
        aiCostCentsDelta: 0,
      },
    ]);
  });

  it('does not auto-reply to opted-out WhatsApp customers', async () => {
    const repository = new FakeWhatsAppWebhookRepository();
    repository.tenants.set('phone_123', {
      integrationId: 'integration_1',
      tenantId: 'tenant_1',
    });
    repository.tenantConfigs.set('tenant_1', {
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: true,
      autoReplyEnabled: true,
      defaultLocale: 'it-IT',
    });
    repository.optOuts.add('tenant_1:whatsapp:393331112233');
    const service = new WhatsAppWebhookService(repository, {
      autoReplyEnabled: true,
    });

    await service.processPayload(textPayload('wamid.5'), context);

    expect(repository.messageAnalyses[0]).toMatchObject({
      intent: 'booking_request',
    });
    expect(repository.outboundMessages).toHaveLength(0);
    expect(repository.outboxJobs).toHaveLength(0);
  });

  it('queues audio messages for the voice transcription worker', async () => {
    const repository = new FakeWhatsAppWebhookRepository();
    repository.tenants.set('phone_123', {
      integrationId: 'integration_1',
      tenantId: 'tenant_1',
    });
    const service = new WhatsAppWebhookService(repository);

    const result = await service.processPayload(audioPayload('wamid.audio'), context);

    expect(result.processedEvents).toBe(1);
    expect(repository.messages).toHaveLength(1);
    expect(repository.messages[0]).toMatchObject({
      messageType: 'audio',
      content: null,
    });
    expect(repository.voiceJobs[0]).toMatchObject({
      mediaId: 'media_audio_1',
      mediaMimeType: 'audio/ogg',
      mediaSha256: 'audio_hash',
    });
    expect(repository.messageAnalyses).toHaveLength(0);
    expect(repository.outboxJobs).toHaveLength(0);
  });

  it('persists opt-out keywords without treating appointment cancellation as opt-out', async () => {
    const repository = new FakeWhatsAppWebhookRepository();
    repository.tenants.set('phone_123', {
      integrationId: 'integration_1',
      tenantId: 'tenant_1',
    });
    repository.tenantConfigs.set('tenant_1', {
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: true,
      autoReplyEnabled: true,
      defaultLocale: 'it-IT',
    });
    const service = new WhatsAppWebhookService(repository, {
      autoReplyEnabled: true,
    });

    await service.processPayload(textPayload('wamid.stop', 'STOP'), context);
    await service.processPayload(
      textPayload('wamid.cancel-appointment', 'annulla appuntamento'),
      context,
    );

    expect(repository.optOuts.has('tenant_1:whatsapp:393331112233')).toBe(true);
    expect(repository.persistedOptOuts[0]).toMatchObject({
      reason: 'keyword_stop',
    });
    expect(repository.messageAnalyses[0]).toMatchObject({
      intent: 'other',
      metadata: {
        optOut: {
          reason: 'keyword_stop',
        },
      },
    });
    expect(repository.messageAnalyses[1]).toMatchObject({
      intent: 'cancellation_request',
    });
    expect(repository.outboundMessages[0]).toMatchObject({
      externalId: 'opt-out-confirmation:message:wamid.stop',
      content: expect.stringContaining('non riceverai piu messaggi automatici'),
      metadata: {
        source: 'whatsapp_opt_out_confirmation',
      },
    });
    expect(repository.outboxJobs[0]?.payload).toMatchObject({
      type: 'text',
      metadata: {
        source: 'whatsapp_opt_out_confirmation',
      },
    });
    expect(repository.outboxJobs).toHaveLength(1);
  });
});

function textPayload(messageId: string, body = 'Vorrei prenotare domani') {
  return WhatsAppWebhookPayloadSchema.parse({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba_1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '390212345678',
                phone_number_id: 'phone_123',
              },
              messages: [
                {
                  from: '393331112233',
                  id: messageId,
                  timestamp: '1761300000',
                  type: 'text',
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

function audioPayload(messageId: string) {
  return WhatsAppWebhookPayloadSchema.parse({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba_1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '390212345678',
                phone_number_id: 'phone_123',
              },
              messages: [
                {
                  from: '393331112233',
                  id: messageId,
                  timestamp: '1761300060',
                  type: 'audio',
                  audio: {
                    id: 'media_audio_1',
                    mime_type: 'audio/ogg',
                    sha256: 'audio_hash',
                    voice: true,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

class FakeWhatsAppWebhookRepository implements WhatsAppWebhookRepository {
  readonly tenants = new Map<string, TenantResolution>();
  readonly tenantConfigs = new Map<string, TenantMessagingConfig>();
  readonly optOuts = new Set<string>();
  readonly persistedOptOuts: Array<{
    tenantId: string;
    channel: 'whatsapp';
    customerIdentifier: string;
    reason: string;
    optedOutAt: Date;
  }> = [];
  readonly webhookKeys = new Set<string>();
  readonly messages: InsertInboundMessageInput[] = [];
  readonly messageAnalyses: UpdateInboundMessageAnalysisInput[] = [];
  readonly outboundMessages: InsertOutboundMessageInput[] = [];
  readonly outboxJobs: EnqueueOutboundMessageInput[] = [];
  readonly voiceJobs: EnqueueVoiceProcessingJobInput[] = [];
  readonly usageIncrements: Array<{
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
    aiCostCentsDelta?: number;
  }> = [];
  readonly failedEvents: Array<{
    eventId: string;
    error: { code: string; message: string };
    tenantId?: string;
  }> = [];
  failNextMessageInsert = false;

  async recordWebhookEvent(input: RecordWebhookEventInput): Promise<RecordWebhookEventResult> {
    if (this.webhookKeys.has(input.idempotencyKey)) {
      return { eventId: null, duplicate: true };
    }

    this.webhookKeys.add(input.idempotencyKey);

    return { eventId: `event_${this.webhookKeys.size}`, duplicate: false };
  }

  async markWebhookEventProcessed(): Promise<void> {
    return Promise.resolve();
  }

  async markWebhookEventFailed(
    eventId: string,
    error: { code: string; message: string },
    tenantId?: string,
  ): Promise<void> {
    this.failedEvents.push({
      eventId,
      error,
      ...(tenantId !== undefined ? { tenantId } : {}),
    });
  }

  async resolveTenantByPhoneNumberId(phoneNumberId: string): Promise<TenantResolution | null> {
    return this.tenants.get(phoneNumberId) ?? null;
  }

  async upsertConversation(input: UpsertConversationInput): Promise<UpsertConversationResult> {
    return {
      conversationId: `conversation:${input.tenantId}:${input.customerIdentifier}`,
    };
  }

  async insertInboundMessage(
    input: InsertInboundMessageInput,
  ): Promise<InsertInboundMessageResult> {
    if (this.failNextMessageInsert) {
      this.failNextMessageInsert = false;
      throw new AppError('upstream_error', 'Transient database failure');
    }

    if (
      this.messages.some(
        (message) => message.tenantId === input.tenantId && message.externalId === input.externalId,
      )
    ) {
      return { messageId: null, created: false };
    }

    this.messages.push(input);

    return { messageId: `message_${this.messages.length}`, created: true };
  }

  async updateInboundMessageAnalysis(input: UpdateInboundMessageAnalysisInput): Promise<void> {
    this.messageAnalyses.push(input);
  }

  async getTenantMessagingConfig(tenantId: string): Promise<TenantMessagingConfig> {
    return (
      this.tenantConfigs.get(tenantId) ?? {
        assistantName: 'Ambrogio',
        aiDisclosureEnabled: true,
        autoReplyEnabled: false,
        defaultLocale: 'it-IT',
      }
    );
  }

  async isCustomerOptedOut(input: {
    tenantId: string;
    channel: 'whatsapp';
    customerIdentifier: string;
  }): Promise<boolean> {
    return this.optOuts.has(`${input.tenantId}:${input.channel}:${input.customerIdentifier}`);
  }

  async upsertCustomerOptOut(input: {
    tenantId: string;
    channel: 'whatsapp';
    customerIdentifier: string;
    reason: string;
    optedOutAt: Date;
  }): Promise<void> {
    this.persistedOptOuts.push(input);
    this.optOuts.add(`${input.tenantId}:${input.channel}:${input.customerIdentifier}`);
  }

  async insertOutboundMessage(
    input: InsertOutboundMessageInput,
  ): Promise<InsertOutboundMessageResult> {
    if (
      this.outboundMessages.some(
        (message) => message.tenantId === input.tenantId && message.externalId === input.externalId,
      )
    ) {
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
    if (this.outboxJobs.some((job) => job.messageId === input.messageId)) {
      return { jobId: null, created: false };
    }

    this.outboxJobs.push(input);

    return {
      jobId: `job_${this.outboxJobs.length}`,
      created: true,
    };
  }

  async enqueueVoiceProcessingJob(
    input: EnqueueVoiceProcessingJobInput,
  ): Promise<EnqueueVoiceProcessingJobResult> {
    if (this.voiceJobs.some((job) => job.messageId === input.messageId)) {
      return { jobId: null, created: false };
    }

    this.voiceJobs.push(input);

    return {
      jobId: `voice_job_${this.voiceJobs.length}`,
      created: true,
    };
  }

  async updateOutboundMessageStatus(_input: {
    tenantId: string;
    providerMessageId: string;
    status: WhatsAppMessageStatus;
  }): Promise<void> {
    return Promise.resolve();
  }

  async incrementUsage(input: {
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
    aiCostCentsDelta?: number;
  }): Promise<void> {
    this.usageIncrements.push(input);
  }
}
