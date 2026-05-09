import { describe, expect, it } from 'vitest';

import fixtures from '@/../tests/fixtures/ai/booking-extraction-evals.json';
import { RuleBasedBookingRequestExtractor } from '@/server/ai/booking-extractor';

const now = new Date('2026-04-27T07:00:00.000Z');

describe('booking extraction eval fixtures', () => {
  it('keeps the deterministic extractor aligned with core booking phrases', async () => {
    const extractor = new RuleBasedBookingRequestExtractor();

    for (const fixture of fixtures) {
      const result = await extractor.extract({
        text: fixture.text,
        now,
        timezone: 'UTC',
      });

      expect(result.serviceQuery, fixture.text).toBe(fixture.expected.serviceQuery);
      expect(result.datePreference?.label ?? null, fixture.text).toBe(fixture.expected.dateLabel);
      expect(result.timePreference.dayPart, fixture.text).toBe(fixture.expected.dayPart);
      expect(result.customerName, fixture.text).toBe(fixture.expected.customerName);

      if ('startHour' in fixture.expected) {
        expect(result.timePreference.startHour, fixture.text).toBe(fixture.expected.startHour);
      }

      if ('endHour' in fixture.expected) {
        expect(result.timePreference.endHour, fixture.text).toBe(fixture.expected.endHour);
      }
    }
  });
});
