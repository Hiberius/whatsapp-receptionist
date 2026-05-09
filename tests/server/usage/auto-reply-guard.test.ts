// Fatto da Claude Code il 27 aprile 2026.
//
// Verifica integrazione: il guard usage limits sull'auto-reply blocca
// l'outbound quando il piano e' esaurito ma lascia passare l'analisi/usage
// metering AI gia' fatto.

import { describe, expect, it } from 'vitest';

import {
  WhatsAppAutoReplyService,
  type WhatsAppAutoReplyRepository,
} from '@/server/whatsapp/auto-reply';
import {
  DEFAULT_USAGE_LIMITS_CONFIG,
  UsageLimitsService,
  type TenantUsageRow,
  type UsageLimitsRepository,
  type UsagePlanKey,
} from '@/server/usage/limits';
import type { ReplyOrchestrator, ReplyPlan } from '@/server/ai/reply-orchestrator';
import type {
  EnqueueOutboundMessageInput,
  EnqueueOutboundMessageResult,
  InsertOutboundMessageInput,
  InsertOutboundMessageResult,
  TenantMessagingConfig,
  UpdateInboundMessageAnalysisInput,
} from '@/server/whatsapp/repository';

const occurredAt = new Date('2026-04-27T12:00:00.000Z');

describe('WhatsAppAutoReplyService usage guard', () => {
  it('skips outbound when conversation limit is hit', async () => {
    const repository = new FakeAutoReplyRepository();
    repository.tenantConfigs.set('tenant_1', {
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: true,
      autoReplyEnabled: true,
      defaultLocale: 'it-IT',
    });

    const usageLimits = new UsageLimitsService(
      new FakeUsageRepository({
        plan: 'starter',
        usage: {
          conversationsCount: 500,
          messagesCount: 0,
          voiceMessagesCount: 0,
          aiCostCents: 0,
        },
      }),
      DEFAULT_USAGE_LIMITS_CONFIG,
    );

    const service = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
      replyOrchestrator: makeYesReplyOrchestrator(),
      usageLimits,
    });

    const result = await service.handleInboundMessage({
      tenantId: 'tenant_1',
      conversationId: 'conv_1',
      inboundMessageId: 'msg_1',
      inboundExternalId: 'wamid.test',
      customerIdentifier: '393331112233',
      text: 'Quanto costa una visita?',
      occurredAt,
      source: 'text',
      provider: 'whatsapp_360dialog',
      whatsappMessageId: 'wamid.test',
      phoneNumberId: '123',
      displayPhoneNumber: '+39 333',
    });

    expect(result).toMatchObject({
      analyzed: true,
      queued: false,
      skippedReason: 'usage_limit_reached',
    });
    expect(repository.outboundMessages).toHaveLength(0);
    expect(repository.outboxJobs).toHaveLength(0);
  });

  it('lets the auto-reply proceed when usage is under the limit', async () => {
    const repository = new FakeAutoReplyRepository();
    repository.tenantConfigs.set('tenant_1', {
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: true,
      autoReplyEnabled: true,
      defaultLocale: 'it-IT',
    });

    const usageLimits = new UsageLimitsService(
      new FakeUsageRepository({ plan: 'professional' }),
      DEFAULT_USAGE_LIMITS_CONFIG,
    );

    const service = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
      replyOrchestrator: makeYesReplyOrchestrator(),
      usageLimits,
    });

    const result = await service.handleInboundMessage({
      tenantId: 'tenant_1',
      conversationId: 'conv_1',
      inboundMessageId: 'msg_2',
      inboundExternalId: 'wamid.ok',
      customerIdentifier: '393331112233',
      text: 'Quanto costa una visita?',
      occurredAt,
      source: 'text',
      provider: 'whatsapp_360dialog',
      whatsappMessageId: 'wamid.ok',
      phoneNumberId: '123',
      displayPhoneNumber: '+39 333',
    });

    expect(result.queued).toBe(true);
    expect(result.skippedReason).toBeNull();
    expect(repository.outboundMessages).toHaveLength(1);
  });
});

function makeYesReplyOrchestrator(): ReplyOrchestrator {
  // Minimal stub: TypeScript-wise treat as ReplyOrchestrator via cast; only
  // `createReply` is invoked from the auto-reply service in this test.
  return {
    async createReply(): Promise<ReplyPlan> {
      return {
        shouldReply: true,
        replyText: 'Sono Ambrogio. La visita parte da 50 euro.',
        classification: {
          intent: 'pricing_question',
          confidence: 0.95,
          matchedSignals: [],
        },
      };
    },
    // eslint-disable-next-line no-restricted-syntax -- Test fixture, runtime validation not required
  } as unknown as ReplyOrchestrator;
}

class FakeAutoReplyRepository implements WhatsAppAutoReplyRepository {
  tenantConfigs = new Map<string, TenantMessagingConfig>();
  optedOut = new Set<string>();
  messageAnalyses: UpdateInboundMessageAnalysisInput[] = [];
  outboundMessages: InsertOutboundMessageInput[] = [];
  outboxJobs: EnqueueOutboundMessageInput[] = [];
  usageIncrements: Array<{
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
    aiCostCentsDelta?: number;
  }> = [];

  async getTenantMessagingConfig(tenantId: string): Promise<TenantMessagingConfig> {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) {
      throw new Error(`No tenant config for ${tenantId}`);
    }
    return config;
  }

  async updateInboundMessageAnalysis(input: UpdateInboundMessageAnalysisInput): Promise<void> {
    this.messageAnalyses.push(input);
  }

  async isCustomerOptedOut(input: {
    tenantId: string;
    channel: 'whatsapp';
    customerIdentifier: string;
  }): Promise<boolean> {
    return this.optedOut.has(`${input.tenantId}:${input.customerIdentifier}`);
  }

  async insertOutboundMessage(
    input: InsertOutboundMessageInput,
  ): Promise<InsertOutboundMessageResult> {
    this.outboundMessages.push(input);
    return { created: true, messageId: `out_${this.outboundMessages.length}` };
  }

  async enqueueOutboundMessage(
    input: EnqueueOutboundMessageInput,
  ): Promise<EnqueueOutboundMessageResult> {
    this.outboxJobs.push(input);
    return { jobId: `job_${this.outboxJobs.length}`, created: true };
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

class FakeUsageRepository implements UsageLimitsRepository {
  constructor(
    private readonly state: {
      plan: UsagePlanKey;
      usage?: Partial<
        Pick<
          TenantUsageRow,
          'conversationsCount' | 'messagesCount' | 'voiceMessagesCount' | 'aiCostCents'
        >
      >;
    },
  ) {}

  async getTenantPlan(): Promise<UsagePlanKey | null> {
    return this.state.plan;
  }

  async getCurrentUsage(input: {
    tenantId: string;
    metricMonth: string;
  }): Promise<TenantUsageRow | null> {
    if (!this.state.usage) {
      return null;
    }
    return {
      plan: this.state.plan,
      metricMonth: input.metricMonth,
      conversationsCount: this.state.usage.conversationsCount ?? 0,
      messagesCount: this.state.usage.messagesCount ?? 0,
      voiceMessagesCount: this.state.usage.voiceMessagesCount ?? 0,
      aiCostCents: this.state.usage.aiCostCents ?? 0,
    };
  }

  async hasConversationInMonth(): Promise<boolean> {
    return false;
  }

  async incrementUsage(): Promise<void> {
    /* noop in this guard test */
  }
}
