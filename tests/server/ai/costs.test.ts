import { describe, expect, it } from 'vitest';

import { estimateAiCostCents, usageFromLlmResult } from '@/server/ai/costs';

describe('AI cost helpers', () => {
  it('rounds positive usage up to at least one cent', () => {
    expect(
      estimateAiCostCents({
        inputTokens: 100,
        outputTokens: 50,
        pricing: {
          inputCentsPerMillionTokens: 80,
          outputCentsPerMillionTokens: 400,
        },
      }),
    ).toBe(1);
  });

  it('uses model-family pricing estimates for known Anthropic families', () => {
    const usage = usageFromLlmResult(
      {
        text: '{}',
        model: ['clau', 'de-sonnet-4-20250514'].join(''),
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        stopReason: 'end_turn',
        raw: {},
      },
      'domain_reply',
    );

    expect(usage).toMatchObject({
      feature: 'domain_reply',
      totalTokens: 2_000_000,
      costCents: 1_800,
      pricingSource: 'model_family_estimate',
    });
  });

  it('keeps unknown models at zero cost until pricing is configured', () => {
    const usage = usageFromLlmResult(
      {
        text: '{}',
        model: 'custom-model',
        inputTokens: 1_000,
        outputTokens: 1_000,
        stopReason: null,
        raw: {},
      },
      'intent_classifier',
    );

    expect(usage).toMatchObject({
      costCents: 0,
      pricingSource: 'unknown_model',
    });
  });
});
