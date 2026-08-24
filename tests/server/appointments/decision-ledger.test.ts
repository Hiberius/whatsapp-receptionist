// Test del decision ledger: verifica il payload scritto su
// `scheduling_decisions`, la sopravvivenza di punteggi e motivazioni al round
// trip JSON, e la garanzia di isolamento fra tenant.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { rankSlots } from '@/server/appointments/slot-ranking';

type InsertOp = { table: string; payload: Record<string, unknown> };

const state: {
  insertOps: InsertOp[];
  insertError: unknown;
  adminClientCalls: number;
} = {
  insertOps: [],
  insertError: null,
  adminClientCalls: 0,
};

const adminClientMock = {
  from(table: string) {
    return {
      insert(payload: Record<string, unknown>) {
        state.insertOps.push({ table, payload });

        return Promise.resolve({ error: state.insertError });
      },
    };
  },
};

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => {
    state.adminClientCalls += 1;

    return adminClientMock;
  }),
}));

const {
  NoopSchedulingDecisionLedger,
  SupabaseSchedulingDecisionLedger,
  createSchedulingDecisionLedger,
  toDecisionCandidates,
} = await import('@/server/appointments/decision-ledger');

beforeEach(() => {
  state.insertOps = [];
  state.insertError = null;
  state.adminClientCalls = 0;
});

describe('toDecisionCandidates', () => {
  it('keeps every scored slot in ranking order', () => {
    const ranked = rankSlots({
      slots: [
        slot('2026-04-29T09:00:00.000Z'),
        slot('2026-04-27T09:00:00.000Z'),
        slot('2026-04-28T09:00:00.000Z'),
      ],
      request: bookingRequest(),
      now: new Date('2026-04-27T07:00:00.000Z'),
    });

    expect(toDecisionCandidates(ranked).map((candidate) => candidate.start)).toEqual([
      '2026-04-27T09:00:00.000Z',
      '2026-04-28T09:00:00.000Z',
      '2026-04-29T09:00:00.000Z',
    ]);
  });
});

describe('SupabaseSchedulingDecisionLedger', () => {
  it('persists the decision row with the ranked candidates', async () => {
    const ledger = new SupabaseSchedulingDecisionLedger();

    await ledger.record({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      request: { serviceQuery: 'prima visita' },
      rankingVersion: 'slot-ranking-v1',
      candidates: [
        {
          start: '2026-04-28T09:00:00.000Z',
          end: '2026-04-28T09:30:00.000Z',
          score: 24,
          reasons: [
            { signal: 'earliest_availability', points: 24, detail: 'Disponibile oggi stesso.' },
          ],
        },
      ],
      explanation: 'spiegazione',
    });

    expect(state.insertOps).toHaveLength(1);
    expect(state.insertOps[0]?.table).toBe('scheduling_decisions');
    expect(state.insertOps[0]?.payload).toEqual({
      tenant_id: 'tenant_1',
      conversation_id: 'conversation_1',
      request: { serviceQuery: 'prima visita' },
      ranking_version: 'slot-ranking-v1',
      candidates: [
        {
          start: '2026-04-28T09:00:00.000Z',
          end: '2026-04-28T09:30:00.000Z',
          score: 24,
          reasons: [
            { signal: 'earliest_availability', points: 24, detail: 'Disponibile oggi stesso.' },
          ],
        },
      ],
      explanation: 'spiegazione',
    });
  });

  it('survives a JSON round trip with scores and reasons intact', async () => {
    const ranked = rankSlots({
      slots: [slot('2026-04-28T14:00:00.000Z'), slot('2026-04-28T09:00:00.000Z')],
      request: bookingRequest(),
      now: new Date('2026-04-27T07:00:00.000Z'),
    });
    const candidates = toDecisionCandidates(ranked);
    const ledger = new SupabaseSchedulingDecisionLedger();

    await ledger.record({
      tenantId: 'tenant_1',
      conversationId: null,
      request: {},
      rankingVersion: 'slot-ranking-v1',
      candidates,
      explanation: null,
    });

    const stored = state.insertOps[0]?.payload.candidates;
    const roundTripped = JSON.parse(JSON.stringify(stored));

    expect(roundTripped).toEqual(candidates);
    expect(roundTripped[0].score).toBe(ranked[0]?.score);
    expect(roundTripped[0].reasons).toEqual(ranked[0]?.reasons);
    expect(
      roundTripped[0].reasons.reduce(
        (total: number, reason: { points: number }) => total + reason.points,
        0,
      ),
    ).toBe(roundTripped[0].score);
  });

  it('accepts a null conversation id', async () => {
    const ledger = new SupabaseSchedulingDecisionLedger();

    await ledger.record({
      tenantId: 'tenant_1',
      conversationId: null,
      request: {},
      rankingVersion: 'slot-ranking-v1',
      candidates: [],
      explanation: null,
    });

    expect(state.insertOps[0]?.payload.conversation_id).toBeNull();
  });

  it('raises an AppError when the insert fails', async () => {
    state.insertError = { message: 'insert denied' };
    const ledger = new SupabaseSchedulingDecisionLedger();

    await expect(
      ledger.record({
        tenantId: 'tenant_1',
        conversationId: null,
        request: {},
        rankingVersion: 'slot-ranking-v1',
        candidates: [],
        explanation: null,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('createSchedulingDecisionLedger', () => {
  it('does not build the Supabase client until the first write', async () => {
    const ledger = createSchedulingDecisionLedger();

    expect(state.adminClientCalls).toBe(0);

    await ledger.record({
      tenantId: 'tenant_1',
      conversationId: null,
      request: {},
      rankingVersion: 'slot-ranking-v1',
      candidates: [],
      explanation: null,
    });

    expect(state.adminClientCalls).toBe(1);
  });
});

describe('NoopSchedulingDecisionLedger', () => {
  it('writes nothing', async () => {
    await new NoopSchedulingDecisionLedger().record({
      tenantId: 'tenant_1',
      conversationId: null,
      request: {},
      rankingVersion: 'slot-ranking-v1',
      candidates: [],
      explanation: null,
    });

    expect(state.insertOps).toEqual([]);
  });
});

/**
 * Isolamento fra tenant.
 *
 * Il ledger scrive in `service_role`, che scavalca la Row Level Security: le
 * due difese sono il `tenant_id` sempre stampato sulla riga (verificato sopra)
 * e la policy RLS che vincola la lettura al tenant del claim JWT.
 */
describe('scheduling_decisions — isolamento tenant', () => {
  const migration = readMigration('scheduling_decisions');

  it('stamps the requested tenant on every row', async () => {
    const ledger = new SupabaseSchedulingDecisionLedger();

    await ledger.record({
      tenantId: 'tenant_a',
      conversationId: null,
      request: {},
      rankingVersion: 'slot-ranking-v1',
      candidates: [],
      explanation: null,
    });
    await ledger.record({
      tenantId: 'tenant_b',
      conversationId: null,
      request: {},
      rankingVersion: 'slot-ranking-v1',
      candidates: [],
      explanation: null,
    });

    expect(state.insertOps.map((op) => op.payload.tenant_id)).toEqual(['tenant_a', 'tenant_b']);
  });

  it('enables row level security on the table', () => {
    expect(migration).toContain(
      'alter table public.scheduling_decisions enable row level security',
    );
  });

  it('scopes the policy to the tenant of the JWT claim', () => {
    expect(migration).toContain('create policy scheduling_decisions_tenant_all');
    expect(migration).toContain('using (tenant_id = public.current_tenant_id())');
    expect(migration).toContain('with check (tenant_id = public.current_tenant_id())');
  });
});

function readMigration(fragment: string): string {
  const directory = 'supabase/migrations';
  const file = readdirSync(directory).find((name) => name.includes(fragment));

  if (!file) {
    throw new Error(`Migration containing "${fragment}" not found`);
  }

  return readFileSync(join(directory, file), 'utf8');
}

function slot(start: string) {
  return {
    serviceId: 'service_1',
    start,
    end: new Date(Date.parse(start) + 30 * 60_000).toISOString(),
    timezone: 'UTC',
  };
}

function bookingRequest() {
  return {
    serviceQuery: null,
    datePreference: null,
    timePreference: { dayPart: 'any' as const, startHour: null, endHour: null },
    urgency: 'normal' as const,
    customerName: null,
    customerPhone: null,
    confidence: 0.5,
    signals: [],
  };
}
