// Fatto da Claude Code il 27 aprile 2026.
//
// Usage limits MVP per piano. Tracking allineato al pricing pubblico:
// - conversazioni/mese (limite primario);
// - vocali/mese (sub-limite, copre il costo STT/TTS).
//
// Comportamento:
// - soft warning a 80% di una qualsiasi metrica → flag visibile al dashboard,
//   nessun blocco;
// - hard block AUTO-REPLY a 100% → Ambrogio non risponde piu' fino al rollover
//   del mese, ma webhook inbound, opt-out, voice ingest, booking conversazionale
//   e fallback umano restano operativi.
//
// Per Agency: il limite e' applicato per-tenant (un tenant Agency = 1 cliente
// finale dell'agenzia). L'aggregazione multi-cliente e' gestita lato dashboard.

import type { AuthSession } from '@/lib/auth/session';
import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type UsagePlanKey = 'trial' | 'starter' | 'professional' | 'agency';

export type UsagePlanLimits = {
  conversationsPerMonth: number;
  voiceMessagesPerMonth: number;
};

export type UsageSnapshot = {
  plan: UsagePlanKey;
  metricMonth: string;
  conversations: UsageMetricSnapshot;
  voiceMessages: UsageMetricSnapshot;
  messages: { used: number };
  aiCostCents: { used: number };
  autoReplyAllowed: boolean;
  blockReason: 'conversations_exceeded' | 'voice_exceeded' | null;
  softWarning: boolean;
};

export type UsageMetricSnapshot = {
  used: number;
  limit: number;
  percent: number;
  exceeded: boolean;
  warning: boolean;
};

export type AutoReplyDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'conversations_exceeded' | 'voice_exceeded';
      snapshot: UsageSnapshot;
    };

export type TenantUsageRow = {
  plan: UsagePlanKey;
  metricMonth: string;
  conversationsCount: number;
  messagesCount: number;
  voiceMessagesCount: number;
  aiCostCents: number;
};

export interface UsageLimitsRepository {
  getTenantPlan(tenantId: string): Promise<UsagePlanKey | null>;
  getCurrentUsage(input: { tenantId: string; metricMonth: string }): Promise<TenantUsageRow | null>;
  hasConversationInMonth(input: {
    tenantId: string;
    customerIdentifier: string;
    channel: 'whatsapp';
    metricMonth: string;
  }): Promise<boolean>;
  incrementUsage(input: {
    tenantId: string;
    metricMonth: string;
    conversationsDelta?: number;
    messagesDelta?: number;
    voiceMessagesDelta?: number;
    aiCostCentsDelta?: number;
  }): Promise<void>;
}

export type UsageLimitsConfig = {
  warningThresholdPercent: number;
  limitsByPlan: Record<UsagePlanKey, UsagePlanLimits>;
};

export const DEFAULT_USAGE_LIMITS: Record<UsagePlanKey, UsagePlanLimits> = {
  trial: {
    conversationsPerMonth: 100,
    voiceMessagesPerMonth: 50,
  },
  starter: {
    conversationsPerMonth: 500,
    voiceMessagesPerMonth: 200,
  },
  professional: {
    conversationsPerMonth: 2_000,
    voiceMessagesPerMonth: 500,
  },
  agency: {
    conversationsPerMonth: 2_000,
    voiceMessagesPerMonth: 500,
  },
};

export const DEFAULT_USAGE_LIMITS_CONFIG: UsageLimitsConfig = {
  warningThresholdPercent: 80,
  limitsByPlan: DEFAULT_USAGE_LIMITS,
};

export class UsageLimitsService {
  constructor(
    private readonly repository: UsageLimitsRepository,
    private readonly config: UsageLimitsConfig = DEFAULT_USAGE_LIMITS_CONFIG,
  ) {}

  async getSnapshot(input: { tenantId: string; now?: Date }): Promise<UsageSnapshot> {
    const metricMonth = toMetricMonth(input.now ?? new Date());
    const plan = (await this.repository.getTenantPlan(input.tenantId)) ?? 'trial';
    const usage = await this.repository.getCurrentUsage({
      tenantId: input.tenantId,
      metricMonth,
    });

    return this.buildSnapshot({
      plan,
      metricMonth,
      conversationsUsed: usage?.conversationsCount ?? 0,
      messagesUsed: usage?.messagesCount ?? 0,
      voiceMessagesUsed: usage?.voiceMessagesCount ?? 0,
      aiCostCentsUsed: usage?.aiCostCents ?? 0,
    });
  }

  async getDashboardSnapshot(input: { session: AuthSession; now?: Date }): Promise<UsageSnapshot> {
    return this.getSnapshot({
      tenantId: input.session.tenantId,
      ...(input.now !== undefined ? { now: input.now } : {}),
    });
  }

  async checkAutoReplyAllowed(input: {
    tenantId: string;
    requireVoiceQuota?: boolean;
    now?: Date;
  }): Promise<AutoReplyDecision> {
    const snapshot = await this.getSnapshot({
      tenantId: input.tenantId,
      ...(input.now !== undefined ? { now: input.now } : {}),
    });

    if (snapshot.conversations.exceeded) {
      return {
        allowed: false,
        reason: 'conversations_exceeded',
        snapshot,
      };
    }

    if (input.requireVoiceQuota && snapshot.voiceMessages.exceeded) {
      return {
        allowed: false,
        reason: 'voice_exceeded',
        snapshot,
      };
    }

    return { allowed: true };
  }

  async registerInboundConversation(input: {
    tenantId: string;
    customerIdentifier: string;
    channel: 'whatsapp';
    now?: Date;
  }): Promise<{ counted: boolean }> {
    const metricMonth = toMetricMonth(input.now ?? new Date());
    const alreadyCounted = await this.repository.hasConversationInMonth({
      tenantId: input.tenantId,
      customerIdentifier: input.customerIdentifier,
      channel: input.channel,
      metricMonth,
    });

    if (alreadyCounted) {
      return { counted: false };
    }

    await this.repository.incrementUsage({
      tenantId: input.tenantId,
      metricMonth,
      conversationsDelta: 1,
    });

    return { counted: true };
  }

  async registerVoiceMessage(input: { tenantId: string; now?: Date }): Promise<void> {
    await this.repository.incrementUsage({
      tenantId: input.tenantId,
      metricMonth: toMetricMonth(input.now ?? new Date()),
      voiceMessagesDelta: 1,
    });
  }

  private buildSnapshot(input: {
    plan: UsagePlanKey;
    metricMonth: string;
    conversationsUsed: number;
    messagesUsed: number;
    voiceMessagesUsed: number;
    aiCostCentsUsed: number;
  }): UsageSnapshot {
    const limits = this.config.limitsByPlan[input.plan];
    const conversations = this.metricSnapshot(
      input.conversationsUsed,
      limits.conversationsPerMonth,
    );
    const voiceMessages = this.metricSnapshot(
      input.voiceMessagesUsed,
      limits.voiceMessagesPerMonth,
    );

    const blockReason = conversations.exceeded
      ? 'conversations_exceeded'
      : voiceMessages.exceeded
        ? 'voice_exceeded'
        : null;
    const softWarning = !blockReason && (conversations.warning || voiceMessages.warning);

    return {
      plan: input.plan,
      metricMonth: input.metricMonth,
      conversations,
      voiceMessages,
      messages: { used: input.messagesUsed },
      aiCostCents: { used: input.aiCostCentsUsed },
      autoReplyAllowed: blockReason === null,
      blockReason,
      softWarning,
    };
  }

  private metricSnapshot(used: number, limit: number): UsageMetricSnapshot {
    const safeUsed = Math.max(0, used);
    const safeLimit = Math.max(0, limit);
    const percent = safeLimit === 0 ? 0 : Math.min(100, Math.round((safeUsed / safeLimit) * 100));
    const exceeded = safeLimit > 0 && safeUsed >= safeLimit;
    const warning = !exceeded && percent >= this.config.warningThresholdPercent;

    return {
      used: safeUsed,
      limit: safeLimit,
      percent,
      exceeded,
      warning,
    };
  }
}

export class SupabaseUsageLimitsRepository implements UsageLimitsRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getTenantPlan(tenantId: string): Promise<UsagePlanKey | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('plan')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read tenant plan for usage', error);
    }

    if (!data) {
      return null;
    }

    return normalizePlan(data.plan as string);
  }

  async getCurrentUsage(input: {
    tenantId: string;
    metricMonth: string;
  }): Promise<TenantUsageRow | null> {
    const { data, error } = await this.supabase
      .from('usage_metrics')
      .select(
        'metric_month, messages_count, conversations_count, voice_messages_count, ai_cost_cents',
      )
      .eq('tenant_id', input.tenantId)
      .eq('metric_month', input.metricMonth)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read current usage metrics', error);
    }

    if (!data) {
      return null;
    }

    return {
      plan: 'trial',
      metricMonth: input.metricMonth,
      conversationsCount: Number(data.conversations_count ?? 0),
      messagesCount: Number(data.messages_count ?? 0),
      voiceMessagesCount: Number(data.voice_messages_count ?? 0),
      aiCostCents: Number(data.ai_cost_cents ?? 0),
    };
  }

  async hasConversationInMonth(input: {
    tenantId: string;
    customerIdentifier: string;
    channel: 'whatsapp';
    metricMonth: string;
  }): Promise<boolean> {
    const monthStart = new Date(`${input.metricMonth}T00:00:00.000Z`);
    const nextMonth = new Date(monthStart);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

    const { data, error } = await this.supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('channel', input.channel)
      .eq('customer_identifier', input.customerIdentifier)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', nextMonth.toISOString())
      .limit(1);

    if (error) {
      throw toRepositoryError('Failed to count conversations in month', error);
    }

    return Array.isArray(data) && data.length > 0;
  }

  async incrementUsage(input: {
    tenantId: string;
    metricMonth: string;
    conversationsDelta?: number;
    messagesDelta?: number;
    voiceMessagesDelta?: number;
    aiCostCentsDelta?: number;
  }): Promise<void> {
    const { error } = await this.supabase.rpc('increment_usage_metrics', {
      p_tenant_id: input.tenantId,
      p_metric_month: input.metricMonth,
      p_messages_delta: input.messagesDelta ?? 0,
      p_conversations_delta: input.conversationsDelta ?? 0,
      p_ai_cost_cents_delta: input.aiCostCentsDelta ?? 0,
      p_voice_messages_delta: input.voiceMessagesDelta ?? 0,
    });

    if (error) {
      throw toRepositoryError('Failed to increment usage metrics', error);
    }
  }
}

export function createUsageLimitsService(
  config: UsageLimitsConfig = DEFAULT_USAGE_LIMITS_CONFIG,
): UsageLimitsService {
  return new UsageLimitsService(new SupabaseUsageLimitsRepository(), config);
}

export function toMetricMonth(occurredAt: Date): string {
  const year = occurredAt.getUTCFullYear();
  const month = String(occurredAt.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function normalizePlan(value: string): UsagePlanKey {
  if (value === 'trial' || value === 'starter' || value === 'professional' || value === 'agency') {
    return value;
  }

  return 'trial';
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
