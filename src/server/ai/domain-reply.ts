import { z } from 'zod';

import type { IntentClassification } from '@/server/ai/intent-router';
import type { AiRuntimeContext } from '@/server/ai/context';
import { extractJsonObject, type LlmClient } from '@/server/ai/llm';
import { usageFromLlmResult } from '@/server/ai/costs';

export type DomainReplyInput = {
  text: string;
  assistantName: string;
  locale?: string;
  classification: IntentClassification;
  context?: AiRuntimeContext;
};

export type DomainReplyResult = {
  shouldReply: boolean;
  replyText: string | null;
  metadata?: Record<string, unknown>;
};

export interface DomainReplyGenerator {
  generate(input: DomainReplyInput): Promise<DomainReplyResult>;
}

const domainReplySchema = z.object({
  shouldReply: z.boolean(),
  replyText: z.string().nullable(),
  handoffReason: z.string().nullable().optional(),
});

export class LlmDomainReplyGenerator implements DomainReplyGenerator {
  constructor(private readonly llm: LlmClient) {}

  async generate(input: DomainReplyInput): Promise<DomainReplyResult> {
    const result = await this.llm.complete({
      system: buildDomainReplySystemPrompt({
        assistantName: input.assistantName,
        ...(input.context !== undefined ? { context: input.context } : {}),
      }),
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            text: input.text,
            locale: input.locale ?? 'it-IT',
            intent: input.classification.intent,
            confidence: input.classification.confidence,
            conversationContext:
              input.context?.conversationMessages.map((message) => ({
                role: message.role,
                direction: message.direction,
                text: message.text,
                createdAt: message.createdAt,
              })) ?? [],
            knowledgeBase:
              input.context?.knowledgeBase.map((entry) => ({
                id: entry.id,
                title: entry.title,
                category: entry.category,
                content: entry.content,
              })) ?? [],
          }),
        },
      ],
      maxTokens: 420,
      temperature: 0.25,
      metadata: {
        feature: 'domain_reply',
      },
    });
    const parsed = domainReplySchema.parse(extractJsonObject(result.text));
    const aiUsage = usageFromLlmResult(result, 'domain_reply');

    return {
      shouldReply: parsed.shouldReply && Boolean(parsed.replyText?.trim()),
      replyText: parsed.replyText?.trim() || null,
      metadata: {
        aiEngine: {
          ...aiUsage,
          handoffReason: parsed.handoffReason ?? null,
        },
        aiContext: input.context?.metadata ?? null,
      },
    };
  }
}

function domainReplySystemPrompt(assistantName: string): string {
  const fallbackPrompt = [
    `Sei ${assistantName}, l'assistente AI di uno studio professionale italiano.`,
    'Rispondi in italiano, massimo 3 frasi, tono professionale e semplice.',
    'Non aggiungere disclosure AI: viene gestita dal sistema.',
    'Non dare diagnosi, consigli medici, legali, finanziari o promesse di risultato.',
    'Se il messaggio e delicato, urgente o non sei certo, chiedi passaggio al team umano.',
    'Per booking, reschedule e cancellazioni dai una risposta breve di raccolta informazioni, senza inventare slot.',
    'Usa conversationContext e knowledgeBase solo quando sono pertinenti. Se knowledgeBase non contiene la risposta, non inventare.',
    'Rispondi solo con JSON valido nello schema:',
    '{"shouldReply":true,"replyText":"Testo da inviare al cliente","handoffReason":null}',
  ].join('\n');

  return fallbackPrompt;
}

export function buildDomainReplySystemPrompt(input: {
  assistantName: string;
  context?: AiRuntimeContext;
}): string {
  const activePrompt = input.context?.activePrompt?.promptText?.trim();

  if (activePrompt) {
    return [
      activePrompt,
      '',
      'Regole di output non negoziabili:',
      'Rispondi solo con JSON valido nello schema {"shouldReply":true,"replyText":"...","handoffReason":null}.',
      'Non aggiungere disclosure AI: viene gestita dal sistema.',
      'Non inventare informazioni assenti da knowledgeBase o conversationContext.',
    ].join('\n');
  }

  return domainReplySystemPrompt(input.assistantName);
}
