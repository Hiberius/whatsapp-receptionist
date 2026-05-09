import { describe, expect, it } from 'vitest';

import {
  RuleBasedBookingRequestExtractor,
  filterSlotsByBookingRequest,
  type StructuredBookingRequest,
} from '@/server/ai/booking-extractor';
import type { BookingSlot } from '@/server/appointments/booking';

const now = new Date('2026-04-27T07:00:00.000Z');

describe('RuleBasedBookingRequestExtractor', () => {
  it('extracts service, relative date and afternoon preference', async () => {
    const extractor = new RuleBasedBookingRequestExtractor();

    const result = await extractor.extract({
      text: 'Vorrei prenotare una igiene domani pomeriggio',
      now,
      timezone: 'UTC',
    });

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
    const extractor = new RuleBasedBookingRequestExtractor();

    const result = await extractor.extract({
      text: 'Hai posto giovedi dopo le 18 per prima visita?',
      now,
      timezone: 'UTC',
    });

    expect(result.serviceQuery).toBe('prima visita');
    expect(result.datePreference?.label).toBe('giovedi');
    expect(result.datePreference?.from.toISOString()).toBe('2026-04-30T18:00:00.000Z');
    expect(result.timePreference).toMatchObject({
      dayPart: 'after_hour',
      startHour: 18,
    });
  });

  it('extracts customer name and phone when present', async () => {
    const extractor = new RuleBasedBookingRequestExtractor();

    const result = await extractor.extract({
      text: 'Sono Mario Rossi, vorrei una visita. Il numero e 333 111 2233',
      now,
      timezone: 'UTC',
    });

    expect(result).toMatchObject({
      customerName: 'Mario Rossi',
      customerPhone: '3331112233',
      serviceQuery: 'visita',
    });
  });

  it('extracts appointment lookup hints from natural wording', async () => {
    const extractor = new RuleBasedBookingRequestExtractor();

    const byHour = await extractor.extract({
      text: 'Vorrei annullare quello delle 15',
      now,
      timezone: 'UTC',
    });
    const byName = await extractor.extract({
      text: 'Sposta la visita di Mario',
      now,
      timezone: 'UTC',
    });
    const byDate = await extractor.extract({
      text: 'Sposta quello di domani',
      now,
      timezone: 'UTC',
    });
    const sourceAndTarget = await extractor.extract({
      text: 'Sposta la visita di Mario a venerdi mattina',
      now,
      timezone: 'UTC',
    });

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

describe('filterSlotsByBookingRequest', () => {
  it('keeps only slots matching extracted afternoon preference', () => {
    const request: StructuredBookingRequest = {
      serviceQuery: 'visita',
      datePreference: null,
      timePreference: {
        dayPart: 'afternoon',
        startHour: 13,
        endHour: 18,
      },
      urgency: 'normal',
      customerName: null,
      customerPhone: null,
      confidence: 0.8,
      signals: ['time_afternoon'],
    };

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
});

function slot(start: string): BookingSlot {
  return {
    tenantId: 'tenant_1',
    serviceId: 'service_1',
    serviceName: 'Prima visita',
    start,
    end: new Date(new Date(start).getTime() + 30 * 60_000).toISOString(),
    durationMinutes: 30,
    timezone: 'UTC',
  };
}
