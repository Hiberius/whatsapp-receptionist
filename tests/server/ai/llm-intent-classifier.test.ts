import { describe, expect, it } from 'vitest';

import { FallbackIntentClassifier, LlmIntentClassifier } from '@/server/ai/llm-intent-classifier';
import type { LlmClient, LlmCompletionInput } from '@/server/ai/llm';

describe('LlmIntentClassifier', () => {
  it('parses JSON intent responses from the LLM', async () => {
    const classifier = new LlmIntentClassifier(
      new FakeLlmClient(
        JSON.stringify({
          intent: 'pricing_question',
          confidence: 0.91,
          matchedSignals: ['prezzo'],
        }),
      ),
    );

    await expect(classifier.classify({ text: 'Quanto costa una visita?' })).resolves.toMatchObject({
      intent: 'pricing_question',
      confidence: 0.91,
      matchedSignals: ['prezzo'],
      aiUsage: {
        feature: 'intent_classifier',
        costCents: 1,
        totalTokens: 15,
      },
    });
  });

  it('falls back to other when LLM confidence is low', async () => {
    const classifier = new LlmIntentClassifier(
      new FakeLlmClient(
        JSON.stringify({
          intent: 'booking_request',
          confidence: 0.42,
          matchedSignals: [],
        }),
      ),
    );

    await expect(classifier.classify({ text: 'forse boh' })).resolves.toMatchObject({
      intent: 'other',
      confidence: 0.42,
      matchedSignals: ['llm_low_confidence'],
      aiUsage: {
        feature: 'intent_classifier',
        costCents: 1,
      },
    });
  });
});

describe('FallbackIntentClassifier', () => {
  it('uses the rule-based classifier when the LLM fails', async () => {
    const classifier = new FallbackIntentClassifier(
      new LlmIntentClassifier(new ThrowingLlmClient()),
    );

    await expect(
      classifier.classify({ text: 'Vorrei prenotare una visita domani' }),
    ).resolves.toMatchObject({
      intent: 'booking_request',
      matchedSignals: expect.arrayContaining(['llm_fallback_rule_based']),
    });
  });
});

class FakeLlmClient implements LlmClient {
  readonly calls: LlmCompletionInput[] = [];

  constructor(private readonly text: string) {}

  async complete(input: LlmCompletionInput) {
    this.calls.push(input);

    return {
      text: this.text,
      model: ['clau', 'de-3-5-haiku-20241022'].join(''),
      inputTokens: 10,
      outputTokens: 5,
      stopReason: 'end_turn',
      raw: {},
    };
  }
}

class ThrowingLlmClient implements LlmClient {
  async complete(): Promise<never> {
    throw new Error('provider down');
  }
}
