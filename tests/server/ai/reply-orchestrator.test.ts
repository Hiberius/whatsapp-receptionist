// Test per ReplyOrchestrator: il flow happy path con classifier rule-based,
// fallback su domain reply LLM, gestione errori (context provider e generator)
// e disclosure AI opzionale. Tutto via DI con fake — nessuna chiamata di rete.

import { describe, expect, it, vi } from 'vitest';

import { ReplyOrchestrator, type ReplyOrchestratorInput } from '@/server/ai/reply-orchestrator';
import type { IntentClassification, IntentClassifier } from '@/server/ai/intent-router';
import type { DomainReplyGenerator } from '@/server/ai/domain-reply';
import type { AiContextProvider, AiRuntimeContext } from '@/server/ai/context';

// Helper per istanziare un fake AiContextProvider con superficie minima
// (la classe ha campi privati come repository/embeddingClient che non ci servono).
function fakeContextProvider(load: AiContextProvider['load']): AiContextProvider {
  // eslint-disable-next-line no-restricted-syntax -- Test fixture, runtime validation not required
  return { load } as unknown as AiContextProvider;
}

const baseInput: ReplyOrchestratorInput = {
  text: 'Vorrei prenotare domani',
  assistantName: 'Ambrogio',
  aiDisclosureEnabled: true,
  locale: 'it-IT',
};

function fakeClassifier(intent: IntentClassification['intent']): IntentClassifier {
  return {
    classify: vi.fn(async () => ({
      intent,
      confidence: 0.9,
      matchedSignals: ['signal'],
    })),
  };
}

describe('ReplyOrchestrator.createReply (rule-based fallback)', () => {
  it('happy path: returns booking reply with AI disclosure prefix', async () => {
    // Arrange
    const classifier = fakeClassifier('booking_request');
    const orchestrator = new ReplyOrchestrator(classifier);

    // Act
    const plan = await orchestrator.createReply(baseInput);

    // Assert: classification e shouldReply attivi, disclosure presente
    expect(plan.shouldReply).toBe(true);
    expect(plan.classification.intent).toBe('booking_request');
    expect(plan.replyText).toContain('sono Ambrogio');
    expect(plan.replyText).toContain('prenotare');
    expect(plan.metadata).toMatchObject({
      aiEngine: { provider: 'rule_based' },
      aiContext: null,
    });
  });

  it('omits disclosure prefix when aiDisclosureEnabled=false', async () => {
    // Arrange
    const classifier = fakeClassifier('pricing_question');
    const orchestrator = new ReplyOrchestrator(classifier);

    // Act
    const plan = await orchestrator.createReply({ ...baseInput, aiDisclosureEnabled: false });

    // Assert: nessun prefix "Ciao, sono ..."
    expect(plan.replyText).not.toContain('sono Ambrogio');
    expect(plan.replyText).toBeTruthy();
    expect(plan.shouldReply).toBe(true);
  });

  it('passes locale through to the classifier when provided', async () => {
    // Arrange
    const classifier = fakeClassifier('other');
    const orchestrator = new ReplyOrchestrator(classifier);

    // Act
    await orchestrator.createReply({ ...baseInput, locale: 'en-US' });

    // Assert
    expect(classifier.classify).toHaveBeenCalledWith(
      expect.objectContaining({ text: baseInput.text, locale: 'en-US' }),
    );
  });

  it('does not pass locale when undefined (avoids exactOptionalPropertyTypes mismatch)', async () => {
    // Arrange
    const classifier = fakeClassifier('other');
    const orchestrator = new ReplyOrchestrator(classifier);
    const inputNoLocale: ReplyOrchestratorInput = {
      text: 'ciao',
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: false,
    };

    // Act
    await orchestrator.createReply(inputNoLocale);

    // Assert: l'oggetto passato non deve contenere la chiave `locale`.
    expect(classifier.classify).toHaveBeenCalledTimes(1);
    const call = (classifier.classify as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call).toEqual({ text: 'ciao' });
  });
});

describe('ReplyOrchestrator.createReply (domain reply generator)', () => {
  it('uses domain reply generator output when available', async () => {
    // Arrange
    const classifier = fakeClassifier('booking_request');
    const generator: DomainReplyGenerator = {
      generate: vi.fn(async () => ({
        shouldReply: true,
        replyText: 'Ti propongo martedi alle 10.',
        metadata: { aiEngine: { provider: 'anthropic' } },
      })),
    };
    const orchestrator = new ReplyOrchestrator(classifier, generator);

    // Act
    const plan = await orchestrator.createReply(baseInput);

    // Assert: testo prodotto dal generator, con disclosure
    expect(plan.replyText).toContain('sono Ambrogio');
    expect(plan.replyText).toContain('martedi');
    expect(plan.metadata).toEqual({ aiEngine: { provider: 'anthropic' } });
    expect(generator.generate).toHaveBeenCalledTimes(1);
  });

  it('falls back to rule-based body when domain generator throws', async () => {
    // Arrange
    const classifier = fakeClassifier('cancellation_request');
    const generator: DomainReplyGenerator = {
      generate: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    const orchestrator = new ReplyOrchestrator(classifier, generator);

    // Act
    const plan = await orchestrator.createReply(baseInput);

    // Assert: cadiamo sul rule-based body con fallback metadata
    expect(plan.shouldReply).toBe(true);
    expect(plan.replyText).toContain('annullare');
    expect(plan.metadata).toEqual({
      aiEngine: { provider: 'rule_based', fallbackReason: 'domain_reply_failed' },
      aiContext: null,
    });
  });

  it('handles generator returning replyText=null without disclosure injection', async () => {
    // Arrange
    const classifier = fakeClassifier('other');
    const generator: DomainReplyGenerator = {
      generate: vi.fn(async () => ({
        shouldReply: false,
        replyText: null,
        metadata: { reason: 'low_confidence' },
      })),
    };
    const orchestrator = new ReplyOrchestrator(classifier, generator);

    // Act
    const plan = await orchestrator.createReply(baseInput);

    // Assert: nessun disclosure su null
    expect(plan.replyText).toBeNull();
    expect(plan.shouldReply).toBe(false);
  });
});

describe('ReplyOrchestrator.createReply (context provider)', () => {
  it('passes loaded context to domain generator and surfaces context metadata', async () => {
    // Arrange
    const fakeContext: AiRuntimeContext = {
      conversationMessages: [],
      activePrompt: null,
      knowledgeBase: [],
      metadata: {
        loaded: true,
        promptKey: 'domain_reply',
        messageCount: 0,
        knowledgeBaseCount: 0,
        knowledgeBaseIds: [],
        activePromptId: null,
        activePromptVersion: null,
      },
    };
    const provider = fakeContextProvider(vi.fn(async () => fakeContext));
    const generator: DomainReplyGenerator = {
      generate: vi.fn(async () => ({
        shouldReply: true,
        replyText: 'reply',
      })),
    };
    const classifier = fakeClassifier('booking_request');
    const orchestrator = new ReplyOrchestrator(classifier, generator, provider);

    // Act
    await orchestrator.createReply({
      ...baseInput,
      tenantId: 'tenant_1',
      conversationId: 'conv_1',
    });

    // Assert: context provider chiamato con i campi attesi
    expect(provider.load).toHaveBeenCalledWith({
      tenantId: 'tenant_1',
      conversationId: 'conv_1',
      query: baseInput.text,
    });
    // Generator riceve il context
    const generateCall = (generator.generate as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(generateCall).toMatchObject({ context: fakeContext });
  });

  it('skips context loading when tenantId or conversationId is missing', async () => {
    // Arrange: solo tenantId, senza conversationId, il provider NON deve essere chiamato
    const provider = fakeContextProvider(vi.fn());
    const generator: DomainReplyGenerator = {
      generate: vi.fn(async () => ({ shouldReply: true, replyText: 'r' })),
    };
    const classifier = fakeClassifier('other');
    const orchestrator = new ReplyOrchestrator(classifier, generator, provider);

    // Act
    await orchestrator.createReply({ ...baseInput, tenantId: 'tenant_1' });

    // Assert
    expect(provider.load).not.toHaveBeenCalled();
  });

  it('returns fallback context with reason when context provider throws', async () => {
    // Arrange
    const provider = fakeContextProvider(
      vi.fn(async () => {
        throw new Error('rag down');
      }),
    );
    const classifier = fakeClassifier('opening_hours_question');
    const orchestrator = new ReplyOrchestrator(classifier, null, provider);

    // Act
    const plan = await orchestrator.createReply({
      ...baseInput,
      tenantId: 'tenant_1',
      conversationId: 'conv_1',
    });

    // Assert: il rule-based body parte e il metadata contiene il fallbackReason
    expect(plan.shouldReply).toBe(true);
    expect(plan.replyText).toContain('orari');
    const metadata = plan.metadata as { aiContext: { fallbackReason: string } };
    expect(metadata.aiContext.fallbackReason).toBe('context_load_failed');
  });
});
