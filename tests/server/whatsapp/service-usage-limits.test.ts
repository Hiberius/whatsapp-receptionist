// Test mirati per WhatsAppWebhookService non coperti in webhook-service.test.ts:
// usageLimits hook (registerInboundConversation), status delivery events,
// payload vuoto. Usa fake repository minimal che soddisfa l'interfaccia.

import { describe, expect, it, vi } from 'vitest';

import {
  WhatsAppWebhookService,
  type ProcessWhatsAppWebhookContext,
} from '@/server/whatsapp/service';
import type { UsageLimitsService } from '@/server/usage/limits';
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

const ctx: ProcessWhatsAppWebhookContext = {
  requestId: 'req_usage',
  ipAddress: '127.0.0.1',
};

describe('WhatsAppWebhookService.processPayload (edge cases)', () => {
  it('rejects payload that produces zero processable events', async () => {
    // Arrange: payload Zod-valido ma con entry vuoto -> nessun evento estraibile
    const repo = new MinimalRepo();
    const service = new WhatsAppWebhookService(repo);
    const emptyPayload = WhatsAppWebhookPayloadSchema.parse({
      object: 'whatsapp_business_account',
      entry: [],
    });

    // Act + Assert
    await expect(service.processPayload(emptyPayload, ctx)).rejects.toMatchObject({
      code: 'bad_request',
    });
  });

  it('marks unresolved tenant when phone_number_id has no integration', async () => {
    // Arrange
    const repo = new MinimalRepo();
    // tenants vuoto: nessuna risoluzione
    const service = new WhatsAppWebhookService(repo);

    // Act
    const result = await service.processPayload(textPayload('wamid.unresolved'), ctx);

    // Assert
    expect(result).toMatchObject({
      processedEvents: 0,
      unresolvedTenantEvents: 1,
      failedEvents: 0,
    });
    expect(repo.failedEvents[0]?.error.code).toBe('tenant_not_found');
  });

  it('updates outbound status for status events', async () => {
    // Arrange
    const repo = new MinimalRepo();
    repo.tenants.set('phone_123', { integrationId: 'int_1', tenantId: 'tenant_1' });
    const service = new WhatsAppWebhookService(repo);

    // Act
    const result = await service.processPayload(statusPayload('wamid.status', 'delivered'), ctx);

    // Assert
    expect(result.processedEvents).toBe(1);
    expect(repo.statusUpdates).toEqual([
      { tenantId: 'tenant_1', providerMessageId: 'wamid.status', status: 'delivered' },
    ]);
  });
});

describe('WhatsAppWebhookService.processPayload (usageLimits hook)', () => {
  it('invokes registerInboundConversation when usageLimits service is provided', async () => {
    // Arrange
    const repo = new MinimalRepo();
    repo.tenants.set('phone_123', { integrationId: 'int_1', tenantId: 'tenant_1' });
    const usageLimits = {
      registerInboundConversation: vi.fn(async () => ({ counted: true })),
    } satisfies Pick<UsageLimitsService, 'registerInboundConversation'>;
    // Il service utilizza solo registerInboundConversation: castiamo con
    // helper tipato per evitare `any`.
    const service = new WhatsAppWebhookService(repo, {
      // eslint-disable-next-line no-restricted-syntax -- fake con sola superficie usata dal service
      usageLimits: usageLimits as unknown as UsageLimitsService,
    });

    // Act
    await service.processPayload(textPayload('wamid.usage'), ctx);

    // Assert
    expect(usageLimits.registerInboundConversation).toHaveBeenCalledWith({
      tenantId: 'tenant_1',
      customerIdentifier: '393331112233',
      channel: 'whatsapp',
      now: expect.any(Date),
    });
  });

  it('does not call usageLimits on duplicate inbound (created=false)', async () => {
    // Arrange
    const repo = new MinimalRepo();
    repo.tenants.set('phone_123', { integrationId: 'int_1', tenantId: 'tenant_1' });
    repo.preInsertedExternalIds.add('message:wamid.dup');
    const usageLimits = {
      registerInboundConversation: vi.fn(async () => ({ counted: true })),
    };
    const service = new WhatsAppWebhookService(repo, {
      usageLimits: usageLimits as any,
    });

    // Act
    await service.processPayload(textPayload('wamid.dup'), ctx);

    // Assert: con created=false (duplicato a livello messages) il service salta usage hook
    expect(usageLimits.registerInboundConversation).not.toHaveBeenCalled();
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

function statusPayload(messageId: string, status: WhatsAppMessageStatus) {
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
              statuses: [
                {
                  id: messageId,
                  recipient_id: '393331112233',
                  status,
                  timestamp: '1761300000',
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

class MinimalRepo implements WhatsAppWebhookRepository {
  readonly tenants = new Map<string, TenantResolution>();
  readonly preInsertedExternalIds = new Set<string>();
  readonly failedEvents: Array<{
    eventId: string;
    error: { code: string; message: string };
    tenantId?: string;
  }> = [];
  readonly statusUpdates: Array<{
    tenantId: string;
    providerMessageId: string;
    status: WhatsAppMessageStatus;
  }> = [];
  private webhookCounter = 0;
  private outboundCounter = 0;

  async recordWebhookEvent(_input: RecordWebhookEventInput): Promise<RecordWebhookEventResult> {
    this.webhookCounter += 1;
    return { eventId: `event_${this.webhookCounter}`, duplicate: false };
  }

  async markWebhookEventProcessed(): Promise<void> {}

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
    return { conversationId: `conv:${input.tenantId}:${input.customerIdentifier}` };
  }

  async insertInboundMessage(
    input: InsertInboundMessageInput,
  ): Promise<InsertInboundMessageResult> {
    if (this.preInsertedExternalIds.has(input.externalId)) {
      return { messageId: null, created: false };
    }

    return { messageId: `msg_${input.externalId}`, created: true };
  }

  async updateInboundMessageAnalysis(_input: UpdateInboundMessageAnalysisInput): Promise<void> {}

  async getTenantMessagingConfig(_tenantId: string): Promise<TenantMessagingConfig> {
    return {
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: false,
      autoReplyEnabled: false,
      defaultLocale: 'it-IT',
    };
  }

  async isCustomerOptedOut(_input: {
    tenantId: string;
    channel: 'whatsapp';
    customerIdentifier: string;
  }): Promise<boolean> {
    return false;
  }

  async upsertCustomerOptOut(): Promise<void> {}

  async insertOutboundMessage(
    _input: InsertOutboundMessageInput,
  ): Promise<InsertOutboundMessageResult> {
    this.outboundCounter += 1;
    return { messageId: `out_${this.outboundCounter}`, created: true };
  }

  async enqueueOutboundMessage(
    input: EnqueueOutboundMessageInput,
  ): Promise<EnqueueOutboundMessageResult> {
    return { jobId: `job_${input.messageId}`, created: true };
  }

  async enqueueVoiceProcessingJob(
    input: EnqueueVoiceProcessingJobInput,
  ): Promise<EnqueueVoiceProcessingJobResult> {
    return { jobId: `voice_${input.messageId}`, created: true };
  }

  async updateOutboundMessageStatus(input: {
    tenantId: string;
    providerMessageId: string;
    status: WhatsAppMessageStatus;
  }): Promise<void> {
    this.statusUpdates.push(input);
  }

  async incrementUsage(): Promise<void> {}
}
