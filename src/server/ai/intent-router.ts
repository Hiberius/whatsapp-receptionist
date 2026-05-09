export const intentCategories = [
  'booking_request',
  'reschedule_request',
  'cancellation_request',
  'pricing_question',
  'opening_hours_question',
  'human_handoff',
  'other',
] as const;

export type IntentCategory = (typeof intentCategories)[number];

export type IntentClassificationInput = {
  text: string;
  locale?: string;
};

export type IntentClassification = {
  intent: IntentCategory;
  confidence: number;
  matchedSignals: string[];
  aiUsage?: {
    provider: 'anthropic';
    feature: 'intent_classifier' | 'domain_reply';
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    costCents: number;
    estimated: boolean;
    pricingSource: 'model_family_estimate' | 'unknown_model';
    stopReason: string | null;
  };
};

export interface IntentClassifier {
  classify(input: IntentClassificationInput): Promise<IntentClassification>;
}

type IntentRule = {
  intent: IntentCategory;
  signals: RegExp[];
  confidence: number;
  minMatches?: number;
};

const intentRules: IntentRule[] = [
  {
    intent: 'reschedule_request',
    confidence: 0.89,
    minMatches: 2,
    signals: [
      /\b(spostare|sposto|cambiare|cambio|modificare|rimandare|anticipare)\b/,
      /\b(appuntamento|prenotazione|visita)\b/,
    ],
  },
  {
    intent: 'cancellation_request',
    confidence: 0.9,
    minMatches: 2,
    signals: [
      /\b(cancellare|annullare|annulla|disdire|cancello|annullo|disdico)\b/,
      /\b(appuntamento|prenotazione|visita)\b/,
    ],
  },
  {
    intent: 'pricing_question',
    confidence: 0.82,
    signals: [/\b(prezzo|costo|costa|tariffa|listino|quanto viene)\b/],
  },
  {
    intent: 'opening_hours_question',
    confidence: 0.82,
    signals: [/\b(orari|aperti|aperto|chiusi|chiuso|quando aprite)\b/],
  },
  {
    intent: 'human_handoff',
    confidence: 0.86,
    signals: [/\b(operatore|persona|umano|segreteria|assistente reale|richiamatemi)\b/],
  },
  {
    intent: 'booking_request',
    confidence: 0.88,
    signals: [
      /\b(prenotare|prenoto|fissare|appuntamento|visita|disponibilita|posto)\b/,
      /\b(domani|oggi|settimana|orario|data|quando|slot)\b/,
    ],
  },
];

export class RuleBasedIntentClassifier implements IntentClassifier {
  async classify(input: IntentClassificationInput): Promise<IntentClassification> {
    const text = normalizeForMatching(input.text);

    if (!text) {
      return {
        intent: 'other',
        confidence: 0.2,
        matchedSignals: [],
      };
    }

    for (const rule of intentRules) {
      const matchedSignals = rule.signals
        .filter((signal) => signal.test(text))
        .map((signal) => signal.source);

      if (matchedSignals.length >= (rule.minMatches ?? 1)) {
        const bonus = Math.min(0.08, matchedSignals.length * 0.03);

        return {
          intent: rule.intent,
          confidence: roundConfidence(rule.confidence + bonus),
          matchedSignals,
        };
      }
    }

    return {
      intent: 'other',
      confidence: 0.45,
      matchedSignals: [],
    };
  }
}

function normalizeForMatching(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function roundConfidence(value: number): number {
  return Math.round(Math.min(value, 0.99) * 100) / 100;
}
