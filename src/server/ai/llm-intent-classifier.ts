import { z } from 'zod';

import {
  intentCategories,
  RuleBasedIntentClassifier,
  type IntentClassification,
  type IntentClassificationInput,
  type IntentClassifier,
} from '@/server/ai/intent-router';
import { extractJsonObject, type LlmClient } from '@/server/ai/llm';
import { usageFromLlmResult } from '@/server/ai/costs';

const llmIntentSchema = z.object({
  intent: z.enum(intentCategories),
  confidence: z.number().min(0).max(1),
  matchedSignals: z.array(z.string()).default([]),
});

export class LlmIntentClassifier implements IntentClassifier {
  constructor(private readonly llm: LlmClient) {}

  async classify(input: IntentClassificationInput): Promise<IntentClassification> {
    const result = await this.llm.complete({
      system: intentClassificationSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            text: input.text,
            locale: input.locale ?? 'it-IT',
          }),
        },
      ],
      maxTokens: 220,
      temperature: 0,
      metadata: {
        feature: 'intent_classifier',
      },
    });
    const parsed = llmIntentSchema.parse(extractJsonObject(result.text));

    if (parsed.confidence < 0.6) {
      return {
        intent: 'other',
        confidence: parsed.confidence,
        matchedSignals: ['llm_low_confidence'],
        aiUsage: usageFromLlmResult(result, 'intent_classifier'),
      };
    }

    return {
      ...parsed,
      aiUsage: usageFromLlmResult(result, 'intent_classifier'),
    };
  }
}

export class FallbackIntentClassifier implements IntentClassifier {
  constructor(
    private readonly primary: IntentClassifier,
    private readonly fallback: IntentClassifier = new RuleBasedIntentClassifier(),
  ) {}

  async classify(input: IntentClassificationInput): Promise<IntentClassification> {
    try {
      return await this.primary.classify(input);
    } catch {
      const classification = await this.fallback.classify(input);

      return {
        ...classification,
        matchedSignals: [...classification.matchedSignals, 'llm_fallback_rule_based'],
      };
    }
  }
}

function intentClassificationSystemPrompt(): string {
  return [
    'Sei il classificatore di intent di Ambrogio.ai per studi professionali italiani.',
    'Rispondi solo con JSON valido.',
    `Intent ammessi: ${intentCategories.join(', ')}.`,
    'booking_request: prenotare/fissare una visita o appuntamento.',
    'reschedule_request: spostare/cambiare appuntamento.',
    'cancellation_request: annullare/disdire appuntamento.',
    'pricing_question: prezzi, costi, tariffe, listino.',
    'opening_hours_question: orari, apertura, chiusura, indirizzo operativo.',
    'human_handoff: richiesta esplicita di persona, emergenza, reclamo grave o caso delicato.',
    'other: saluti, messaggi ambigui, spam o non classificabili.',
    'Schema: {"intent":"booking_request","confidence":0.88,"matchedSignals":["prenotare"]}',
    'Se non sei sicuro, usa confidence sotto 0.6.',
  ].join('\n');
}
