import { describe, expect, it } from 'vitest';

import fixtures from '@/../tests/fixtures/ai/intent-evals.json';
import { RuleBasedIntentClassifier } from '@/server/ai/intent-router';

describe('intent eval fixtures', () => {
  it('keeps the deterministic fallback aligned with core receptionist cases', async () => {
    const classifier = new RuleBasedIntentClassifier();

    for (const fixture of fixtures) {
      const classification = await classifier.classify({
        text: fixture.text,
        locale: 'it-IT',
      });

      expect(classification.intent, fixture.text).toBe(fixture.expectedIntent);
    }
  });
});
