// Test del ranker deterministico degli slot. Il ranker e' puro: nessun mock di
// DB, rete o LLM serve qui — se un giorno servisse, vorrebbe dire che il ranker
// ha smesso di essere puro.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type {
  BookingDatePreference,
  StructuredBookingRequest,
} from '@/server/ai/booking-extractor';
import {
  SLOT_RANKING_VERSION,
  buildRankingExplanation,
  rankSlots,
  slotIdentity,
  type RankableSlot,
} from '@/server/appointments/slot-ranking';

const now = new Date('2026-04-27T07:00:00.000Z');

describe('rankSlots', () => {
  it('scores every slot as the exact sum of its reasons', () => {
    const ranked = rankSlots({
      slots: [
        slot('2026-04-27T09:00:00.000Z'),
        slot('2026-04-28T14:00:00.000Z'),
        slot('2026-04-30T18:00:00.000Z'),
      ],
      request: request({
        datePreference: datePreference('2026-04-28T00:00:00.000Z', '2026-04-29T00:00:00.000Z'),
        timePreference: { dayPart: 'afternoon', startHour: 13, endHour: 18 },
      }),
      now,
    });

    expect(ranked).toHaveLength(3);

    for (const entry of ranked) {
      expect(entry.reasons.length).toBeGreaterThan(0);
      expect(entry.reasons.reduce((total, reason) => total + reason.points, 0)).toBe(entry.score);
    }
  });

  it('always reports one reason per evaluated signal', () => {
    const [ranked] = rankSlots({
      slots: [slot('2026-04-27T09:00:00.000Z')],
      request: request({}),
      now,
    });

    expect(ranked?.reasons.map((reason) => reason.signal)).toEqual([
      'requested_date_match',
      'time_preference_match',
      'explicit_time_proximity',
      'earliest_availability',
    ]);
  });

  it('prefers slots inside the requested date window', () => {
    const ranked = rankSlots({
      slots: [
        slot('2026-04-27T09:00:00.000Z'),
        slot('2026-04-29T09:00:00.000Z'),
        slot('2026-04-28T09:00:00.000Z'),
      ],
      request: request({
        datePreference: datePreference('2026-04-29T00:00:00.000Z', '2026-04-30T00:00:00.000Z'),
      }),
      now,
    });

    // Il 29 è due giorni dopo "oggi" e perde sul segnale di disponibilità
    // anticipata: vince comunque, perché la data richiesta pesa di più.
    expect(ranked.map((entry) => entry.slot.start)).toEqual([
      '2026-04-29T09:00:00.000Z',
      '2026-04-27T09:00:00.000Z',
      '2026-04-28T09:00:00.000Z',
    ]);
    expect(ranked[0]?.reasons[0]).toMatchObject({
      signal: 'requested_date_match',
      points: 40,
    });
  });

  it('prefers slots inside the requested day part', () => {
    const ranked = rankSlots({
      slots: [slot('2026-04-27T09:00:00.000Z'), slot('2026-04-27T15:00:00.000Z')],
      request: request({
        timePreference: { dayPart: 'afternoon', startHour: 13, endHour: 18 },
      }),
      now,
    });

    expect(ranked.map((entry) => entry.slot.start)).toEqual([
      '2026-04-27T15:00:00.000Z',
      '2026-04-27T09:00:00.000Z',
    ]);
  });

  it('ranks explicit-hour requests by proximity to the requested hour', () => {
    const ranked = rankSlots({
      slots: [
        slot('2026-04-27T15:00:00.000Z'),
        slot('2026-04-27T17:00:00.000Z'),
        slot('2026-04-27T16:00:00.000Z'),
      ],
      request: request({
        timePreference: { dayPart: 'exact_hour', startHour: 17, endHour: 18 },
      }),
      now,
    });

    expect(ranked.map((entry) => entry.slot.start)).toEqual([
      '2026-04-27T17:00:00.000Z',
      '2026-04-27T16:00:00.000Z',
      '2026-04-27T15:00:00.000Z',
    ]);
    expect(reasonPoints(ranked[0]?.reasons, 'explicit_time_proximity')).toBe(12);
    expect(reasonPoints(ranked[1]?.reasons, 'explicit_time_proximity')).toBe(8);
    expect(reasonPoints(ranked[2]?.reasons, 'explicit_time_proximity')).toBe(4);
  });

  it('does not anchor proximity on "before hour" requests', () => {
    // "prima delle 17" è un limite, non un obiettivo: premiare la vicinanza al
    // limite spingerebbe sempre sull'orario più tardo possibile.
    const ranked = rankSlots({
      slots: [slot('2026-04-27T16:00:00.000Z'), slot('2026-04-27T09:00:00.000Z')],
      request: request({
        timePreference: { dayPart: 'before_hour', startHour: 8, endHour: 17 },
      }),
      now,
    });

    for (const entry of ranked) {
      expect(reasonPoints(entry.reasons, 'explicit_time_proximity')).toBe(0);
    }

    expect(ranked[0]?.slot.start).toBe('2026-04-27T09:00:00.000Z');
  });

  it('decays the earliest-availability signal by calendar day', () => {
    const ranked = rankSlots({
      slots: [
        slot('2026-04-30T09:00:00.000Z'),
        slot('2026-04-27T09:00:00.000Z'),
        slot('2026-04-28T09:00:00.000Z'),
        slot('2026-04-29T09:00:00.000Z'),
      ],
      request: request({}),
      now,
    });

    expect(ranked.map((entry) => entry.score)).toEqual([24, 16, 8, 0]);
    expect(ranked.map((entry) => entry.slot.start)).toEqual([
      '2026-04-27T09:00:00.000Z',
      '2026-04-28T09:00:00.000Z',
      '2026-04-29T09:00:00.000Z',
      '2026-04-30T09:00:00.000Z',
    ]);
  });

  it('breaks score ties by start time, then by stable slot identity', () => {
    const sameStart = '2026-04-27T09:00:00.000Z';
    const ranked = rankSlots({
      slots: [
        {
          serviceId: 'service_b',
          start: sameStart,
          end: '2026-04-27T09:30:00.000Z',
          timezone: 'UTC',
        },
        {
          serviceId: 'service_a',
          start: sameStart,
          end: '2026-04-27T09:30:00.000Z',
          timezone: 'UTC',
        },
        slot('2026-04-27T08:00:00.000Z'),
      ],
      request: request({}),
      now,
    });

    expect(ranked.map((entry) => slotIdentity(entry.slot))).toEqual([
      '2026-04-27T08:00:00.000Z|2026-04-27T08:30:00.000Z|service_1',
      `${sameStart}|2026-04-27T09:30:00.000Z|service_a`,
      `${sameStart}|2026-04-27T09:30:00.000Z|service_b`,
    ]);
  });

  it('handles fewer than three candidates', () => {
    const ranked = rankSlots({
      slots: [slot('2026-04-27T09:00:00.000Z'), slot('2026-04-27T10:00:00.000Z')],
      request: request({}),
      now,
    });

    expect(ranked).toHaveLength(2);
    expect(ranked.slice(0, 3)).toHaveLength(2);
  });

  it('handles an empty candidate set', () => {
    const ranked = rankSlots({ slots: [], request: request({}), now });

    expect(ranked).toEqual([]);
    expect(buildRankingExplanation(ranked)).toBeNull();
  });

  it('does not mutate the input array', () => {
    const slots = [slot('2026-04-29T09:00:00.000Z'), slot('2026-04-27T09:00:00.000Z')];
    const snapshot = slots.map((entry) => entry.start);

    rankSlots({ slots, request: request({}), now });

    expect(slots.map((entry) => entry.start)).toEqual(snapshot);
  });
});

describe('rankSlots — determinismo', () => {
  const slots = [
    slot('2026-04-28T09:00:00.000Z'),
    slot('2026-04-28T14:00:00.000Z'),
    slot('2026-04-29T09:30:00.000Z'),
    slot('2026-04-27T18:00:00.000Z'),
    slot('2026-04-28T16:00:00.000Z'),
  ];
  const bookingRequest = request({
    datePreference: datePreference('2026-04-28T00:00:00.000Z', '2026-04-29T00:00:00.000Z'),
    timePreference: { dayPart: 'afternoon', startHour: 13, endHour: 18 },
  });

  it('returns deep-equal output across repeated runs', () => {
    const first = rankSlots({ slots, request: bookingRequest, now });

    for (let run = 0; run < 20; run += 1) {
      expect(rankSlots({ slots, request: bookingRequest, now })).toEqual(first);
    }
  });

  it('ignores input array order', () => {
    const expected = rankSlots({ slots, request: bookingRequest, now });

    for (const permutation of rotations(slots)) {
      expect(rankSlots({ slots: permutation, request: bookingRequest, now })).toEqual(expected);
    }

    expect(rankSlots({ slots: [...slots].reverse(), request: bookingRequest, now })).toEqual(
      expected,
    );
  });
});

describe('rankSlots — golden', () => {
  /**
   * Golden test: fissa l'output completo (ordine, punteggi, motivazioni) di uno
   * scenario realistico. Un cambio di peso o di tie-break non passa più in
   * silenzio: va accompagnato da un bump di SLOT_RANKING_VERSION.
   */
  it('matches the recorded ranking for "domani pomeriggio verso le 15"', () => {
    const ranked = rankSlots({
      slots: [
        slot('2026-04-28T16:00:00.000Z'),
        slot('2026-04-28T14:00:00.000Z'),
        slot('2026-04-28T09:00:00.000Z'),
        slot('2026-04-29T15:00:00.000Z'),
      ],
      request: request({
        datePreference: datePreference('2026-04-28T13:00:00.000Z', '2026-04-28T18:00:00.000Z'),
        timePreference: { dayPart: 'exact_hour', startHour: 15, endHour: 16 },
      }),
      now,
    });

    expect(
      ranked.map((entry) => ({
        start: entry.slot.start,
        score: entry.score,
        reasons: entry.reasons.map((reason) => [reason.signal, reason.points]),
      })),
    ).toEqual([
      // Pari punteggio con le 16:00 — vince per orario più vicino (tie-break 2).
      {
        start: '2026-04-28T14:00:00.000Z',
        score: 64,
        reasons: [
          ['requested_date_match', 40],
          ['time_preference_match', 0],
          ['explicit_time_proximity', 8],
          ['earliest_availability', 16],
        ],
      },
      {
        start: '2026-04-28T16:00:00.000Z',
        score: 64,
        reasons: [
          ['requested_date_match', 40],
          ['time_preference_match', 0],
          ['explicit_time_proximity', 8],
          ['earliest_availability', 16],
        ],
      },
      // Ora esatta perfetta, ma il giorno sbagliato: la data richiesta pesa di più.
      {
        start: '2026-04-29T15:00:00.000Z',
        score: 50,
        reasons: [
          ['requested_date_match', 0],
          ['time_preference_match', 30],
          ['explicit_time_proximity', 12],
          ['earliest_availability', 8],
        ],
      },
      {
        start: '2026-04-28T09:00:00.000Z',
        score: 16,
        reasons: [
          ['requested_date_match', 0],
          ['time_preference_match', 0],
          ['explicit_time_proximity', 0],
          ['earliest_availability', 16],
        ],
      },
    ]);
  });
});

describe('buildRankingExplanation', () => {
  it('renders a deterministic template naming the ranking version', () => {
    const ranked = rankSlots({
      slots: [slot('2026-04-27T09:00:00.000Z'), slot('2026-04-28T09:00:00.000Z')],
      request: request({}),
      now,
    });
    const explanation = buildRankingExplanation(ranked);

    expect(explanation).toBe(
      `2 slot valutati con ${SLOT_RANKING_VERSION}. Primo: 2026-04-27T09:00:00.000Z con punteggio 24 — earliest_availability (+24).`,
    );
    expect(buildRankingExplanation(ranked)).toBe(explanation);
  });
});

function slot(start: string, end = shiftMinutes(start, 30)): RankableSlot {
  return {
    serviceId: 'service_1',
    start,
    end,
    timezone: 'UTC',
  };
}

function shiftMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

function request(overrides: Partial<StructuredBookingRequest>): StructuredBookingRequest {
  return {
    serviceQuery: null,
    datePreference: null,
    timePreference: { dayPart: 'any', startHour: null, endHour: null },
    urgency: 'normal',
    customerName: null,
    customerPhone: null,
    confidence: 0.5,
    signals: [],
    ...overrides,
  };
}

function datePreference(from: string, to: string): BookingDatePreference {
  return {
    from: new Date(from),
    to: new Date(to),
    label: 'domani',
  };
}

function reasonPoints(
  reasons: Array<{ signal: string; points: number }> | undefined,
  signal: string,
): number | undefined {
  return reasons?.find((reason) => reason.signal === signal)?.points;
}

function rotations<T>(items: T[]): T[][] {
  return items.map((_, index) => [...items.slice(index), ...items.slice(0, index)]);
}

/**
 * Guardia strutturale: ranker e ledger sono un livello di sola lettura sopra il
 * flusso esistente. Se un giorno uno dei due imparasse a scrivere appuntamenti
 * o a toccare il calendario, esisterebbero due percorsi di scrittura da tenere
 * in sincrono — esattamente ciò che questa estensione non deve introdurre.
 */
describe('nessun percorso di scrittura su calendario o appuntamenti', () => {
  const sources = [
    'src/server/appointments/slot-ranking.ts',
    'src/server/appointments/decision-ledger.ts',
  ];

  it.each(sources)('%s does not reach into appointment or calendar writes', (path) => {
    const source = readFileSync(path, 'utf8');

    for (const forbidden of [
      'createAppointment',
      'rescheduleAppointment',
      'cancelAppointment',
      'GoogleCalendar',
      '@/server/calendar',
      "from('appointments')",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('slot-ranking stays pure: no Date.now, no I/O', () => {
    const source = readFileSync('src/server/appointments/slot-ranking.ts', 'utf8');

    expect(source).not.toContain('Date.now(');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('supabase');
  });
});
