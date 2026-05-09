// Fatto da Claude Code il 27 aprile 2026.
//
// Test per UsageLimitsService: snapshot, soft warning a 80%, hard block a
// 100%, conversation counter mensile e voice limit.

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_USAGE_LIMITS_CONFIG,
  UsageLimitsService,
  type TenantUsageRow,
  type UsageLimitsConfig,
  type UsageLimitsRepository,
  type UsagePlanKey,
} from '@/server/usage/limits';

const TENANT_ID = '00000000-0000-4000-8000-000000000001';

describe('UsageLimitsService.getSnapshot', () => {
  it('returns trial limits and 0 usage when no usage row exists', async () => {
    const service = makeService();

    const snapshot = await service.getSnapshot({
      tenantId: TENANT_ID,
      now: new Date('2026-04-27T12:00:00.000Z'),
    });

    expect(snapshot).toMatchObject({
      plan: 'trial',
      metricMonth: '2026-04-01',
      autoReplyAllowed: true,
      blockReason: null,
      softWarning: false,
      conversations: { used: 0, limit: 100, percent: 0, exceeded: false },
      voiceMessages: { used: 0, limit: 50, percent: 0, exceeded: false },
    });
  });

  it('flags soft warning when conversation usage hits 80%', async () => {
    const service = makeService({
      plan: 'starter',
      usage: { conversationsCount: 400, messagesCount: 0, voiceMessagesCount: 50 },
    });

    const snapshot = await service.getSnapshot({
      tenantId: TENANT_ID,
      now: new Date('2026-04-27T12:00:00.000Z'),
    });

    expect(snapshot.conversations).toMatchObject({
      used: 400,
      limit: 500,
      percent: 80,
      warning: true,
      exceeded: false,
    });
    expect(snapshot.softWarning).toBe(true);
    expect(snapshot.autoReplyAllowed).toBe(true);
    expect(snapshot.blockReason).toBeNull();
  });

  it('hard-blocks when conversations reach the plan limit', async () => {
    const service = makeService({
      plan: 'starter',
      usage: { conversationsCount: 500, messagesCount: 0, voiceMessagesCount: 0 },
    });

    const snapshot = await service.getSnapshot({
      tenantId: TENANT_ID,
      now: new Date('2026-04-27T12:00:00.000Z'),
    });

    expect(snapshot.autoReplyAllowed).toBe(false);
    expect(snapshot.blockReason).toBe('conversations_exceeded');
    expect(snapshot.conversations.exceeded).toBe(true);
  });

  it('hard-blocks when voice messages reach the plan limit', async () => {
    const service = makeService({
      plan: 'starter',
      usage: { conversationsCount: 50, messagesCount: 0, voiceMessagesCount: 200 },
    });

    const snapshot = await service.getSnapshot({
      tenantId: TENANT_ID,
      now: new Date('2026-04-27T12:00:00.000Z'),
    });

    expect(snapshot.blockReason).toBe('voice_exceeded');
    expect(snapshot.voiceMessages.exceeded).toBe(true);
  });
});

describe('UsageLimitsService.checkAutoReplyAllowed', () => {
  it('allows reply when under limits', async () => {
    const service = makeService({
      plan: 'professional',
      usage: { conversationsCount: 100, messagesCount: 0, voiceMessagesCount: 50 },
    });

    const decision = await service.checkAutoReplyAllowed({
      tenantId: TENANT_ID,
      requireVoiceQuota: true,
      now: new Date('2026-04-27T12:00:00.000Z'),
    });

    expect(decision).toEqual({ allowed: true });
  });

  it('blocks reply when conversation limit is exceeded', async () => {
    const service = makeService({
      plan: 'starter',
      usage: { conversationsCount: 500, messagesCount: 0, voiceMessagesCount: 0 },
    });

    const decision = await service.checkAutoReplyAllowed({
      tenantId: TENANT_ID,
      now: new Date('2026-04-27T12:00:00.000Z'),
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: 'conversations_exceeded',
    });
  });

  it('skips voice block when requireVoiceQuota=false', async () => {
    const service = makeService({
      plan: 'starter',
      usage: { conversationsCount: 0, messagesCount: 0, voiceMessagesCount: 200 },
    });

    const decision = await service.checkAutoReplyAllowed({
      tenantId: TENANT_ID,
      now: new Date('2026-04-27T12:00:00.000Z'),
    });

    expect(decision).toEqual({ allowed: true });
  });

  it('blocks voice when requireVoiceQuota=true and limit hit', async () => {
    const service = makeService({
      plan: 'starter',
      usage: { conversationsCount: 0, messagesCount: 0, voiceMessagesCount: 200 },
    });

    const decision = await service.checkAutoReplyAllowed({
      tenantId: TENANT_ID,
      requireVoiceQuota: true,
      now: new Date('2026-04-27T12:00:00.000Z'),
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: 'voice_exceeded',
    });
  });
});

describe('UsageLimitsService.registerInboundConversation', () => {
  it('counts conversation only the first time in the month', async () => {
    const repository = new FakeUsageRepository({ plan: 'starter' });
    const service = new UsageLimitsService(repository, DEFAULT_USAGE_LIMITS_CONFIG);

    const first = await service.registerInboundConversation({
      tenantId: TENANT_ID,
      customerIdentifier: '393331112233',
      channel: 'whatsapp',
      now: new Date('2026-04-10T12:00:00.000Z'),
    });
    const second = await service.registerInboundConversation({
      tenantId: TENANT_ID,
      customerIdentifier: '393331112233',
      channel: 'whatsapp',
      now: new Date('2026-04-20T12:00:00.000Z'),
    });

    expect(first).toEqual({ counted: true });
    expect(second).toEqual({ counted: false });
    expect(repository.incrementCalls).toEqual([
      expect.objectContaining({
        tenantId: TENANT_ID,
        metricMonth: '2026-04-01',
        conversationsDelta: 1,
      }),
    ]);
  });
});

describe('UsageLimitsService.registerVoiceMessage', () => {
  it('increments voice counter for the month', async () => {
    const repository = new FakeUsageRepository({ plan: 'professional' });
    const service = new UsageLimitsService(repository, DEFAULT_USAGE_LIMITS_CONFIG);

    await service.registerVoiceMessage({
      tenantId: TENANT_ID,
      now: new Date('2026-04-27T12:00:00.000Z'),
    });

    expect(repository.incrementCalls).toEqual([
      expect.objectContaining({
        tenantId: TENANT_ID,
        metricMonth: '2026-04-01',
        voiceMessagesDelta: 1,
      }),
    ]);
  });
});

function makeService(input?: {
  plan?: UsagePlanKey;
  usage?: Partial<
    Pick<
      TenantUsageRow,
      'conversationsCount' | 'messagesCount' | 'voiceMessagesCount' | 'aiCostCents'
    >
  >;
  config?: UsageLimitsConfig;
}): UsageLimitsService {
  const repository = new FakeUsageRepository({
    plan: input?.plan ?? 'trial',
    usage: input?.usage ?? null,
  });
  return new UsageLimitsService(repository, input?.config ?? DEFAULT_USAGE_LIMITS_CONFIG);
}

class FakeUsageRepository implements UsageLimitsRepository {
  incrementCalls: Array<Parameters<UsageLimitsRepository['incrementUsage']>[0]> = [];
  private readonly conversationKeys = new Set<string>();
  private lastConversationCheck: {
    tenantId: string;
    customerIdentifier: string;
    channel: 'whatsapp';
    metricMonth: string;
  } | null = null;

  constructor(
    private readonly state: {
      plan: UsagePlanKey;
      usage?:
        | (Partial<
            Pick<
              TenantUsageRow,
              'conversationsCount' | 'messagesCount' | 'voiceMessagesCount' | 'aiCostCents'
            >
          > & { metricMonth?: string })
        | null;
    },
  ) {}

  async getTenantPlan(): Promise<UsagePlanKey | null> {
    return this.state.plan;
  }

  async getCurrentUsage(input: {
    tenantId: string;
    metricMonth: string;
  }): Promise<TenantUsageRow | null> {
    const usage = this.state.usage;
    if (!usage) {
      return null;
    }
    return {
      plan: this.state.plan,
      metricMonth: input.metricMonth,
      conversationsCount: usage.conversationsCount ?? 0,
      messagesCount: usage.messagesCount ?? 0,
      voiceMessagesCount: usage.voiceMessagesCount ?? 0,
      aiCostCents: usage.aiCostCents ?? 0,
    };
  }

  async hasConversationInMonth(input: {
    tenantId: string;
    customerIdentifier: string;
    channel: 'whatsapp';
    metricMonth: string;
  }): Promise<boolean> {
    this.lastConversationCheck = input;
    return this.conversationKeys.has(this.buildKey(input));
  }

  async incrementUsage(
    input: Parameters<UsageLimitsRepository['incrementUsage']>[0],
  ): Promise<void> {
    this.incrementCalls.push(input);

    if (
      input.conversationsDelta &&
      input.conversationsDelta > 0 &&
      this.lastConversationCheck &&
      this.lastConversationCheck.tenantId === input.tenantId &&
      this.lastConversationCheck.metricMonth === input.metricMonth
    ) {
      this.conversationKeys.add(this.buildKey(this.lastConversationCheck));
    }
  }

  private buildKey(input: {
    tenantId: string;
    customerIdentifier: string;
    channel: 'whatsapp';
    metricMonth: string;
  }): string {
    return `${input.tenantId}:${input.channel}:${input.customerIdentifier}:${input.metricMonth}`;
  }
}
