import { describe, expect, it } from 'vitest';

import {
  AiContextProvider,
  type ActiveAiPrompt,
  type AiContextRepository,
  type ConversationContextMessage,
  type KnowledgeBaseSnippet,
} from '@/server/ai/context';
import type { EmbeddingClient, EmbeddingInput } from '@/server/ai/embeddings';

describe('AiContextProvider', () => {
  it('loads conversation, tenant prompt and ranked knowledge snippets', async () => {
    const repository = new FakeAiContextRepository();
    const provider = new AiContextProvider(repository);

    const context = await provider.load({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      query: 'Quanto costa igiene dentale?',
    });

    expect(context.activePrompt).toMatchObject({
      id: 'prompt_tenant_v2',
      tenantId: 'tenant_1',
      version: 2,
    });
    expect(context.conversationMessages.map((message) => message.text)).toEqual([
      'Buongiorno',
      'Ciao, sono Ambrogio',
    ]);
    expect(context.knowledgeBase.map((entry) => entry.id)).toEqual(['kb_igiene']);
    expect(context.metadata).toMatchObject({
      loaded: true,
      promptKey: 'domain_reply',
      messageCount: 2,
      knowledgeBaseCount: 1,
      knowledgeBaseIds: ['kb_igiene'],
      activePromptId: 'prompt_tenant_v2',
      activePromptVersion: 2,
      knowledgeBaseRetrieval: 'lexical',
    });
  });

  it('prefers vector knowledge matches when embeddings are configured', async () => {
    const repository = new FakeAiContextRepository();
    repository.vectorMatches = [
      {
        id: 'kb_vector',
        title: 'Prezzi igiene',
        content: 'Risposta vettoriale piu precisa.',
        category: 'pricing',
        score: 0.91,
        updatedAt: '2026-04-25T09:00:00.000Z',
      },
    ];
    const embeddingClient = new FakeEmbeddingClient([0.1, 0.2, 0.3]);
    const provider = new AiContextProvider(repository, embeddingClient);

    const context = await provider.load({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      query: 'Quanto costa igiene dentale?',
    });

    expect(embeddingClient.calls[0]).toMatchObject({
      text: 'Quanto costa igiene dentale?',
      metadata: {
        tenantId: 'tenant_1',
      },
    });
    expect(repository.lastEmbedding).toEqual([0.1, 0.2, 0.3]);
    expect(context.knowledgeBase.map((entry) => entry.id)).toEqual(['kb_vector']);
    expect(context.metadata).toMatchObject({
      knowledgeBaseRetrieval: 'vector',
      knowledgeBaseIds: ['kb_vector'],
    });
  });
});

class FakeAiContextRepository implements AiContextRepository {
  vectorMatches: KnowledgeBaseSnippet[] = [];
  lastEmbedding: number[] | null = null;

  async listConversationMessages(): Promise<ConversationContextMessage[]> {
    return [
      {
        id: 'message_1',
        role: 'customer',
        direction: 'inbound',
        text: 'Buongiorno',
        messageType: 'text',
        createdAt: '2026-04-25T09:00:00.000Z',
      },
      {
        id: 'message_2',
        role: 'assistant',
        direction: 'outbound',
        text: 'Ciao, sono Ambrogio',
        messageType: 'text',
        createdAt: '2026-04-25T09:01:00.000Z',
      },
    ];
  }

  async listActivePrompts(): Promise<ActiveAiPrompt[]> {
    return [
      {
        id: 'prompt_global_v1',
        tenantId: null,
        promptKey: 'domain_reply',
        version: 1,
        model: 'global-model',
        promptText: 'Prompt globale',
      },
      {
        id: 'prompt_tenant_v2',
        tenantId: 'tenant_1',
        promptKey: 'domain_reply',
        version: 2,
        model: 'tenant-model',
        promptText: 'Prompt tenant',
      },
    ];
  }

  async listKnowledgeBaseEntries(): Promise<Array<Omit<KnowledgeBaseSnippet, 'score'>>> {
    return [
      {
        id: 'kb_igiene',
        title: 'Igiene dentale',
        content: 'Il costo della seduta di igiene dentale viene comunicato dallo studio.',
        category: 'pricing',
        updatedAt: '2026-04-25T09:00:00.000Z',
      },
      {
        id: 'kb_parcheggio',
        title: 'Parcheggio',
        content: 'Parcheggio disponibile in zona.',
        category: 'logistics',
        updatedAt: '2026-04-25T09:00:00.000Z',
      },
    ];
  }

  async matchKnowledgeBaseByEmbedding(input: {
    embedding: number[];
  }): Promise<KnowledgeBaseSnippet[]> {
    this.lastEmbedding = input.embedding;
    return this.vectorMatches;
  }
}

class FakeEmbeddingClient implements EmbeddingClient {
  readonly calls: EmbeddingInput[] = [];

  constructor(private readonly embedding: number[]) {}

  async embed(input: EmbeddingInput): Promise<number[]> {
    this.calls.push(input);
    return this.embedding;
  }
}
