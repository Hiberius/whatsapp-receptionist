import { describe, expect, it } from 'vitest';

import type { AuthSession } from '@/lib/auth/session';
import type { EmbeddingClient, EmbeddingInput } from '@/server/ai/embeddings';
import {
  KnowledgeBaseDocumentService,
  type KnowledgeBaseDocument,
  type KnowledgeBaseRepository,
} from '@/server/knowledge-base/documents';

describe('KnowledgeBaseDocumentService', () => {
  it('allows members to list active documents', async () => {
    const service = new KnowledgeBaseDocumentService(new FakeKnowledgeBaseRepository(), null);

    await expect(
      service.listDocuments({
        session: memberSession(),
        filters: {
          active: true,
        },
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        title: 'Orari studio',
        active: true,
      }),
    ]);
  });

  it('creates documents with optional embeddings and audit metadata', async () => {
    const repository = new FakeKnowledgeBaseRepository();
    const embeddingClient = new FakeEmbeddingClient([0.1, 0.2, 0.3]);
    const service = new KnowledgeBaseDocumentService(repository, embeddingClient);

    const document = await service.createDocument({
      session: adminSession(),
      document: {
        title: ' Prezzi igiene ',
        content: ' Igiene dentale da 80 euro. ',
        category: ' pricing ',
      },
      ipAddress: '203.0.113.10',
      userAgent: 'Vitest',
    });

    expect(document).toMatchObject({
      title: 'Prezzi igiene',
      content: 'Igiene dentale da 80 euro.',
      category: 'pricing',
      active: true,
      hasEmbedding: true,
    });
    expect(embeddingClient.calls[0]).toMatchObject({
      text: 'Prezzi igiene\n\nIgiene dentale da 80 euro.',
      metadata: {
        tenantId: '00000000-0000-4000-8000-000000000001',
      },
    });
    expect(repository.auditLogs[0]).toMatchObject({
      action: 'knowledge_base.document.created',
      resourceType: 'knowledge_base',
      ipAddress: '203.0.113.10',
      userAgent: 'Vitest',
      metadata: {
        title: 'Prezzi igiene',
        category: 'pricing',
        active: true,
        hasEmbedding: true,
      },
    });
  });

  it('updates content and regenerates embeddings by default', async () => {
    const repository = new FakeKnowledgeBaseRepository();
    const embeddingClient = new FakeEmbeddingClient([0.4, 0.5, 0.6]);
    const service = new KnowledgeBaseDocumentService(repository, embeddingClient);

    const updated = await service.updateDocument({
      session: adminSession(),
      documentId: '00000000-0000-4000-8000-000000000301',
      patch: {
        content: 'Nuovi orari: lunedi venerdi 9-18.',
      },
    });

    expect(updated).toMatchObject({
      content: 'Nuovi orari: lunedi venerdi 9-18.',
      hasEmbedding: true,
    });
    expect(embeddingClient.calls).toHaveLength(1);
    expect(repository.auditLogs[0]?.metadata).toMatchObject({
      fields: ['content', 'embedding'],
      active: true,
      hasEmbedding: true,
    });
  });

  it('archives documents and blocks member mutations', async () => {
    const repository = new FakeKnowledgeBaseRepository();
    const service = new KnowledgeBaseDocumentService(repository, null);

    await expect(
      service.createDocument({
        session: memberSession(),
        document: {
          title: 'FAQ',
          content: 'Risposta',
        },
      }),
    ).rejects.toMatchObject({
      code: 'forbidden',
    });

    await expect(
      service.archiveDocument({
        session: adminSession(),
        documentId: '00000000-0000-4000-8000-000000000301',
      }),
    ).resolves.toMatchObject({
      active: false,
    });
    expect(repository.auditLogs[0]?.action).toBe('knowledge_base.document.archived');
  });
});

class FakeKnowledgeBaseRepository implements KnowledgeBaseRepository {
  readonly documents: KnowledgeBaseDocument[] = [
    documentRecord({
      id: '00000000-0000-4000-8000-000000000301',
      title: 'Orari studio',
      content: 'Siamo aperti dal lunedi al venerdi.',
      category: 'orari',
      active: true,
      hasEmbedding: false,
    }),
  ];
  readonly auditLogs: Array<Parameters<KnowledgeBaseRepository['recordAuditLog']>[0]> = [];

  async listDocuments(input: {
    tenantId: string;
    filters: Parameters<KnowledgeBaseRepository['listDocuments']>[0]['filters'];
  }): Promise<KnowledgeBaseDocument[]> {
    return this.documents
      .filter((document) =>
        input.filters.active === undefined ? true : document.active === input.filters.active,
      )
      .filter((document) =>
        input.filters.category === undefined ? true : document.category === input.filters.category,
      )
      .slice(0, input.filters.limit)
      .map((document) => ({ ...document }));
  }

  async getDocument(input: {
    tenantId: string;
    documentId: string;
  }): Promise<KnowledgeBaseDocument | null> {
    return this.documents.find((document) => document.id === input.documentId) ?? null;
  }

  async createDocument(input: {
    tenantId: string;
    document: Parameters<KnowledgeBaseRepository['createDocument']>[0]['document'];
  }): Promise<KnowledgeBaseDocument> {
    const document = documentRecord({
      id: '00000000-0000-4000-8000-000000000302',
      title: input.document.title,
      content: input.document.content,
      category: input.document.category,
      active: input.document.active,
      hasEmbedding: Boolean(input.document.embedding),
    });
    this.documents.push(document);

    return { ...document };
  }

  async updateDocument(input: {
    tenantId: string;
    documentId: string;
    patch: Parameters<KnowledgeBaseRepository['updateDocument']>[0]['patch'];
  }): Promise<KnowledgeBaseDocument | null> {
    const index = this.documents.findIndex((document) => document.id === input.documentId);

    if (index === -1) {
      return null;
    }

    const current = this.documents[index];

    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      ...input.patch,
      hasEmbedding:
        input.patch.embedding === undefined ? current.hasEmbedding : Boolean(input.patch.embedding),
      updatedAt: '2026-04-26T12:00:00.000Z',
    };
    this.documents[index] = updated;

    return { ...updated };
  }

  async recordAuditLog(
    input: Parameters<KnowledgeBaseRepository['recordAuditLog']>[0],
  ): Promise<void> {
    this.auditLogs.push(input);
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

function adminSession(): AuthSession {
  return {
    userId: '00000000-0000-4000-8000-000000000099',
    tenantId: '00000000-0000-4000-8000-000000000001',
    role: 'admin',
  };
}

function memberSession(): AuthSession {
  return {
    ...adminSession(),
    role: 'member',
  };
}

function documentRecord(overrides: Partial<KnowledgeBaseDocument> = {}): KnowledgeBaseDocument {
  return {
    id: '00000000-0000-4000-8000-000000000301',
    title: 'Documento',
    content: 'Contenuto',
    category: null,
    active: true,
    hasEmbedding: false,
    createdAt: '2026-04-26T08:00:00.000Z',
    updatedAt: '2026-04-26T08:00:00.000Z',
    ...overrides,
  };
}
