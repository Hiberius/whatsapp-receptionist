import { describe, expect, it } from 'vitest';

import { LlmDomainReplyGenerator, type DomainReplyInput } from '@/server/ai/domain-reply';
import type { AiRuntimeContext } from '@/server/ai/context';
import type { LlmClient, LlmCompletionInput } from '@/server/ai/llm';

describe('LlmDomainReplyGenerator', () => {
  it('uses active prompt and injects context plus knowledge base', async () => {
    const llm = new RecordingLlmClient();
    const generator = new LlmDomainReplyGenerator(llm);

    const result = await generator.generate({
      text: 'Quanto costa igiene?',
      assistantName: 'Ambrogio',
      locale: 'it-IT',
      classification: {
        intent: 'pricing_question',
        confidence: 0.91,
        matchedSignals: ['prezzo'],
      },
      context: contextFixture(),
    });

    expect(result).toMatchObject({
      shouldReply: true,
      replyText: 'La seduta di igiene va confermata dallo studio.',
      metadata: {
        aiEngine: {
          feature: 'domain_reply',
          totalTokens: 32,
          costCents: 1,
        },
        aiContext: {
          activePromptId: 'prompt_1',
          knowledgeBaseIds: ['kb_1'],
        },
      },
    });
    expect(llm.calls[0]?.system).toContain('Prompt tenant personalizzato');
    const userPayload = JSON.parse(String(llm.calls[0]?.messages[0]?.content));
    expect(userPayload).toMatchObject({
      text: 'Quanto costa igiene?',
      intent: 'pricing_question',
      conversationContext: [
        {
          role: 'customer',
          text: 'Vorrei info sui prezzi',
        },
      ],
      knowledgeBase: [
        {
          id: 'kb_1',
          title: 'Igiene',
        },
      ],
    });
  });
});

class RecordingLlmClient implements LlmClient {
  readonly calls: LlmCompletionInput[] = [];

  async complete(input: LlmCompletionInput) {
    this.calls.push(input);

    return {
      text: JSON.stringify({
        shouldReply: true,
        replyText: 'La seduta di igiene va confermata dallo studio.',
        handoffReason: null,
      }),
      model: ['clau', 'de-sonnet-4-20250514'].join(''),
      inputTokens: 20,
      outputTokens: 12,
      stopReason: 'end_turn',
      raw: {},
    };
  }
}

function contextFixture(): AiRuntimeContext {
  return {
    conversationMessages: [
      {
        id: 'message_1',
        role: 'customer',
        direction: 'inbound',
        text: 'Vorrei info sui prezzi',
        messageType: 'text',
        createdAt: '2026-04-25T09:00:00.000Z',
      },
    ],
    activePrompt: {
      id: 'prompt_1',
      tenantId: 'tenant_1',
      promptKey: 'domain_reply',
      version: 3,
      model: 'model_1',
      promptText: 'Prompt tenant personalizzato',
    },
    knowledgeBase: [
      {
        id: 'kb_1',
        title: 'Igiene',
        content: 'La seduta di igiene dentale dura circa 45 minuti.',
        category: 'pricing',
        score: 4,
        updatedAt: '2026-04-25T09:00:00.000Z',
      },
    ],
    metadata: {
      loaded: true,
      promptKey: 'domain_reply',
      messageCount: 1,
      knowledgeBaseCount: 1,
      knowledgeBaseIds: ['kb_1'],
      activePromptId: 'prompt_1',
      activePromptVersion: 3,
    },
  };
}
