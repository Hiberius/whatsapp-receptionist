// Logica della schermata "Orari di apertura": righe editabili, validazione,
// body del PUT. Sono i dati con cui il booking calcola la disponibilità: un
// filtro che salta qui produce appuntamenti fuori orario.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BUSINESS_HOURS_ENDPOINT,
  buildBusinessHoursPayload,
  countHiddenRanges,
  saveBusinessHours,
  toDayDrafts,
  validateDayDrafts,
  weekdayLabel,
  type BusinessHourView,
  type DayDraft,
} from '@/components/settings/business-hours-model';

function hour(overrides: Partial<BusinessHourView> & { weekday: number }): BusinessHourView {
  return {
    id: `hour-${overrides.weekday}-${overrides.opensAt ?? '09:00'}`,
    opensAt: '09:00',
    closesAt: '18:00',
    active: true,
    ...overrides,
  };
}

function draft(overrides: Partial<DayDraft> & { weekday: number }): DayDraft {
  return {
    open: true,
    opensAt: '09:00',
    closesAt: '18:00',
    ...overrides,
  };
}

describe('toDayDrafts', () => {
  it('returns the seven weekdays starting from Monday', () => {
    const drafts = toDayDrafts([]);

    expect(drafts.map((item) => item.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayLabel(drafts[0]?.weekday ?? -1)).toBe('Lunedì');
    expect(weekdayLabel(drafts[6]?.weekday ?? -1)).toBe('Domenica');
  });

  it('marks days without saved hours as closed and leaves the times empty', () => {
    const drafts = toDayDrafts([hour({ weekday: 1 })]);

    const sunday = drafts.find((item) => item.weekday === 0);
    expect(sunday).toEqual({ weekday: 0, open: false, opensAt: '', closesAt: '' });
  });

  it('prefers the active range when a weekday also has an inactive one', () => {
    const drafts = toDayDrafts([
      hour({ weekday: 2, opensAt: '08:00', closesAt: '12:00', active: false }),
      hour({ weekday: 2, opensAt: '14:00', closesAt: '19:00', active: true }),
    ]);

    expect(drafts.find((item) => item.weekday === 2)).toEqual({
      weekday: 2,
      open: true,
      opensAt: '14:00',
      closesAt: '19:00',
    });
  });

  it('keeps the stored times of a fully inactive weekday instead of blanking them', () => {
    const drafts = toDayDrafts([
      hour({ weekday: 3, opensAt: '10:00', closesAt: '16:00', active: false }),
    ]);

    expect(drafts.find((item) => item.weekday === 3)).toEqual({
      weekday: 3,
      open: false,
      opensAt: '10:00',
      closesAt: '16:00',
    });
  });
});

describe('countHiddenRanges', () => {
  it('reports zero when every weekday has at most one range', () => {
    expect(countHiddenRanges([hour({ weekday: 1 }), hour({ weekday: 2 })])).toBe(0);
  });

  it('counts the ranges beyond the first of each weekday', () => {
    const hidden = countHiddenRanges([
      hour({ weekday: 1, opensAt: '09:00', closesAt: '13:00' }),
      hour({ weekday: 1, opensAt: '15:00', closesAt: '19:00' }),
      hour({ weekday: 2, opensAt: '09:00', closesAt: '12:00' }),
      hour({ weekday: 2, opensAt: '13:00', closesAt: '17:00' }),
      hour({ weekday: 2, opensAt: '18:00', closesAt: '20:00' }),
    ]);

    expect(hidden).toBe(3);
  });
});

describe('validateDayDrafts', () => {
  it('accepts closed days with empty times', () => {
    expect(
      validateDayDrafts([draft({ weekday: 0, open: false, opensAt: '', closesAt: '' })]),
    ).toEqual([]);
  });

  it('rejects an open day without times', () => {
    const issues = validateDayDrafts([draft({ weekday: 1, opensAt: '', closesAt: '' })]);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.weekday).toBe(1);
    expect(issues[0]?.message).toContain('Lunedì');
  });

  it('rejects a closing time that is not after the opening time', () => {
    const issues = validateDayDrafts([
      draft({ weekday: 5, opensAt: '18:00', closesAt: '09:00' }),
      draft({ weekday: 6, opensAt: '10:00', closesAt: '10:00' }),
    ]);

    expect(issues.map((issue) => issue.weekday)).toEqual([5, 6]);
  });

  it('accepts a valid open day', () => {
    expect(validateDayDrafts([draft({ weekday: 4, opensAt: '09:30', closesAt: '19:45' })])).toEqual(
      [],
    );
  });
});

describe('buildBusinessHoursPayload', () => {
  it('omits closed days instead of sending invented times for them', () => {
    const payload = buildBusinessHoursPayload([
      draft({ weekday: 1 }),
      draft({ weekday: 2, open: false, opensAt: '', closesAt: '' }),
      draft({ weekday: 0, open: false, opensAt: '10:00', closesAt: '13:00' }),
    ]);

    expect(payload.hours).toEqual([
      { weekday: 1, opensAt: '09:00', closesAt: '18:00', active: true },
    ]);
  });

  it('sorts the sent ranges by weekday', () => {
    const payload = buildBusinessHoursPayload([
      draft({ weekday: 5 }),
      draft({ weekday: 1 }),
      draft({ weekday: 0 }),
    ]);

    expect(payload.hours.map((item) => item.weekday)).toEqual([0, 1, 5]);
  });
});

describe('saveBusinessHours', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('PUTs only the open days to the business hours endpoint', async () => {
    mockJsonResponse({
      ok: true,
      data: [
        { id: 'a', weekday: 1, opensAt: '09:00', closesAt: '18:00', active: true },
        { id: 'b', weekday: 3, opensAt: '09:00', closesAt: '18:00', active: true },
      ],
    });

    const result = await saveBusinessHours({
      drafts: [
        draft({ weekday: 1 }),
        draft({ weekday: 2, open: false, opensAt: '', closesAt: '' }),
        draft({ weekday: 3 }),
      ],
    });

    const fetchSpy = vi.mocked(global.fetch);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(BUSINESS_HOURS_ENDPOINT);

    const init = fetchSpy.mock.calls[0]?.[1];
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      hours: [
        { weekday: 1, opensAt: '09:00', closesAt: '18:00', active: true },
        { weekday: 3, opensAt: '09:00', closesAt: '18:00', active: true },
      ],
    });

    expect(result).toEqual({
      ok: true,
      data: [
        { id: 'a', weekday: 1, opensAt: '09:00', closesAt: '18:00', active: true },
        { id: 'b', weekday: 3, opensAt: '09:00', closesAt: '18:00', active: true },
      ],
    });
  });

  it('translates the API error code into a message for the user', async () => {
    mockJsonResponse(
      { ok: false, error: { code: 'bad_request', message: 'Business hours cannot overlap' } },
      { status: 400 },
    );

    const result = await saveBusinessHours({ drafts: [draft({ weekday: 1 })] });

    expect(result).toEqual({
      ok: false,
      message: 'Alcuni dati non sono validi. Controlla i campi e riprova.',
    });
  });

  it('reports a network failure without throwing', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('connect refused'));

    const result = await saveBusinessHours({ drafts: [draft({ weekday: 1 })] });

    expect(result).toEqual({
      ok: false,
      message: 'Connessione non riuscita. Controlla la rete e riprova.',
    });
  });
});

function mockJsonResponse(payload: unknown, init: { status?: number } = {}): void {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
      status: init.status ?? 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}
