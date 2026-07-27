import { describe, expect, it } from 'vitest';

import fixtures from '@/../tests/fixtures/ai/booking-extraction-evals.json';
import {
  RuleBasedBookingRequestExtractor,
  filterSlotsByBookingRequest,
  type StructuredBookingRequest,
} from '@/server/ai/booking-extractor';
import type { BookingSlot } from '@/server/appointments/booking';

// Lunedi 27 aprile 2026. Tutte le attese temporali sono ancorate a questo istante.
const now = new Date('2026-04-27T07:00:00.000Z');

const extractor = new RuleBasedBookingRequestExtractor();

function extract(text: string, timezone = 'UTC') {
  return extractor.extract({ text, now, timezone });
}

describe('RuleBasedBookingRequestExtractor', () => {
  it('extracts service, relative date and afternoon preference', async () => {
    const result = await extract('Vorrei prenotare una igiene domani pomeriggio');

    expect(result).toMatchObject({
      serviceQuery: 'igiene',
      urgency: 'normal',
      timePreference: {
        dayPart: 'afternoon',
        startHour: 13,
        endHour: 18,
      },
    });
    expect(result.datePreference?.label).toBe('domani');
    expect(result.datePreference?.from.toISOString()).toBe('2026-04-28T13:00:00.000Z');
    expect(result.datePreference?.to.toISOString()).toBe('2026-04-28T18:00:00.000Z');
    expect(result.signals).toEqual(
      expect.arrayContaining(['service_keyword', 'date_tomorrow', 'time_afternoon']),
    );
  });

  it('extracts weekday and after-hour preference', async () => {
    const result = await extract('Hai posto giovedi dopo le 18 per prima visita?');

    expect(result.serviceQuery).toBe('prima visita');
    expect(result.datePreference?.label).toBe('giovedi');
    expect(result.datePreference?.from.toISOString()).toBe('2026-04-30T18:00:00.000Z');
    expect(result.timePreference).toMatchObject({
      dayPart: 'after_hour',
      startHour: 18,
    });
  });

  it('extracts customer name and phone when present', async () => {
    const result = await extract('Sono Mario Rossi, vorrei una visita. Il numero e 333 111 2233');

    expect(result).toMatchObject({
      customerName: 'Mario Rossi',
      customerPhone: '3331112233',
      serviceQuery: 'visita',
    });
  });

  it('extracts appointment lookup hints from natural wording', async () => {
    const byHour = await extract('Vorrei annullare quello delle 15');
    const byName = await extract('Sposta la visita di Mario');
    const byDate = await extract('Sposta quello di domani');
    const sourceAndTarget = await extract('Sposta la visita di Mario a venerdi mattina');

    expect(byHour.timePreference).toMatchObject({
      dayPart: 'exact_hour',
      startHour: 15,
    });
    expect(byName.customerName).toBe('Mario');
    expect(byDate.customerName).toBeNull();
    expect(byDate.datePreference?.label).toBe('domani');
    expect(sourceAndTarget.customerName).toBe('Mario');
    expect(sourceAndTarget.datePreference?.label).toBe('venerdi');
    expect(sourceAndTarget.timePreference).toMatchObject({
      dayPart: 'morning',
      startHour: 8,
      endHour: 13,
    });
  });
});

describe('italian 12-hour wording', () => {
  it('reads the day-part marker before the hour instead of taking it literally', async () => {
    const afternoon = await extract('Vorrei un controllo alle 3 del pomeriggio');
    const evening = await extract('Domani alle 11 di sera');
    const morning = await extract('Alle 8 di mattina');

    expect(afternoon.timePreference).toMatchObject({
      dayPart: 'exact_hour',
      startHour: 15,
      endHour: 16,
    });
    expect(afternoon.signals).toEqual(expect.arrayContaining(['time_daypart_afternoon']));
    expect(evening.timePreference).toMatchObject({ startHour: 23, endHour: 24 });
    expect(evening.datePreference?.to.toISOString()).toBe('2026-04-29T00:00:00.000Z');
    expect(morning.timePreference).toMatchObject({ startHour: 8, endHour: 9 });
  });

  it('reads a bare early hour as afternoon, because nobody books at 4am', async () => {
    const bare = await extract('Dopodomani verso le 4');
    const explicitMorning = await extract('Dopodomani verso le 4 di mattina');

    expect(bare.timePreference.startHour).toBe(16);
    expect(bare.datePreference?.from.toISOString()).toBe('2026-04-29T16:00:00.000Z');
    expect(explicitMorning.timePreference.startHour).toBe(4);
  });

  it('keeps hours from 7 onwards literal', async () => {
    await expect(extract('Venerdi alle 9')).resolves.toMatchObject({
      timePreference: { startHour: 9, endHour: 10 },
    });
    await expect(extract('Venerdi alle 19')).resolves.toMatchObject({
      timePreference: { startHour: 19, endHour: 20 },
    });
  });

  it('treats mezzogiorno and mezzanotte as absolute hours', async () => {
    await expect(extract('Posso passare a mezzogiorno?')).resolves.toMatchObject({
      timePreference: { dayPart: 'exact_hour', startHour: 12, endHour: 13 },
    });
    await expect(extract('Stasera a mezzanotte')).resolves.toMatchObject({
      timePreference: { dayPart: 'exact_hour', startHour: 0, endHour: 1 },
    });
  });

  it('still falls back to the day-part range when no hour is given', async () => {
    await expect(extract('Domani pomeriggio')).resolves.toMatchObject({
      timePreference: { dayPart: 'afternoon', startHour: 13, endHour: 18 },
    });
    await expect(extract('Lunedi prossimo di mattina')).resolves.toMatchObject({
      timePreference: { dayPart: 'morning', startHour: 8, endHour: 13 },
    });
    await expect(extract('Venerdi sera')).resolves.toMatchObject({
      timePreference: { dayPart: 'evening', startHour: 18, endHour: 21 },
    });
  });

  it('applies the marker to relative bounds too', async () => {
    await expect(extract('Venerdi dopo le 5 di pomeriggio')).resolves.toMatchObject({
      timePreference: { dayPart: 'after_hour', startHour: 17, endHour: 21 },
    });
    await expect(extract('Vorrei prenotare un controllo entro le 11')).resolves.toMatchObject({
      timePreference: { dayPart: 'before_hour', startHour: 8, endHour: 11 },
    });
  });
});

describe('minutes', () => {
  it('uses the captured minute group instead of dropping it', async () => {
    const colon = await extract('Va bene le 15:30');
    const dot = await extract('Lunedi alle 16.45');

    expect(colon.timePreference).toMatchObject({ startHour: 15.5, endHour: 16.5 });
    expect(dot.timePreference).toMatchObject({ startHour: 16.75, endHour: 17.75 });
    expect(dot.datePreference?.from.toISOString()).toBe('2026-05-04T16:45:00.000Z');
    expect(dot.datePreference?.to.toISOString()).toBe('2026-05-04T17:45:00.000Z');
  });

  it('understands spoken minutes', async () => {
    await expect(extract('Il 3 alle 9 e mezza')).resolves.toMatchObject({
      timePreference: { startHour: 9.5, endHour: 10.5 },
    });
    await expect(extract('Venerdi alle 10 e un quarto')).resolves.toMatchObject({
      timePreference: { startHour: 10.25 },
    });
    await expect(extract('Venerdi alle 10 e tre quarti')).resolves.toMatchObject({
      timePreference: { startHour: 10.75 },
    });
  });

  it('subtracts the quarter in "meno un quarto"', async () => {
    const result = await extract('Domani alle 3 meno un quarto');

    expect(result.timePreference.startHour).toBe(14.75);
    expect(result.datePreference?.from.toISOString()).toBe('2026-04-28T14:45:00.000Z');
  });
});

describe('explicit dates', () => {
  it('resolves dates written with the month in letters', async () => {
    const result = await extract('Buongiorno, avete posto il 15 maggio?');

    expect(result.datePreference?.label).toBe('15 maggio');
    expect(result.datePreference?.from.toISOString()).toBe('2026-05-15T00:00:00.000Z');
    expect(result.datePreference?.to.toISOString()).toBe('2026-05-16T00:00:00.000Z');
    expect(result.signals).toEqual(expect.arrayContaining(['date_explicit_month']));
  });

  it('resolves numeric dates and honours an explicit year', async () => {
    const implicitYear = await extract('Prenotiamo per il 15/05');
    const explicitYear = await extract('Ci vediamo il 15/05/2027');
    const shortYear = await extract('Ci vediamo il 15/05/27');

    expect(implicitYear.datePreference?.from.toISOString()).toBe('2026-05-15T00:00:00.000Z');
    expect(explicitYear.datePreference?.from.toISOString()).toBe('2027-05-15T00:00:00.000Z');
    expect(shortYear.datePreference?.from.toISOString()).toBe('2027-05-15T00:00:00.000Z');
  });

  it('rolls an already passed date to next year', async () => {
    const passed = await extract('Il 3 marzo va bene?');
    const stillAhead = await extract('Il 3 giugno va bene?');

    expect(passed.datePreference?.from.toISOString()).toBe('2027-03-03T00:00:00.000Z');
    expect(stillAhead.datePreference?.from.toISOString()).toBe('2026-06-03T00:00:00.000Z');
  });

  it('combines an explicit date with an explicit hour', async () => {
    const result = await extract('Mi va bene il 2 giugno alle 10:45');

    expect(result.datePreference?.from.toISOString()).toBe('2026-06-02T10:45:00.000Z');
    expect(result.datePreference?.to.toISOString()).toBe('2026-06-02T11:45:00.000Z');
  });

  it('resolves a bare day of the month to the next occurrence', async () => {
    const nextMonth = await extract('Il 3 alle 9 e mezza');
    const thisMonth = await extract('Il 30 alle 9');

    expect(nextMonth.datePreference?.label).toBe('3 maggio');
    expect(nextMonth.datePreference?.from.toISOString()).toBe('2026-05-03T09:30:00.000Z');
    expect(thisMonth.datePreference?.label).toBe('30 aprile');
    expect(thisMonth.datePreference?.from.toISOString()).toBe('2026-04-30T09:00:00.000Z');
  });

  it('reads relative day counts', async () => {
    const days = await extract('Tra tre giorni sarebbe perfetto');
    const week = await extract('Fra una settimana per il controllo');

    expect(days.datePreference?.from.toISOString()).toBe('2026-04-30T00:00:00.000Z');
    expect(week.datePreference?.from.toISOString()).toBe('2026-05-04T00:00:00.000Z');
  });

  it('prefers dopodomani over domani when both spellings appear', async () => {
    const joined = await extract('Dopodomani mattina');
    const spaced = await extract('Dopo domani mattina');

    expect(joined.datePreference?.from.toISOString()).toBe('2026-04-29T08:00:00.000Z');
    expect(spaced.datePreference?.from.toISOString()).toBe('2026-04-29T08:00:00.000Z');
  });
});

describe('refuses to invent a date', () => {
  it('returns no date preference for messages that contain none', async () => {
    const texts = [
      'Buongiorno, siete aperti?',
      'Quanto costa una pulizia dei denti?',
      'Vorrei sapere i prezzi',
      'Grazie mille!',
      'Il trattamento costa 15/20 euro?',
      'Avete il numero 3331112233?',
      'Ho 3 figli, fate sconti?',
    ];

    for (const text of texts) {
      const result = await extract(text);

      expect(result.datePreference, text).toBeNull();
    }
  });

  it('does not guess a day when the written date does not exist', async () => {
    const noHour = await extract('Appuntamento il 29 febbraio');
    const withHour = await extract('Il 31 febbraio alle 10');

    expect(noHour.datePreference).toBeNull();
    expect(noHour.signals).toEqual(expect.arrayContaining(['date_invalid']));
    expect(withHour.datePreference).toBeNull();
    expect(withHour.timePreference).toMatchObject({ dayPart: 'exact_hour', startHour: 10 });
  });

  it('does not turn an article into a customer name', async () => {
    const result = await extract('Prenotiamo per il 15 maggio');

    expect(result.customerName).toBeNull();
    expect(result.serviceQuery).toBeNull();
  });
});

describe('tenant timezone', () => {
  it('resolves the local day and hour in the tenant timezone, not the server one', async () => {
    const instant = new Date('2026-07-14T22:30:00.000Z');

    const rome = await extractor.extract({
      text: 'domani alle 10',
      now: instant,
      timezone: 'Europe/Rome',
    });
    const auckland = await extractor.extract({
      text: 'domani alle 10',
      now: instant,
      timezone: 'Pacific/Auckland',
    });

    // A Roma sono gia' le 00:30 del 15, ad Auckland le 10:30 del 15:
    // "domani" e' il 16 a Roma e il 16 ad Auckland, ma su istanti UTC diversi.
    expect(rome.datePreference?.from.toISOString()).toBe('2026-07-16T08:00:00.000Z');
    expect(auckland.datePreference?.from.toISOString()).toBe('2026-07-15T22:00:00.000Z');
  });

  it('falls back to Europe/Rome when the tenant timezone is missing', async () => {
    const result = await extractor.extract({
      text: 'domani alle 10',
      now: new Date('2026-07-14T22:30:00.000Z'),
    });

    expect(result.datePreference?.from.toISOString()).toBe('2026-07-16T08:00:00.000Z');
  });

  it('accounts for the tenant DST offset', async () => {
    const beforeSwitch = await extractor.extract({
      text: 'domani alle 10',
      now: new Date('2026-03-27T09:00:00.000Z'),
      timezone: 'Europe/Rome',
    });
    const afterSwitch = await extractor.extract({
      text: 'domani alle 10',
      now: new Date('2026-03-28T09:00:00.000Z'),
      timezone: 'Europe/Rome',
    });

    expect(beforeSwitch.datePreference?.from.toISOString()).toBe('2026-03-28T09:00:00.000Z');
    expect(afterSwitch.datePreference?.from.toISOString()).toBe('2026-03-29T08:00:00.000Z');
  });

  it('resolves "oggi" on the tenant calendar day across the year boundary', async () => {
    const result = await extractor.extract({
      text: 'oggi alle 18',
      now: new Date('2026-12-31T20:00:00.000Z'),
      timezone: 'Pacific/Auckland',
    });

    expect(result.datePreference?.from.toISOString()).toBe('2027-01-01T05:00:00.000Z');
  });
});

describe('booking extraction eval fixtures', () => {
  it('resolves the exact booking window for every fixture', async () => {
    for (const fixture of fixtures) {
      const result = await extract(fixture.text);

      expect(result.datePreference?.from.toISOString() ?? null, fixture.text).toBe(
        fixture.expected.from,
      );
      expect(result.datePreference?.to.toISOString() ?? null, fixture.text).toBe(
        fixture.expected.to,
      );
    }
  });

  it('keeps negative cases in the eval set', async () => {
    const withoutDate = fixtures.filter((fixture) => fixture.expected.dateLabel === null);

    expect(withoutDate.length).toBeGreaterThanOrEqual(6);
  });
});

describe('filterSlotsByBookingRequest', () => {
  it('keeps only slots matching extracted afternoon preference', () => {
    const request = requestWithTimePreference({
      dayPart: 'afternoon',
      startHour: 13,
      endHour: 18,
    });

    expect(
      filterSlotsByBookingRequest(
        [
          slot('2026-04-28T09:00:00.000Z'),
          slot('2026-04-28T14:00:00.000Z'),
          slot('2026-04-28T18:00:00.000Z'),
        ],
        request,
      ).map((item) => item.start),
    ).toEqual(['2026-04-28T14:00:00.000Z']);
  });

  it('respects fractional bounds coming from minutes', () => {
    const request = requestWithTimePreference({
      dayPart: 'exact_hour',
      startHour: 15.5,
      endHour: 16.5,
    });

    expect(
      filterSlotsByBookingRequest(
        [
          slot('2026-04-28T15:15:00.000Z'),
          slot('2026-04-28T15:30:00.000Z'),
          slot('2026-04-28T16:15:00.000Z'),
          slot('2026-04-28T16:30:00.000Z'),
        ],
        request,
      ).map((item) => item.start),
    ).toEqual(['2026-04-28T15:30:00.000Z', '2026-04-28T16:15:00.000Z']);
  });

  it('compares the slot local hour in the slot timezone', () => {
    const request = requestWithTimePreference({
      dayPart: 'exact_hour',
      startHour: 15.5,
      endHour: 16.5,
    });
    const instant = '2026-04-28T13:30:00.000Z';

    expect(
      filterSlotsByBookingRequest([slot(instant, 'Europe/Rome')], request).map(
        (item) => item.start,
      ),
    ).toEqual([instant]);
    expect(filterSlotsByBookingRequest([slot(instant, 'UTC')], request)).toEqual([]);
  });

  it('keeps every slot when no time preference was understood', () => {
    const request = requestWithTimePreference({
      dayPart: 'any',
      startHour: null,
      endHour: null,
    });
    const slots = [slot('2026-04-28T05:00:00.000Z'), slot('2026-04-28T22:00:00.000Z')];

    expect(filterSlotsByBookingRequest(slots, request)).toEqual(slots);
  });
});

function requestWithTimePreference(
  timePreference: StructuredBookingRequest['timePreference'],
): StructuredBookingRequest {
  return {
    serviceQuery: 'visita',
    datePreference: null,
    timePreference,
    urgency: 'normal',
    customerName: null,
    customerPhone: null,
    confidence: 0.8,
    signals: [],
  };
}

function slot(start: string, timezone = 'UTC'): BookingSlot {
  return {
    tenantId: 'tenant_1',
    serviceId: 'service_1',
    serviceName: 'Prima visita',
    start,
    end: new Date(new Date(start).getTime() + 30 * 60_000).toISOString(),
    durationMinutes: 30,
    timezone,
  };
}
