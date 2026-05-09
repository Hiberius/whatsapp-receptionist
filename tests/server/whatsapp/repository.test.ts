// Test per SupabaseWhatsAppWebhookRepository: copre i metodi piu' critici per
// idempotency (recordWebhookEvent unique-violation), tenant resolution con
// fallback, optedOut detection e increment usage.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';

type FromResult = {
  data: unknown;
  error: unknown;
};

interface FluentBuilder {
  select: (...args: unknown[]) => FluentBuilder;
  insert: (...args: unknown[]) => FluentBuilder;
  update: (...args: unknown[]) => FluentBuilder;
  upsert: (...args: unknown[]) => FluentBuilder;
  eq: (...args: unknown[]) => FluentBuilder;
  contains: (...args: unknown[]) => FluentBuilder;
  single: () => Promise<FromResult>;
  maybeSingle: () => Promise<FromResult>;
}

const state: {
  fromCalls: string[];
  insertOps: Array<{ table: string; payload: unknown }>;
  updateOps: Array<{ table: string; payload: unknown }>;
  // Coda di risultati per .single() in ordine FIFO
  singleQueue: FromResult[];
  // Coda per .maybeSingle() in ordine FIFO
  maybeSingleQueue: FromResult[];
  // Per chain update/upsert che si chiude con .eq(...).eq(...)
  updateError: unknown;
} = {
  fromCalls: [],
  insertOps: [],
  updateOps: [],
  singleQueue: [],
  maybeSingleQueue: [],
  updateError: null,
};

function popOrDefault(queue: FromResult[]): FromResult {
  const next = queue.shift();
  return next ?? { data: null, error: null };
}

function makeBuilder(table: string): FluentBuilder {
  let lastOp: 'select' | 'insert' | 'update' | 'upsert' = 'select';

  const builder: FluentBuilder = {
    select: () => {
      // No-op: passa attraverso
      return builder;
    },
    insert: (payload: unknown) => {
      lastOp = 'insert';
      state.insertOps.push({ table, payload });
      return builder;
    },
    update: (payload: unknown) => {
      lastOp = 'update';
      state.updateOps.push({ table, payload });
      // chain che chiude su .eq().eq() — thenable per await
      const tail: FluentBuilder & {
        then: (resolve: (value: { error: unknown }) => void) => void;
      } = {
        select: () => tail,
        insert: () => tail,
        update: () => tail,
        upsert: () => tail,
        eq: () => tail,
        contains: () => tail,
        single: async () => popOrDefault(state.singleQueue),
        maybeSingle: async () => popOrDefault(state.maybeSingleQueue),
        then: (resolve) => resolve({ error: state.updateError }),
      };

      return tail as FluentBuilder;
    },
    upsert: (payload: unknown) => {
      lastOp = 'upsert';
      state.insertOps.push({ table: `${table}:upsert`, payload });
      return builder;
    },
    eq: () => builder,
    contains: () => builder,
    single: async () => popOrDefault(state.singleQueue),
    maybeSingle: async () => popOrDefault(state.maybeSingleQueue),
  };

  // lastOp evita warning lint senza usarlo
  void lastOp;

  return builder;
}

const rpcMock = vi.fn();

const adminClientMock = {
  from: vi.fn((table: string) => {
    state.fromCalls.push(table);
    return makeBuilder(table);
  }),
  rpc: rpcMock,
};

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => adminClientMock),
}));

const { SupabaseWhatsAppWebhookRepository } = await import('@/server/whatsapp/repository');

beforeEach(() => {
  state.fromCalls = [];
  state.insertOps = [];
  state.updateOps = [];
  state.singleQueue = [];
  state.maybeSingleQueue = [];
  state.updateError = null;
  rpcMock.mockReset();
  adminClientMock.from.mockClear();
});

describe('SupabaseWhatsAppWebhookRepository.recordWebhookEvent', () => {
  it('returns new event id when insert succeeds', async () => {
    // Arrange
    state.singleQueue.push({ data: { id: 'evt_1' }, error: null });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act
    const result = await repo.recordWebhookEvent({
      tenantId: null,
      provider: 'whatsapp_360dialog',
      eventType: 'message',
      externalId: 'message:wamid.1',
      idempotencyKey: 'idem_1',
      payload: { foo: 'bar' },
    });

    // Assert: insert riuscito senza unique-violation, quindi duplicate=false
    expect(result).toEqual({ eventId: 'evt_1', duplicate: false });
  });

  it('detects duplicate via unique violation 23505 and resolves existing event', async () => {
    // Arrange:
    // 1. Prima single (insert) ritorna error con code 23505
    state.singleQueue.push({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    // 2. Seconda single (resolveExistingWebhookEvent select) ritorna l'evento gia' processato
    state.singleQueue.push({
      data: {
        id: 'evt_existing',
        status: 'processed',
        received_at: new Date().toISOString(),
      },
      error: null,
    });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act
    const result = await repo.recordWebhookEvent({
      tenantId: null,
      provider: 'whatsapp_360dialog',
      eventType: 'message',
      externalId: 'message:wamid.dup',
      idempotencyKey: 'idem_dup',
      payload: {},
    });

    // Assert
    expect(result).toEqual({ eventId: 'evt_existing', duplicate: true });
  });

  it('rethrows non-unique-violation errors as upstream_error AppError', async () => {
    // Arrange: error code generico
    state.singleQueue.push({
      data: null,
      error: { code: '08000', message: 'connection error' },
    });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act + Assert
    await expect(
      repo.recordWebhookEvent({
        tenantId: null,
        provider: 'whatsapp_360dialog',
        eventType: 'message',
        externalId: 'm:1',
        idempotencyKey: 'idem',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('SupabaseWhatsAppWebhookRepository.resolveTenantByPhoneNumberId', () => {
  it('returns mapped tenant from external_account_id direct hit', async () => {
    // Arrange
    state.maybeSingleQueue.push({
      data: { id: 'integration_1', tenant_id: 'tenant_1' },
      error: null,
    });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act
    const result = await repo.resolveTenantByPhoneNumberId('phone_xyz');

    // Assert
    expect(result).toEqual({ integrationId: 'integration_1', tenantId: 'tenant_1' });
  });

  it('falls back to config.phone_number_id contains when direct returns null', async () => {
    // Arrange: prima maybeSingle ritorna null (no direct)
    state.maybeSingleQueue.push({ data: null, error: null });
    // seconda maybeSingle (fallback contains) ritorna integration
    state.maybeSingleQueue.push({
      data: { id: 'integration_fb', tenant_id: 'tenant_fb' },
      error: null,
    });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act
    const result = await repo.resolveTenantByPhoneNumberId('phone_legacy');

    // Assert
    expect(result).toEqual({ integrationId: 'integration_fb', tenantId: 'tenant_fb' });
  });

  it('returns null when no integration matches', async () => {
    // Arrange
    state.maybeSingleQueue.push({ data: null, error: null });
    state.maybeSingleQueue.push({ data: null, error: null });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act
    const result = await repo.resolveTenantByPhoneNumberId('phone_unknown');

    // Assert
    expect(result).toBeNull();
  });

  it('throws upstream_error when supabase reports an error', async () => {
    // Arrange
    state.maybeSingleQueue.push({ data: null, error: { message: 'rls denied' } });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act + Assert
    await expect(repo.resolveTenantByPhoneNumberId('p')).rejects.toMatchObject({
      code: 'upstream_error',
    });
  });
});

describe('SupabaseWhatsAppWebhookRepository.isCustomerOptedOut', () => {
  it('returns true when row exists with id', async () => {
    // Arrange
    state.maybeSingleQueue.push({ data: { id: 'opt_1' }, error: null });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act
    const result = await repo.isCustomerOptedOut({
      tenantId: 't',
      channel: 'whatsapp',
      customerIdentifier: '393331112233',
    });

    // Assert
    expect(result).toBe(true);
  });

  it('returns false when no row found', async () => {
    // Arrange
    state.maybeSingleQueue.push({ data: null, error: null });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act
    const result = await repo.isCustomerOptedOut({
      tenantId: 't',
      channel: 'whatsapp',
      customerIdentifier: '393331112233',
    });

    // Assert
    expect(result).toBe(false);
  });
});

describe('SupabaseWhatsAppWebhookRepository.getTenantMessagingConfig', () => {
  it('returns config from row when present', async () => {
    // Arrange
    state.maybeSingleQueue.push({
      data: {
        assistant_name: 'Stefania',
        ai_disclosure_enabled: false,
        auto_reply_enabled: true,
        default_locale: 'en-GB',
      },
      error: null,
    });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act
    const config = await repo.getTenantMessagingConfig('tenant_1');

    // Assert
    expect(config).toEqual({
      assistantName: 'Stefania',
      aiDisclosureEnabled: false,
      autoReplyEnabled: true,
      defaultLocale: 'en-GB',
    });
  });

  it('returns sane defaults when no row exists', async () => {
    // Arrange
    state.maybeSingleQueue.push({ data: null, error: null });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act
    const config = await repo.getTenantMessagingConfig('tenant_default');

    // Assert: i default sono cablati nel repository
    expect(config).toEqual({
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: true,
      autoReplyEnabled: false,
      defaultLocale: 'it-IT',
    });
  });
});

describe('SupabaseWhatsAppWebhookRepository.incrementUsage', () => {
  it('forwards aiCostCentsDelta default 0 when missing', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({ error: null });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act
    await repo.incrementUsage({
      tenantId: 'tenant_1',
      metricMonth: '2026-05-01',
      messagesDelta: 1,
    });

    // Assert
    expect(rpcMock).toHaveBeenCalledWith('increment_usage_metrics', {
      p_tenant_id: 'tenant_1',
      p_metric_month: '2026-05-01',
      p_messages_delta: 1,
      p_conversations_delta: 0,
      p_ai_cost_cents_delta: 0,
    });
  });

  it('throws upstream_error AppError when RPC fails', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({ error: { message: 'rpc failure' } });
    const repo = new SupabaseWhatsAppWebhookRepository();

    // Act + Assert
    await expect(
      repo.incrementUsage({
        tenantId: 't',
        metricMonth: '2026-05-01',
        messagesDelta: 1,
      }),
    ).rejects.toMatchObject({ code: 'upstream_error' });
  });
});
