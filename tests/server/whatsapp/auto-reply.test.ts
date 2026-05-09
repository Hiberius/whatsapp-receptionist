import { describe, expect, it } from 'vitest';

import {
  WhatsAppAutoReplyService,
  type WhatsAppAutoReplyRepository,
} from '@/server/whatsapp/auto-reply';
import { ReplyOrchestrator } from '@/server/ai/reply-orchestrator';
import type {
  IntentClassification,
  IntentClassificationInput,
  IntentClassifier,
} from '@/server/ai/intent-router';
import type {
  DomainReplyGenerator,
  DomainReplyInput,
  DomainReplyResult,
} from '@/server/ai/domain-reply';
import type {
  EnqueueOutboundMessageInput,
  EnqueueOutboundMessageResult,
  InsertOutboundMessageInput,
  InsertOutboundMessageResult,
  TenantMessagingConfig,
  UpdateInboundMessageAnalysisInput,
} from '@/server/whatsapp/repository';

const occurredAt = new Date('2026-04-25T09:00:00.000Z');

describe('WhatsAppAutoReplyService', () => {
  it('queues a gated AI reply for clear voice transcripts', async () => {
    const repository = new FakeAutoReplyRepository();
    repository.tenantConfigs.set('tenant_1', {
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: true,
      autoReplyEnabled: true,
      defaultLocale: 'it-IT',
    });
    const service = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
    });

    const result = await service.handleInboundMessage({
      ...baseInput(),
      text: 'Vorrei prenotare una visita domani mattina',
      transcriptLanguageProbability: 0.98,
    });

    expect(result).toMatchObject({
      queued: true,
      skippedReason: null,
    });
    expect(repository.messageAnalyses[0]).toMatchObject({
      intent: 'booking_request',
    });
    expect(repository.outboundMessages[0]).toMatchObject({
      externalId: 'auto-reply:message:wamid.audio',
      metadata: {
        inboundSource: 'voice_transcript',
      },
    });
    expect(repository.outboxJobs[0]?.payload).toMatchObject({
      type: 'text',
      text: {
        body: expect.stringContaining('sono Ambrogio'),
      },
      metadata: {
        inboundSource: 'voice_transcript',
      },
    });
  });

  it('does not auto-reply when a voice transcript is uncertain', async () => {
    const repository = new FakeAutoReplyRepository();
    repository.tenantConfigs.set('tenant_1', {
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: true,
      autoReplyEnabled: true,
      defaultLocale: 'it-IT',
    });
    const service = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
      voiceTranscriptMinConfidence: 0.75,
    });

    const result = await service.handleInboundMessage({
      ...baseInput(),
      text: 'prenotare domani',
      transcriptLanguageProbability: 0.32,
    });

    expect(result).toMatchObject({
      queued: false,
      skippedReason: 'guardrail',
      classification: {
        intent: 'human_handoff',
      },
    });
    expect(repository.messageAnalyses[0]?.metadata).toMatchObject({
      autoReply: {
        guardrail: {
          code: 'low_voice_transcript_confidence',
        },
      },
    });
    expect(repository.outboundMessages).toHaveLength(0);
    expect(repository.outboxJobs).toHaveLength(0);
  });

  it('stores AI token and cost telemetry from LLM reply plans', async () => {
    const repository = new FakeAutoReplyRepository();
    repository.tenantConfigs.set('tenant_1', {
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: false,
      autoReplyEnabled: true,
      defaultLocale: 'it-IT',
    });
    const service = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
      replyOrchestrator: new ReplyOrchestrator(
        new FakeLlmClassifier(),
        new FakeDomainReplyGenerator(),
      ),
    });

    const result = await service.handleInboundMessage({
      ...baseInput(),
      text: 'Quanto costa una visita?',
      source: 'text',
      transcriptLanguageProbability: null,
    });

    expect(result).toMatchObject({
      queued: true,
      classification: {
        intent: 'pricing_question',
      },
    });
    expect(repository.messageAnalyses[0]).toMatchObject({
      tokensUsed: 150,
      costCents: 7,
    });
    expect(repository.usageIncrements).toEqual([
      {
        tenantId: 'tenant_1',
        metricMonth: '2026-04-01',
        messagesDelta: 0,
        aiCostCentsDelta: 7,
      },
      {
        tenantId: 'tenant_1',
        metricMonth: '2026-04-01',
        messagesDelta: 1,
        aiCostCentsDelta: 0,
      },
    ]);
  });
});

function baseInput() {
  return {
    tenantId: 'tenant_1',
    conversationId: 'conversation_1',
    inboundMessageId: 'message_1',
    inboundExternalId: 'message:wamid.audio',
    customerIdentifier: '393331112233',
    occurredAt,
    source: 'voice_transcript' as const,
    provider: 'whatsapp_360dialog' as const,
    whatsappMessageId: 'wamid.audio',
    phoneNumberId: 'phone_123',
    displayPhoneNumber: '390212345678',
    transcriptLanguage: 'it',
    existingMetadata: {
      whatsappVoice: {
        mediaId: 'media_audio_1',
      },
    },
  };
}

class FakeAutoReplyRepository implements WhatsAppAutoReplyRepository {
  readonly tenantConfigs = new Map<string, TenantMessagingConfig>();
  readonly messageAnalyses: UpdateInboundMessageAnalysisInput[] = [];
  readonly outboundMessages: InsertOutboundMessageInput[] = [];
  readonly outboxJobs: EnqueueOutboundMessageInput[] = [];
  readonly usageIncrements: Array<{
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
    aiCostCentsDelta?: number;
  }> = [];

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

  async updateInboundMessageAnalysis(input: UpdateInboundMessageAnalysisInput): Promise<void> {
    this.messageAnalyses.push(input);
  }

  async isCustomerOptedOut(): Promise<boolean> {
    return false;
  }

  async insertOutboundMessage(
    input: InsertOutboundMessageInput,
  ): Promise<InsertOutboundMessageResult> {
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
    aiCostCentsDelta?: number;
  }): Promise<void> {
    this.usageIncrements.push(input);
  }
}

class FakeLlmClassifier implements IntentClassifier {
  async classify(_input: IntentClassificationInput): Promise<IntentClassification> {
    return {
      intent: 'pricing_question',
      confidence: 0.91,
      matchedSignals: ['prezzo'],
      aiUsage: {
        provider: 'anthropic',
        feature: 'intent_classifier',
        model: ['clau', 'de-3-5-haiku-20241022'].join(''),
        inputTokens: 80,
        outputTokens: 20,
        totalTokens: 100,
        costCents: 2,
        estimated: true,
        pricingSource: 'model_family_estimate',
        stopReason: 'end_turn',
      },
    };
  }
}

class FakeDomainReplyGenerator implements DomainReplyGenerator {
  async generate(_input: DomainReplyInput): Promise<DomainReplyResult> {
    return {
      shouldReply: true,
      replyText: 'La visita va confermata dallo studio.',
      metadata: {
        aiEngine: {
          provider: 'anthropic',
          feature: 'domain_reply',
          model: ['clau', 'de-sonnet-4-20250514'].join(''),
          inputTokens: 40,
          outputTokens: 10,
          totalTokens: 50,
          costCents: 5,
          estimated: true,
          pricingSource: 'model_family_estimate',
          stopReason: 'end_turn',
        },
      },
    };
  }
}
