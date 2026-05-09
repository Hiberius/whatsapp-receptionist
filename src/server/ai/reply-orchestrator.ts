import {
  RuleBasedIntentClassifier,
  type IntentClassification,
  type IntentClassifier,
} from '@/server/ai/intent-router';
import { env } from '@/lib/env';
import { createAnthropicClientForModel } from '@/server/ai/anthropic-adapter';
import {
  createAiContextProvider,
  emptyAiRuntimeContext,
  type AiContextProvider,
  type AiRuntimeContext,
} from '@/server/ai/context';
import { LlmDomainReplyGenerator, type DomainReplyGenerator } from '@/server/ai/domain-reply';
import { FallbackIntentClassifier, LlmIntentClassifier } from '@/server/ai/llm-intent-classifier';

export type ReplyOrchestratorInput = {
  tenantId?: string;
  conversationId?: string;
  text: string;
  assistantName: string;
  aiDisclosureEnabled: boolean;
  locale?: string;
};

export type ReplyPlan = {
  shouldReply: boolean;
  replyText: string | null;
  classification: IntentClassification;
  metadata?: Record<string, unknown>;
};

export class ReplyOrchestrator {
  constructor(
    private readonly classifier: IntentClassifier = new RuleBasedIntentClassifier(),
    private readonly domainReplyGenerator: DomainReplyGenerator | null = null,
    private readonly contextProvider: AiContextProvider | null = null,
  ) {}

  async createReply(input: ReplyOrchestratorInput): Promise<ReplyPlan> {
    const classification = await this.classifier.classify({
      text: input.text,
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
    });
    const context = await this.loadContextSafely(input);
    const generatedReply = await this.generateDomainReplySafely(input, classification, context);

    if (generatedReply) {
      return {
        ...generatedReply,
        replyText: generatedReply.replyText
          ? withDisclosure(generatedReply.replyText, {
              assistantName: input.assistantName,
              aiDisclosureEnabled: input.aiDisclosureEnabled,
            })
          : null,
        classification,
      };
    }

    const body = createReplyBody(classification.intent);

    return {
      shouldReply: body !== null,
      replyText:
        body === null
          ? null
          : withDisclosure(body, {
              assistantName: input.assistantName,
              aiDisclosureEnabled: input.aiDisclosureEnabled,
            }),
      classification,
      metadata: {
        aiEngine: {
          provider: 'rule_based',
        },
        aiContext: context?.metadata ?? null,
      },
    };
  }

  private async generateDomainReplySafely(
    input: ReplyOrchestratorInput,
    classification: IntentClassification,
    context: AiRuntimeContext | null,
  ): Promise<Omit<ReplyPlan, 'classification'> | null> {
    if (!this.domainReplyGenerator) {
      return null;
    }

    try {
      return await this.domainReplyGenerator.generate({
        text: input.text,
        assistantName: input.assistantName,
        ...(input.locale !== undefined ? { locale: input.locale } : {}),
        classification,
        ...(context !== null ? { context } : {}),
      });
    } catch {
      return {
        shouldReply: createReplyBody(classification.intent) !== null,
        replyText: createReplyBody(classification.intent),
        metadata: {
          aiEngine: {
            provider: 'rule_based',
            fallbackReason: 'domain_reply_failed',
          },
          aiContext: context?.metadata ?? null,
        },
      };
    }
  }

  private async loadContextSafely(input: ReplyOrchestratorInput): Promise<AiRuntimeContext | null> {
    if (!this.contextProvider || !input.tenantId || !input.conversationId) {
      return null;
    }

    try {
      return await this.contextProvider.load({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        query: input.text,
      });
    } catch {
      return emptyAiRuntimeContext({
        fallbackReason: 'context_load_failed',
      });
    }
  }
}

export function createReplyOrchestrator(): ReplyOrchestrator {
  const fastClient = createAnthropicClientForModel(env.ANTHROPIC_MODEL_FAST);
  const primaryClient = createAnthropicClientForModel(env.ANTHROPIC_MODEL_PRIMARY);
  const classifier = fastClient
    ? new FallbackIntentClassifier(new LlmIntentClassifier(fastClient))
    : new RuleBasedIntentClassifier();
  const domainReplyGenerator = primaryClient ? new LlmDomainReplyGenerator(primaryClient) : null;

  return new ReplyOrchestrator(
    classifier,
    domainReplyGenerator,
    env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createAiContextProvider()
      : null,
  );
}

function createReplyBody(intent: IntentClassification['intent']): string | null {
  switch (intent) {
    case 'booking_request':
      return 'Certo, ti aiuto a prenotare. Indicami servizio, giorno e fascia oraria che preferisci, cosi controllo la disponibilita.';
    case 'reschedule_request':
      return "Certo, posso aiutarti a spostare l'appuntamento. Mandami giorno e orario attuali, poi la nuova fascia che preferisci.";
    case 'cancellation_request':
      return "Va bene, posso aiutarti ad annullare. Mandami nome, giorno e orario dell'appuntamento da cancellare.";
    case 'pricing_question':
      return 'Ti aiuto volentieri. Dimmi quale servizio ti interessa e ti rispondo con prezzo, durata e disponibilita.';
    case 'opening_hours_question':
      return 'Ti aiuto subito. Dimmi per quale giorno vuoi verificare gli orari o se preferisci prenotare direttamente.';
    case 'human_handoff':
      return 'Ho capito. Segno la richiesta per una persona del team e preparo il contesto della conversazione.';
    case 'other':
      return 'Grazie per il messaggio. Dimmi pure se vuoi prenotare, modificare un appuntamento o parlare con il team.';
  }
}

function withDisclosure(
  body: string,
  input: {
    assistantName: string;
    aiDisclosureEnabled: boolean;
  },
): string {
  if (!input.aiDisclosureEnabled) {
    return body;
  }

  return `Ciao, sono ${input.assistantName}, l'assistente AI dello studio. ${body}`;
}
