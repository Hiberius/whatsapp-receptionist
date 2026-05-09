import { describe, expect, it } from 'vitest';

import { ReplyOrchestrator } from '@/server/ai/reply-orchestrator';
import { RuleBasedIntentClassifier } from '@/server/ai/intent-router';
import type { DomainReplyGenerator, DomainReplyInput } from '@/server/ai/domain-reply';

describe('RuleBasedIntentClassifier', () => {
  it('classifies common Italian receptionist intents', async () => {
    const classifier = new RuleBasedIntentClassifier();

    await expect(
      classifier.classify({ text: 'Vorrei prenotare una visita domani' }),
    ).resolves.toMatchObject({
      intent: 'booking_request',
    });

    await expect(
      classifier.classify({ text: "Posso spostare l'appuntamento?" }),
    ).resolves.toMatchObject({
      intent: 'reschedule_request',
    });

    await expect(classifier.classify({ text: 'Annulla appuntamento' })).resolves.toMatchObject({
      intent: 'cancellation_request',
    });

    await expect(
      classifier.classify({ text: 'Quanto costa la prima consulenza?' }),
    ).resolves.toMatchObject({
      intent: 'pricing_question',
    });
  });
});

describe('ReplyOrchestrator', () => {
  it('adds AI disclosure when enabled by tenant policy', async () => {
    const orchestrator = new ReplyOrchestrator();

    const reply = await orchestrator.createReply({
      text: 'Vorrei fissare un appuntamento',
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: true,
      locale: 'it-IT',
    });

    expect(reply.shouldReply).toBe(true);
    expect(reply.classification.intent).toBe('booking_request');
    expect(reply.replyText).toContain('sono Ambrogio');
  });

  it('uses a configured domain reply generator before falling back', async () => {
    const generator = new FakeDomainReplyGenerator(
      'Certo, posso aiutarti con informazioni e appuntamenti.',
    );
    const orchestrator = new ReplyOrchestrator(new RuleBasedIntentClassifier(), generator);

    const reply = await orchestrator.createReply({
      text: 'Ciao, vorrei qualche informazione',
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: true,
      locale: 'it-IT',
    });

    expect(generator.calls[0]).toMatchObject({
      text: 'Ciao, vorrei qualche informazione',
    });
    expect(reply.replyText).toContain('sono Ambrogio');
    expect(reply.replyText).toContain('posso aiutarti');
    expect(reply.metadata).toMatchObject({
      aiEngine: {
        provider: 'fake',
      },
    });
  });
});

class FakeDomainReplyGenerator implements DomainReplyGenerator {
  readonly calls: DomainReplyInput[] = [];

  constructor(private readonly replyText: string) {}

  async generate(input: DomainReplyInput) {
    this.calls.push(input);

    return {
      shouldReply: true,
      replyText: this.replyText,
      metadata: {
        aiEngine: {
          provider: 'fake',
        },
      },
    };
  }
}
