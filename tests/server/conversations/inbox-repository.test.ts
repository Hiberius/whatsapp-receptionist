// Test per SupabaseConversationInboxRepository (lato infra) — copre listing,
// get, update, audit log. Mockiamo client admin con un fluent builder che
// ritorna risultati programmati via FIFO queue (pattern simile agli altri
// test di repository Supabase). Service-level tests stanno in inbox.test.ts.

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
  order: (...args: unknown[]) => FluentBuilder;
  limit: (...args: unknown[]) => FluentBuilder;
  lt: (...args: unknown[]) => FluentBuilder;
  maybeSingle: () => Promise<FromResult>;
  single: () => Promise<FromResult>;
  then?: (resolve: (value: FromResult) => void) => void;
}

const state: {
  fromCalls: string[];
  insertOps: Array<{ table: string; payload: unknown }>;
  updateOps: Array<{ table: string; payload: unknown }>;
  // queue per terminator-await senza .single() (es. listConversations termina con .limit())
  thenableQueue: FromResult[];
  // queue per .maybeSingle()
  maybeSingleQueue: FromResult[];
  // errore per chain di update/insert/upsert chiusi via .eq().eq()
  updateThenable: FromResult | null;
} = {
  fromCalls: [],
  insertOps: [],
  updateOps: [],
  thenableQueue: [],
  maybeSingleQueue: [],
  updateThenable: null,
};

function popOrDefault(queue: FromResult[]): FromResult {
  return queue.shift() ?? { data: null, error: null };
}

function makeBuilder(table: string): FluentBuilder {
  const builder: FluentBuilder = {
    select: () => builder,
    insert: (payload: unknown) => {
      state.insertOps.push({ table, payload });
      // chain insert si chiude con .eq() o e' awaited direttamente (insert solo)
      const tail: FluentBuilder & {
        then: (resolve: (value: FromResult) => void) => void;
      } = {
        select: () => tail,
        insert: () => tail,
        update: () => tail,
        upsert: () => tail,
        eq: () => tail,
        order: () => tail,
        limit: () => tail,
        lt: () => tail,
        maybeSingle: async () => popOrDefault(state.maybeSingleQueue),
        single: async () => popOrDefault(state.thenableQueue),
        then: (resolve) => resolve(state.updateThenable ?? { data: null, error: null }),
      };

      return tail;
    },
    update: (payload: unknown) => {
      state.updateOps.push({ table, payload });
      // chain update si chiude con .eq().select().maybeSingle() per update
      // o con .eq() per audit log. Non usiamo then qui — rendiamo
      // tutto chainable e il terminator pop le queue corrette.
      return builder;
    },
    upsert: (payload: unknown) => {
      state.insertOps.push({ table: `${table}:upsert`, payload });
      return builder;
    },
    eq: () => builder,
    order: () => builder,
    limit: () => listTerminator(),
    lt: () => builder,
    maybeSingle: async () => popOrDefault(state.maybeSingleQueue),
    single: async () => popOrDefault(state.thenableQueue),
  };

  function listTerminator(): FluentBuilder {
    // listConversations / listMessages chiamano .order().limit() e poi await
    // l'oggetto. Ritorniamo un thenable che pop dalla queue.
    const tail: FluentBuilder & {
      then: (resolve: (value: FromResult) => void) => void;
    } = {
      select: () => tail,
      insert: () => tail,
      update: () => tail,
      upsert: () => tail,
      eq: () => tail,
      order: () => tail,
      limit: () => tail,
      lt: () => tail,
      maybeSingle: async () => popOrDefault(state.maybeSingleQueue),
      single: async () => popOrDefault(state.thenableQueue),
      then: (resolve) => resolve(popOrDefault(state.thenableQueue)),
    };

    return tail;
  }

  return builder;
}

const adminClientMock = {
  from: vi.fn((table: string) => {
    state.fromCalls.push(table);
    return makeBuilder(table);
  }),
};

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => adminClientMock),
}));

const { SupabaseConversationInboxRepository } = await import('@/server/conversations/inbox');

beforeEach(() => {
  state.fromCalls = [];
  state.insertOps = [];
  state.updateOps = [];
  state.thenableQueue = [];
  state.maybeSingleQueue = [];
  state.updateThenable = null;
  adminClientMock.from.mockClear();
});

describe('SupabaseConversationInboxRepository.listConversations', () => {
  it('maps Supabase rows to ConversationSummary list (happy path)', async () => {
    // Arrange
    state.thenableQueue.push({
      data: [
        {
          id: 'conv_1',
          channel: 'whatsapp',
          customer_identifier: '393331112233',
          customer_name: 'Mario',
          status: 'active',
          ai_enabled: true,
          last_message_at: '2026-05-08T11:00:00.000Z',
          metadata: { provider: 'whatsapp_360dialog' },
          created_at: '2026-05-01T08:00:00.000Z',
          updated_at: '2026-05-08T11:00:00.000Z',
        },
      ],
      error: null,
    });
    const repo = new SupabaseConversationInboxRepository();

    // Act
    const result = await repo.listConversations({
      tenantId: 'tenant_1',
      filters: { limit: 30, before: null },
    });

    // Assert
    expect(result).toEqual([
      {
        id: 'conv_1',
        channel: 'whatsapp',
        customerIdentifier: '393331112233',
        customerName: 'Mario',
        status: 'active',
        aiEnabled: true,
        lastMessageAt: '2026-05-08T11:00:00.000Z',
        metadata: { provider: 'whatsapp_360dialog' },
        createdAt: '2026-05-01T08:00:00.000Z',
        updatedAt: '2026-05-08T11:00:00.000Z',
      },
    ]);
  });

  it('returns empty array when supabase returns null data', async () => {
    // Arrange
    state.thenableQueue.push({ data: null, error: null });
    const repo = new SupabaseConversationInboxRepository();

    // Act
    const result = await repo.listConversations({
      tenantId: 'tenant_1',
      filters: { limit: 10, before: null },
    });

    // Assert
    expect(result).toEqual([]);
  });

  it('throws upstream_error AppError when supabase reports error', async () => {
    // Arrange
    state.thenableQueue.push({ data: null, error: { message: 'rls denied' } });
    const repo = new SupabaseConversationInboxRepository();

    // Act + Assert
    await expect(
      repo.listConversations({
        tenantId: 'tenant_1',
        filters: { limit: 10, before: null },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('handles invalid metadata gracefully (returns {} for non-objects)', async () => {
    // Arrange: metadata e' una stringa, deve diventare {}
    state.thenableQueue.push({
      data: [
        {
          id: 'conv_2',
          channel: 'whatsapp',
          customer_identifier: '+39000',
          customer_name: null,
          status: 'closed',
          ai_enabled: false,
          last_message_at: '2026-05-08T11:00:00.000Z',
          metadata: 'corrupted-string',
          created_at: '2026-05-01T08:00:00.000Z',
          updated_at: '2026-05-08T11:00:00.000Z',
        },
      ],
      error: null,
    });
    const repo = new SupabaseConversationInboxRepository();

    // Act
    const result = await repo.listConversations({
      tenantId: 't',
      filters: { limit: 1, before: null },
    });

    // Assert
    expect(result[0]?.metadata).toEqual({});
  });
});

describe('SupabaseConversationInboxRepository.getConversation', () => {
  it('returns null when conversation is not found', async () => {
    // Arrange
    state.maybeSingleQueue.push({ data: null, error: null });
    const repo = new SupabaseConversationInboxRepository();

    // Act
    const result = await repo.getConversation({
      tenantId: 'tenant_1',
      conversationId: 'missing',
    });

    // Assert
    expect(result).toBeNull();
  });

  it('throws upstream_error on supabase error', async () => {
    // Arrange
    state.maybeSingleQueue.push({ data: null, error: { message: 'pg error' } });
    const repo = new SupabaseConversationInboxRepository();

    // Act + Assert
    await expect(
      repo.getConversation({ tenantId: 't', conversationId: 'c' }),
    ).rejects.toMatchObject({ code: 'upstream_error' });
  });
});

describe('SupabaseConversationInboxRepository.recordAuditLog', () => {
  it('writes audit_log entry without throwing when insert succeeds', async () => {
    // Arrange
    state.updateThenable = { data: null, error: null };
    const repo = new SupabaseConversationInboxRepository();

    // Act + Assert
    await expect(
      repo.recordAuditLog({
        tenantId: 'tenant_1',
        userId: 'user_1',
        action: 'conversations.conversation.updated',
        resourceType: 'conversation',
        resourceId: 'conv_1',
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
        metadata: { fields: ['status'] },
      }),
    ).resolves.toBeUndefined();
    expect(state.insertOps.some((op) => op.table === 'audit_log')).toBe(true);
  });

  it('throws upstream_error when audit insert fails', async () => {
    // Arrange
    state.updateThenable = { data: null, error: { message: 'fk' } };
    const repo = new SupabaseConversationInboxRepository();

    // Act + Assert
    await expect(
      repo.recordAuditLog({
        tenantId: 't',
        userId: 'u',
        action: 'a',
        resourceType: 'conversation',
        resourceId: null,
        ipAddress: null,
        userAgent: null,
        metadata: {},
      }),
    ).rejects.toMatchObject({ code: 'upstream_error' });
  });
});
