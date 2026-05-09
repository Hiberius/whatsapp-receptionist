import type { LlmCompletionResult } from '@/server/ai/llm';

export type AiUsageFeature = 'intent_classifier' | 'domain_reply';

export type AiUsageMetadata = {
  provider: 'anthropic';
  feature: AiUsageFeature;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costCents: number;
  estimated: boolean;
  pricingSource: 'model_family_estimate' | 'unknown_model';
  stopReason: string | null;
};

type ModelPricing = {
  inputCentsPerMillionTokens: number;
  outputCentsPerMillionTokens: number;
};

export function usageFromLlmResult(
  result: LlmCompletionResult,
  feature: AiUsageFeature,
): AiUsageMetadata {
  const pricing = pricingForModel(result.model);
  const costCents = pricing
    ? estimateAiCostCents({
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        pricing,
      })
    : 0;
  const totalTokens =
    result.inputTokens === null && result.outputTokens === null
      ? null
      : (result.inputTokens ?? 0) + (result.outputTokens ?? 0);

  return {
    provider: 'anthropic',
    feature,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens,
    costCents,
    estimated: true,
    pricingSource: pricing ? 'model_family_estimate' : 'unknown_model',
    stopReason: result.stopReason,
  };
}

export function estimateAiCostCents(input: {
  inputTokens: number | null;
  outputTokens: number | null;
  pricing: ModelPricing;
}): number {
  const inputTokens = safeTokenCount(input.inputTokens);
  const outputTokens = safeTokenCount(input.outputTokens);

  if (inputTokens + outputTokens === 0) {
    return 0;
  }

  const rawCents =
    (inputTokens / 1_000_000) * input.pricing.inputCentsPerMillionTokens +
    (outputTokens / 1_000_000) * input.pricing.outputCentsPerMillionTokens;

  return Math.max(1, Math.ceil(rawCents));
}

export function sumAiUsageCostCents(usages: Array<AiUsageMetadata | null | undefined>): number {
  return usages.reduce((total, usage) => total + (usage?.costCents ?? 0), 0);
}

export function sumAiUsageTokens(usages: Array<AiUsageMetadata | null | undefined>): number | null {
  let hasKnownUsage = false;
  const total = usages.reduce((sum, usage) => {
    if (!usage || usage.totalTokens === null) {
      return sum;
    }

    hasKnownUsage = true;
    return sum + usage.totalTokens;
  }, 0);

  return hasKnownUsage ? total : null;
}

function pricingForModel(model: string): ModelPricing | null {
  const normalized = model.toLowerCase();

  if (normalized.includes('opus')) {
    return {
      inputCentsPerMillionTokens: 1_500,
      outputCentsPerMillionTokens: 7_500,
    };
  }

  if (normalized.includes('sonnet')) {
    return {
      inputCentsPerMillionTokens: 300,
      outputCentsPerMillionTokens: 1_500,
    };
  }

  if (normalized.includes('haiku')) {
    return {
      inputCentsPerMillionTokens: 80,
      outputCentsPerMillionTokens: 400,
    };
  }

  return null;
}

function safeTokenCount(value: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
