import { AppError } from '@/lib/errors/app-error';
import type { AuthSession } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createEmbeddingClient, type EmbeddingClient } from '@/server/ai/embeddings';

export type KnowledgeBaseDocument = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  active: boolean;
  hasEmbedding: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListKnowledgeBaseInput = {
  active?: boolean;
  category?: string | null;
  limit?: number;
};

export type CreateKnowledgeBaseInput = {
  title: string;
  content: string;
  category?: string | null;
  active?: boolean;
  generateEmbedding?: boolean;
};

export type UpdateKnowledgeBaseInput = Partial<{
  title: string;
  content: string;
  category: string | null;
  active: boolean;
  generateEmbedding: boolean;
}>;

export type KnowledgeBaseRepository = {
  listDocuments(input: {
    tenantId: string;
    filters: Required<Pick<ListKnowledgeBaseInput, 'limit'>> &
      Omit<ListKnowledgeBaseInput, 'limit'>;
  }): Promise<KnowledgeBaseDocument[]>;
  getDocument(input: {
    tenantId: string;
    documentId: string;
  }): Promise<KnowledgeBaseDocument | null>;
  createDocument(input: {
    tenantId: string;
    document: CreateKnowledgeBaseNormalized;
  }): Promise<KnowledgeBaseDocument>;
  updateDocument(input: {
    tenantId: string;
    documentId: string;
    patch: UpdateKnowledgeBaseNormalized;
  }): Promise<KnowledgeBaseDocument | null>;
  recordAuditLog(input: {
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Record<string, unknown>;
  }): Promise<void>;
};

type CreateKnowledgeBaseNormalized = {
  title: string;
  content: string;
  category: string | null;
  active: boolean;
  embedding: number[] | null;
};

type UpdateKnowledgeBaseNormalized = Partial<{
  title: string;
  content: string;
  category: string | null;
  active: boolean;
  embedding: number[] | null;
}>;

export class KnowledgeBaseDocumentService {
  constructor(
    private readonly repository: KnowledgeBaseRepository,
    private readonly embeddingClient: EmbeddingClient | null = null,
  ) {}

  async listDocuments(input: {
    session: AuthSession;
    filters?: ListKnowledgeBaseInput;
  }): Promise<KnowledgeBaseDocument[]> {
    return this.repository.listDocuments({
      tenantId: input.session.tenantId,
      filters: {
        limit: normalizeLimit(input.filters?.limit ?? 50),
        ...(input.filters?.active !== undefined ? { active: input.filters.active } : {}),
        ...(input.filters?.category !== undefined
          ? {
              category: normalizeNullableText(input.filters.category, 'Category', 80),
            }
          : {}),
      },
    });
  }

  async getDocument(input: {
    session: AuthSession;
    documentId: string;
  }): Promise<KnowledgeBaseDocument> {
    const document = await this.repository.getDocument({
      tenantId: input.session.tenantId,
      documentId: input.documentId,
    });

    if (!document) {
      throw new AppError('not_found', 'Knowledge base document not found');
    }

    return document;
  }

  async createDocument(input: {
    session: AuthSession;
    document: CreateKnowledgeBaseInput;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<KnowledgeBaseDocument> {
    assertKnowledgeAdmin(input.session);
    const normalized = await this.normalizeCreate(input.session.tenantId, input.document);
    const document = await this.repository.createDocument({
      tenantId: input.session.tenantId,
      document: normalized,
    });
    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'knowledge_base.document.created',
      resourceType: 'knowledge_base',
      resourceId: document.id,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        title: document.title,
        category: document.category,
        active: document.active,
        hasEmbedding: document.hasEmbedding,
      },
    });

    return document;
  }

  async updateDocument(input: {
    session: AuthSession;
    documentId: string;
    patch: UpdateKnowledgeBaseInput;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<KnowledgeBaseDocument> {
    assertKnowledgeAdmin(input.session);
    const current = await this.getDocument({
      session: input.session,
      documentId: input.documentId,
    });
    const patch = await this.normalizeUpdate(input.session.tenantId, current, input.patch);

    if (Object.keys(patch).length === 0) {
      throw new AppError('bad_request', 'Knowledge base update payload is empty');
    }

    const document = await this.repository.updateDocument({
      tenantId: input.session.tenantId,
      documentId: input.documentId,
      patch,
    });

    if (!document) {
      throw new AppError('not_found', 'Knowledge base document not found');
    }

    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'knowledge_base.document.updated',
      resourceType: 'knowledge_base',
      resourceId: document.id,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        fields: Object.keys(patch),
        active: document.active,
        hasEmbedding: document.hasEmbedding,
      },
    });

    return document;
  }

  async archiveDocument(input: {
    session: AuthSession;
    documentId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<KnowledgeBaseDocument> {
    assertKnowledgeAdmin(input.session);
    const document = await this.repository.updateDocument({
      tenantId: input.session.tenantId,
      documentId: input.documentId,
      patch: {
        active: false,
      },
    });

    if (!document) {
      throw new AppError('not_found', 'Knowledge base document not found');
    }

    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'knowledge_base.document.archived',
      resourceType: 'knowledge_base',
      resourceId: document.id,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        title: document.title,
        category: document.category,
      },
    });

    return document;
  }

  private async normalizeCreate(
    tenantId: string,
    input: CreateKnowledgeBaseInput,
  ): Promise<CreateKnowledgeBaseNormalized> {
    const title = normalizeRequiredText(input.title, 'Title', 160);
    const content = normalizeRequiredText(input.content, 'Content', 30_000);
    const shouldGenerateEmbedding = input.generateEmbedding ?? true;

    return {
      title,
      content,
      category: normalizeNullableText(input.category ?? null, 'Category', 80),
      active: input.active ?? true,
      embedding: shouldGenerateEmbedding
        ? await this.generateEmbedding(tenantId, title, content)
        : null,
    };
  }

  private async normalizeUpdate(
    tenantId: string,
    current: KnowledgeBaseDocument,
    input: UpdateKnowledgeBaseInput,
  ): Promise<UpdateKnowledgeBaseNormalized> {
    const patch: UpdateKnowledgeBaseNormalized = {};
    const nextTitle =
      input.title !== undefined ? normalizeRequiredText(input.title, 'Title', 160) : current.title;
    const nextContent =
      input.content !== undefined
        ? normalizeRequiredText(input.content, 'Content', 30_000)
        : current.content;
    const generateEmbedding =
      input.generateEmbedding ?? (input.title !== undefined || input.content !== undefined);

    if (input.title !== undefined) {
      patch.title = nextTitle;
    }

    if (input.content !== undefined) {
      patch.content = nextContent;
    }

    if (input.category !== undefined) {
      patch.category = normalizeNullableText(input.category, 'Category', 80);
    }

    if (input.active !== undefined) {
      patch.active = input.active;
    }

    if (generateEmbedding) {
      patch.embedding = await this.generateEmbedding(tenantId, nextTitle, nextContent);
    }

    return patch;
  }

  private async generateEmbedding(
    tenantId: string,
    title: string,
    content: string,
  ): Promise<number[] | null> {
    if (!this.embeddingClient) {
      return null;
    }

    return this.embeddingClient.embed({
      text: `${title}\n\n${content}`,
      metadata: {
        tenantId,
      },
    });
  }
}

export class SupabaseKnowledgeBaseRepository implements KnowledgeBaseRepository {
  private readonly supabase = createSupabaseAdminClient();

  async listDocuments(input: {
    tenantId: string;
    filters: Required<Pick<ListKnowledgeBaseInput, 'limit'>> &
      Omit<ListKnowledgeBaseInput, 'limit'>;
  }): Promise<KnowledgeBaseDocument[]> {
    let query = this.supabase
      .from('knowledge_base')
      .select('id, title, content, category, active, embedding, created_at, updated_at')
      .eq('tenant_id', input.tenantId)
      .order('updated_at', { ascending: false })
      .limit(input.filters.limit);

    if (input.filters.active !== undefined) {
      query = query.eq('active', input.filters.active);
    }

    if (input.filters.category !== undefined) {
      if (input.filters.category === null) {
        query = query.is('category', null);
      } else {
        query = query.eq('category', input.filters.category);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw toRepositoryError('Failed to list knowledge base documents', error);
    }

    return ((data ?? []) as KnowledgeBaseRow[]).map(documentFromRow);
  }

  async getDocument(input: {
    tenantId: string;
    documentId: string;
  }): Promise<KnowledgeBaseDocument | null> {
    const { data, error } = await this.supabase
      .from('knowledge_base')
      .select('id, title, content, category, active, embedding, created_at, updated_at')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.documentId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read knowledge base document', error);
    }

    return data ? documentFromRow(data as KnowledgeBaseRow) : null;
  }

  async createDocument(input: {
    tenantId: string;
    document: CreateKnowledgeBaseNormalized;
  }): Promise<KnowledgeBaseDocument> {
    const { data, error } = await this.supabase
      .from('knowledge_base')
      .insert({
        tenant_id: input.tenantId,
        title: input.document.title,
        content: input.document.content,
        category: input.document.category,
        active: input.document.active,
        embedding: input.document.embedding ? toPgVector(input.document.embedding) : null,
      })
      .select('id, title, content, category, active, embedding, created_at, updated_at')
      .single();

    if (error) {
      throw toRepositoryError('Failed to create knowledge base document', error);
    }

    return documentFromRow(data as KnowledgeBaseRow);
  }

  async updateDocument(input: {
    tenantId: string;
    documentId: string;
    patch: UpdateKnowledgeBaseNormalized;
  }): Promise<KnowledgeBaseDocument | null> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.patch.title !== undefined) {
      patch.title = input.patch.title;
    }

    if (input.patch.content !== undefined) {
      patch.content = input.patch.content;
    }

    if (input.patch.category !== undefined) {
      patch.category = input.patch.category;
    }

    if (input.patch.active !== undefined) {
      patch.active = input.patch.active;
    }

    if (input.patch.embedding !== undefined) {
      patch.embedding = input.patch.embedding ? toPgVector(input.patch.embedding) : null;
    }

    const { data, error } = await this.supabase
      .from('knowledge_base')
      .update(patch)
      .eq('tenant_id', input.tenantId)
      .eq('id', input.documentId)
      .select('id, title, content, category, active, embedding, created_at, updated_at')
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to update knowledge base document', error);
    }

    return data ? documentFromRow(data as KnowledgeBaseRow) : null;
  }

  async recordAuditLog(input: {
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from('audit_log').insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      metadata: input.metadata,
    });

    if (error) {
      throw toRepositoryError('Failed to write knowledge base audit log', error);
    }
  }
}

export function createKnowledgeBaseDocumentService(): KnowledgeBaseDocumentService {
  return new KnowledgeBaseDocumentService(
    new SupabaseKnowledgeBaseRepository(),
    createEmbeddingClient(),
  );
}

type KnowledgeBaseRow = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  active: boolean;
  embedding: unknown;
  created_at: string;
  updated_at: string;
};

function assertKnowledgeAdmin(
  session: AuthSession,
): asserts session is AuthSession & { role: 'owner' | 'admin' } {
  if (session.role !== 'owner' && session.role !== 'admin') {
    throw new AppError('forbidden', 'Admin role required');
  }
}

function documentFromRow(row: KnowledgeBaseRow): KnowledgeBaseDocument {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    active: row.active,
    hasEmbedding: row.embedding !== null && row.embedding !== undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new AppError('bad_request', 'Limit is out of range');
  }

  return value;
}

function normalizeRequiredText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new AppError('bad_request', `${label} is required`);
  }

  if (normalized.length > maxLength) {
    throw new AppError('bad_request', `${label} is too long`);
  }

  return normalized;
}

function normalizeNullableText(
  value: string | null | undefined,
  label: string,
  maxLength: number,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new AppError('bad_request', `${label} is too long`);
  }

  return normalized;
}

function toPgVector(embedding: number[]): string {
  return `[${embedding.map((value) => normalizeVectorNumber(value)).join(',')}]`;
}

function normalizeVectorNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new AppError('bad_request', 'Embedding contains an invalid value');
  }

  return Number(value.toFixed(8)).toString();
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
