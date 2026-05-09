import { env } from '@/lib/env';
import type { BookingBridgeService } from '@/server/ai/booking-bridge';
import {
  createReplyOrchestrator,
  type ReplyOrchestrator,
  type ReplyPlan,
} from '@/server/ai/reply-orchestrator';
import type { IntentClassification } from '@/server/ai/intent-router';
import { sumAiUsageCostCents, sumAiUsageTokens, type AiUsageMetadata } from '@/server/ai/costs';
import type { UsageLimitsService } from '@/server/usage/limits';
import type { WhatsAppProvider } from '@/server/whatsapp/webhook-events';
import type {
  EnqueueOutboundMessageInput,
  EnqueueOutboundMessageResult,
  InsertOutboundMessageInput,
  InsertOutboundMessageResult,
  TenantMessagingConfig,
  UpdateInboundMessageAnalysisInput,
} from '@/server/whatsapp/repository';

export type WhatsAppAutoReplySource = 'text' | 'voice_transcript';

export type WhatsAppAutoReplyInput = {
  tenantId: string;
  conversationId: string;
  inboundMessageId: string;
  inboundExternalId: string;
  customerIdentifier: string;
  text: string;
  occurredAt: Date;
  source: WhatsAppAutoReplySource;
  provider: WhatsAppProvider;
  whatsappMessageId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  existingMetadata?: Record<string, unknown>;
  transcriptLanguage?: string | null;
  transcriptLanguageProbability?: number | null;
};

export type WhatsAppAutoReplyResult = {
  analyzed: boolean;
  queued: boolean;
  skippedReason:
    | 'global_gate_disabled'
    | 'tenant_gate_disabled'
    | 'no_reply_plan'
    | 'opted_out'
    | 'duplicate_outbound'
    | 'guardrail'
    | 'usage_limit_reached'
    | null;
  classification: IntentClassification;
};

export interface WhatsAppAutoReplyRepository {
  getTenantMessagingConfig(tenantId: string): Promise<TenantMessagingConfig>;
  updateInboundMessageAnalysis(input: UpdateInboundMessageAnalysisInput): Promise<void>;
  isCustomerOptedOut(input: {
    tenantId: string;
    channel: 'whatsapp';
    customerIdentifier: string;
  }): Promise<boolean>;
  insertOutboundMessage(input: InsertOutboundMessageInput): Promise<InsertOutboundMessageResult>;
  enqueueOutboundMessage(input: EnqueueOutboundMessageInput): Promise<EnqueueOutboundMessageResult>;
  incrementUsage(input: {
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
    aiCostCentsDelta?: number;
  }): Promise<void>;
}

export interface WhatsAppAutoReplyHandler {
  handleInboundMessage(input: WhatsAppAutoReplyInput): Promise<WhatsAppAutoReplyResult>;
}

type AutoReplyGuardrail = {
  code: 'empty_voice_transcript' | 'low_voice_transcript_confidence' | 'sensitive_handoff';
  intent: IntentClassification['intent'];
  confidence: number;
  reason: string;
};

export class WhatsAppAutoReplyService implements WhatsAppAutoReplyHandler {
  private readonly autoReplyEnabled: boolean;
  private readonly replyOrchestrator: ReplyOrchestrator;
  private readonly bookingBridge: BookingBridgeService | null;
  private readonly voiceTranscriptMinConfidence: number;
  private readonly usageLimits: UsageLimitsService | null;

  constructor(
    private readonly repository: WhatsAppAutoReplyRepository,
    options: {
      autoReplyEnabled?: boolean;
      replyOrchestrator?: ReplyOrchestrator;
      bookingBridge?: BookingBridgeService;
      voiceTranscriptMinConfidence?: number;
      usageLimits?: UsageLimitsService;
    } = {},
  ) {
    this.autoReplyEnabled = options.autoReplyEnabled ?? env.AMBROGIO_AI_AUTOREPLY_ENABLED;
    this.replyOrchestrator = options.replyOrchestrator ?? createReplyOrchestrator();
    this.bookingBridge = options.bookingBridge ?? null;
    this.voiceTranscriptMinConfidence =
      options.voiceTranscriptMinConfidence ?? env.AMBROGIO_VOICE_STT_MIN_CONFIDENCE;
    this.usageLimits = options.usageLimits ?? null;
  }

  async handleInboundMessage(input: WhatsAppAutoReplyInput): Promise<WhatsAppAutoReplyResult> {
    const config = await this.repository.getTenantMessagingConfig(input.tenantId);
    const guardrail = evaluateAutoReplyGuardrail(input, {
      voiceTranscriptMinConfidence: this.voiceTranscriptMinConfidence,
    });
    const baseReplyPlan = guardrail
      ? {
          shouldReply: false,
          replyText: null,
          classification: guardrailToClassification(guardrail),
        }
      : await this.replyOrchestrator.createReply({
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          text: input.text,
          assistantName: config.assistantName,
          aiDisclosureEnabled: config.aiDisclosureEnabled,
          locale: config.defaultLocale,
        });
    const optedOut =
      !guardrail && this.autoReplyEnabled && config.autoReplyEnabled
        ? await this.repository.isCustomerOptedOut({
            tenantId: input.tenantId,
            channel: 'whatsapp',
            customerIdentifier: input.customerIdentifier,
          })
        : false;
    const canApplyInteractiveReply =
      !guardrail && this.autoReplyEnabled && config.autoReplyEnabled && !optedOut;
    const replyPlan = canApplyInteractiveReply
      ? await this.applyBookingBridge(input, config, baseReplyPlan)
      : baseReplyPlan;
    const usageSummary = collectReplyPlanAiUsage(replyPlan);

    await this.repository.updateInboundMessageAnalysis({
      tenantId: input.tenantId,
      messageId: input.inboundMessageId,
      intent: replyPlan.classification.intent,
      confidence: replyPlan.classification.confidence,
      tokensUsed: usageSummary.totalTokens,
      costCents: usageSummary.costCents,
      metadata: buildAnalysisMetadata(
        input,
        replyPlan.classification,
        guardrail,
        replyPlan.metadata,
      ),
    });

    if (usageSummary.costCents > 0) {
      await this.repository.incrementUsage({
        tenantId: input.tenantId,
        metricMonth: toMetricMonth(input.occurredAt),
        messagesDelta: 0,
        aiCostCentsDelta: usageSummary.costCents,
      });
    }

    if (guardrail) {
      return {
        analyzed: true,
        queued: false,
        skippedReason: 'guardrail',
        classification: replyPlan.classification,
      };
    }

    if (!this.autoReplyEnabled) {
      return {
        analyzed: true,
        queued: false,
        skippedReason: 'global_gate_disabled',
        classification: replyPlan.classification,
      };
    }

    if (!config.autoReplyEnabled) {
      return {
        analyzed: true,
        queued: false,
        skippedReason: 'tenant_gate_disabled',
        classification: replyPlan.classification,
      };
    }

    if (!replyPlan.shouldReply || !replyPlan.replyText) {
      return {
        analyzed: true,
        queued: false,
        skippedReason: 'no_reply_plan',
        classification: replyPlan.classification,
      };
    }

    if (optedOut) {
      return {
        analyzed: true,
        queued: false,
        skippedReason: 'opted_out',
        classification: replyPlan.classification,
      };
    }

    if (this.usageLimits) {
      const decision = await this.usageLimits.checkAutoReplyAllowed({
        tenantId: input.tenantId,
        requireVoiceQuota: input.source === 'voice_transcript',
        now: input.occurredAt,
      });

      if (!decision.allowed) {
        return {
          analyzed: true,
          queued: false,
          skippedReason: 'usage_limit_reached',
          classification: replyPlan.classification,
        };
      }
    }

    const outbound = await this.repository.insertOutboundMessage({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      externalId: `auto-reply:${input.inboundExternalId}`,
      content: replyPlan.replyText,
      createdAt: new Date(),
      metadata: {
        source: 'ai_auto_reply',
        inboundSource: input.source,
        intent: replyPlan.classification,
        inboundMessageId: input.inboundMessageId,
        inboundExternalId: input.inboundExternalId,
        ...(replyPlan.metadata ?? {}),
      },
    });

    if (!outbound.created || !outbound.messageId) {
      return {
        analyzed: true,
        queued: false,
        skippedReason: 'duplicate_outbound',
        classification: replyPlan.classification,
      };
    }

    await this.repository.incrementUsage({
      tenantId: input.tenantId,
      metricMonth: toMetricMonth(input.occurredAt),
      messagesDelta: 1,
      aiCostCentsDelta: 0,
    });

    await this.repository.enqueueOutboundMessage({
      tenantId: input.tenantId,
      messageId: outbound.messageId,
      recipientIdentifier: input.customerIdentifier,
      payload: {
        type: 'text',
        text: {
          body: replyPlan.replyText,
          previewUrl: false,
        },
        metadata: {
          source: 'ai_auto_reply',
          inboundSource: input.source,
          intent: replyPlan.classification,
          inboundMessageId: input.inboundMessageId,
          inboundExternalId: input.inboundExternalId,
          ...(replyPlan.metadata ?? {}),
        },
      },
    });

    return {
      analyzed: true,
      queued: true,
      skippedReason: null,
      classification: replyPlan.classification,
    };
  }

  private async applyBookingBridge(
    input: WhatsAppAutoReplyInput,
    config: TenantMessagingConfig,
    replyPlan: ReplyPlan,
  ): Promise<ReplyPlan> {
    if (!this.bookingBridge) {
      return replyPlan;
    }

    const bookingReply = await this.bookingBridge.createBookingReply({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      customerIdentifier: input.customerIdentifier,
      customerName: null,
      text: input.text,
      intent: replyPlan.classification.intent,
      occurredAt: input.occurredAt,
    });

    if (!bookingReply.handled || !bookingReply.replyText) {
      return replyPlan;
    }

    return {
      ...replyPlan,
      shouldReply: true,
      replyText: withDisclosure(bookingReply.replyText, {
        assistantName: config.assistantName,
        aiDisclosureEnabled: config.aiDisclosureEnabled,
      }),
      metadata: {
        ...(replyPlan.metadata ?? {}),
        ...(bookingReply.metadata ?? {}),
      },
    };
  }
}

function evaluateAutoReplyGuardrail(
  input: WhatsAppAutoReplyInput,
  options: {
    voiceTranscriptMinConfidence: number;
  },
): AutoReplyGuardrail | null {
  const text = input.text.trim();

  if (input.source === 'voice_transcript' && text.length === 0) {
    return {
      code: 'empty_voice_transcript',
      intent: 'human_handoff',
      confidence: 0.99,
      reason: 'ElevenLabs returned an empty transcript for a WhatsApp voice note.',
    };
  }

  if (
    input.source === 'voice_transcript' &&
    typeof input.transcriptLanguageProbability === 'number' &&
    input.transcriptLanguageProbability < options.voiceTranscriptMinConfidence
  ) {
    return {
      code: 'low_voice_transcript_confidence',
      intent: 'human_handoff',
      confidence: 0.98,
      reason: 'Voice transcript confidence is below the tenant-safe threshold.',
    };
  }

  if (containsSensitiveHandoffSignal(text)) {
    return {
      code: 'sensitive_handoff',
      intent: 'human_handoff',
      confidence: 0.97,
      reason: 'Message contains emergency, medical severity, legal, or safety-sensitive signals.',
    };
  }

  return null;
}

function guardrailToClassification(guardrail: AutoReplyGuardrail): IntentClassification {
  return {
    intent: guardrail.intent,
    confidence: guardrail.confidence,
    matchedSignals: [guardrail.code],
  };
}

function buildAnalysisMetadata(
  input: WhatsAppAutoReplyInput,
  classification: IntentClassification,
  guardrail: AutoReplyGuardrail | null,
  replyMetadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    ...(input.existingMetadata ?? {}),
    provider: input.provider,
    whatsappMessageId: input.whatsappMessageId,
    phoneNumberId: input.phoneNumberId,
    displayPhoneNumber: input.displayPhoneNumber,
    intent: classification,
    ...(replyMetadata ?? {}),
    autoReply: {
      source: input.source,
      guardrail: guardrail
        ? {
            code: guardrail.code,
            reason: guardrail.reason,
          }
        : null,
      transcript:
        input.source === 'voice_transcript'
          ? {
              language: input.transcriptLanguage ?? null,
              languageProbability: input.transcriptLanguageProbability ?? null,
            }
          : null,
    },
  };
}

function collectReplyPlanAiUsage(replyPlan: ReplyPlan): {
  totalTokens: number | null;
  costCents: number;
} {
  const usages = [
    replyPlan.classification.aiUsage,
    aiUsageFromMetadata(replyPlan.metadata?.aiEngine),
  ];

  return {
    totalTokens: sumAiUsageTokens(usages),
    costCents: sumAiUsageCostCents(usages),
  };
}

function aiUsageFromMetadata(value: unknown): AiUsageMetadata | null {
  if (!isRecord(value) || value.provider !== 'anthropic') {
    return null;
  }

  const costCents = numberFromRecord(value, 'costCents');
  const inputTokens = nullableNumberFromRecord(value, 'inputTokens');
  const outputTokens = nullableNumberFromRecord(value, 'outputTokens');
  const totalTokens =
    nullableNumberFromRecord(value, 'totalTokens') ??
    (inputTokens === null && outputTokens === null
      ? null
      : (inputTokens ?? 0) + (outputTokens ?? 0));

  return {
    provider: 'anthropic',
    feature: value.feature === 'domain_reply' ? 'domain_reply' : 'intent_classifier',
    model: typeof value.model === 'string' && value.model.trim() ? value.model : 'unknown',
    inputTokens,
    outputTokens,
    totalTokens,
    costCents: costCents ?? 0,
    estimated: value.estimated !== false,
    pricingSource:
      value.pricingSource === 'model_family_estimate' ? 'model_family_estimate' : 'unknown_model',
    stopReason: typeof value.stopReason === 'string' ? value.stopReason : null,
  };
}

function withDisclosure(
  body: string,
  input: {
    assistantName: string;
    aiDisclosureEnabled: boolean;
  },
): string {
  if (!input.aiDisclosureEnabled) {
    return body;
  }

  return `Ciao, sono ${input.assistantName}, l'assistente AI dello studio. ${body}`;
}

function containsSensitiveHandoffSignal(text: string): boolean {
  const normalized = normalizeForMatching(text);

  if (!normalized) {
    return false;
  }

  return sensitiveHandoffSignals.some((signal) => signal.test(normalized));
}

const sensitiveHandoffSignals = [
  /\b(emergenza|urgente|urgenza|pronto soccorso|ambulanza|112|118)\b/,
  /\b(dolore forte|sanguina|sangue|non respiro|svenuto|svenuta)\b/,
  /\b(suicidio|suicidarmi|farmi del male|violenza|minaccia)\b/,
  /\b(avvocato|denuncia|querela|causa legale|tribunale)\b/,
];

function normalizeForMatching(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toMetricMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `${year}-${month}-01`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberFromRecord(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nullableNumberFromRecord(record: Record<string, unknown>, key: string): number | null {
  const value = numberFromRecord(record, key);

  return value === null ? null : Math.max(0, Math.floor(value));
}
