import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors/app-error';
import { createEmbeddingClient, type EmbeddingClient } from '@/server/ai/embeddings';

export type ConversationContextMessage = {
  id: string;
  role: 'customer' | 'assistant' | 'human' | 'system';
  direction: 'inbound' | 'outbound';
  text: string;
  messageType: string;
  createdAt: string;
};

export type ActiveAiPrompt = {
  id: string;
  tenantId: string | null;
  promptKey: string;
  version: number;
  model: string;
  promptText: string;
};

export type KnowledgeBaseSnippet = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  score: number;
  updatedAt: string;
};

export type AiRuntimeContext = {
  conversationMessages: ConversationContextMessage[];
  activePrompt: ActiveAiPrompt | null;
  knowledgeBase: KnowledgeBaseSnippet[];
  metadata: {
    loaded: boolean;
    promptKey: string;
    messageCount: number;
    knowledgeBaseCount: number;
    knowledgeBaseIds: string[];
    activePromptId: string | null;
    activePromptVersion: number | null;
    knowledgeBaseRetrieval?: 'vector' | 'lexical' | 'none';
    fallbackReason?: string;
    knowledgeBaseFallbackReason?: string;
  };
};

export type AiContextLoadInput = {
  tenantId: string;
  conversationId: string;
  query: string;
  promptKey?: string;
  messageLimit?: number;
  knowledgeLimit?: number;
};

export interface AiContextRepository {
  listConversationMessages(input: {
    tenantId: string;
    conversationId: string;
    limit: number;
  }): Promise<ConversationContextMessage[]>;
  listActivePrompts(input: { tenantId: string; promptKey: string }): Promise<ActiveAiPrompt[]>;
  listKnowledgeBaseEntries(input: {
    tenantId: string;
    limit: number;
  }): Promise<Array<Omit<KnowledgeBaseSnippet, 'score'>>>;
  matchKnowledgeBaseByEmbedding?(input: {
    tenantId: string;
    embedding: number[];
    limit: number;
    minSimilarity: number;
  }): Promise<KnowledgeBaseSnippet[]>;
}

export class AiContextProvider {
  constructor(
    private readonly repository: AiContextRepository,
    private readonly embeddingClient: EmbeddingClient | null = null,
  ) {}

  async load(input: AiContextLoadInput): Promise<AiRuntimeContext> {
    const promptKey = input.promptKey ?? 'domain_reply';
    const [messages, prompts, knowledge] = await Promise.all([
      this.repository.listConversationMessages({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        limit: input.messageLimit ?? 12,
      }),
      this.repository.listActivePrompts({
        tenantId: input.tenantId,
        promptKey,
      }),
      this.loadKnowledgeBase(input),
    ]);
    const activePrompt = selectActivePrompt(prompts, input.tenantId);
    const knowledgeBase = knowledge.entries;

    return {
      conversationMessages: messages.map(truncateConversationMessage),
      activePrompt,
      knowledgeBase,
      metadata: {
        loaded: true,
        promptKey,
        messageCount: messages.length,
        knowledgeBaseCount: knowledgeBase.length,
        knowledgeBaseIds: knowledgeBase.map((entry) => entry.id),
        activePromptId: activePrompt?.id ?? null,
        activePromptVersion: activePrompt?.version ?? null,
        knowledgeBaseRetrieval: knowledge.strategy,
        ...(knowledge.fallbackReason !== undefined
          ? { knowledgeBaseFallbackReason: knowledge.fallbackReason }
          : {}),
      },
    };
  }

  private async loadKnowledgeBase(input: AiContextLoadInput): Promise<{
    entries: KnowledgeBaseSnippet[];
    strategy: 'vector' | 'lexical' | 'none';
    fallbackReason?: string;
  }> {
    const limit = input.knowledgeLimit ?? 3;

    if (this.embeddingClient && this.repository.matchKnowledgeBaseByEmbedding) {
      try {
        const embedding = await this.embeddingClient.embed({
          text: input.query,
          metadata: {
            tenantId: input.tenantId,
          },
        });
        const vectorMatches = await this.repository.matchKnowledgeBaseByEmbedding({
          tenantId: input.tenantId,
          embedding,
          limit,
          minSimilarity: 0.72,
        });

        if (vectorMatches.length > 0) {
          return {
            entries: vectorMatches.map(truncateKnowledgeSnippet),
            strategy: 'vector',
          };
        }
      } catch {
        const entries = await this.loadLexicalKnowledgeBase(input, limit);

        return {
          entries,
          strategy: entries.length > 0 ? 'lexical' : 'none',
          fallbackReason: 'vector_retrieval_failed',
        };
      }
    }

    const entries = await this.loadLexicalKnowledgeBase(input, limit);

    return {
      entries,
      strategy: entries.length > 0 ? 'lexical' : 'none',
    };
  }

  private async loadLexicalKnowledgeBase(
    input: AiContextLoadInput,
    limit: number,
  ): Promise<KnowledgeBaseSnippet[]> {
    const knowledgeEntries = await this.repository.listKnowledgeBaseEntries({
      tenantId: input.tenantId,
      limit: 40,
    });

    return rankKnowledgeBase({
      query: input.query,
      entries: knowledgeEntries,
      limit,
    });
  }
}

export class SupabaseAiContextRepository implements AiContextRepository {
  private readonly supabase = createSupabaseAdminClient();

  async listConversationMessages(input: {
    tenantId: string;
    conversationId: string;
    limit: number;
  }): Promise<ConversationContextMessage[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('id, direction, sender_type, content, transcript_text, message_type, created_at')
      .eq('tenant_id', input.tenantId)
      .eq('conversation_id', input.conversationId)
      .order('created_at', { ascending: false })
      .limit(input.limit);

    if (error) {
      throw toRepositoryError('Failed to load AI conversation context', error);
    }

    return ((data ?? []) as MessageRow[])
      .reverse()
      .map((row) => ({
        id: row.id,
        role: senderTypeToRole(row.sender_type),
        direction: row.direction,
        text: row.transcript_text?.trim() || row.content?.trim() || '',
        messageType: row.message_type,
        createdAt: row.created_at,
      }))
      .filter((message) => message.text.length > 0);
  }

  async listActivePrompts(input: {
    tenantId: string;
    promptKey: string;
  }): Promise<ActiveAiPrompt[]> {
    const { data, error } = await this.supabase
      .from('ai_prompts')
      .select('id, tenant_id, prompt_key, version, model, prompt_text')
      .eq('prompt_key', input.promptKey)
      .eq('active', true)
      .or(`tenant_id.is.null,tenant_id.eq.${input.tenantId}`)
      .order('version', { ascending: false })
      .limit(20);

    if (error) {
      throw toRepositoryError('Failed to load active AI prompts', error);
    }

    return ((data ?? []) as PromptRow[]).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      promptKey: row.prompt_key,
      version: row.version,
      model: row.model,
      promptText: row.prompt_text,
    }));
  }

  async listKnowledgeBaseEntries(input: {
    tenantId: string;
    limit: number;
  }): Promise<Array<Omit<KnowledgeBaseSnippet, 'score'>>> {
    const { data, error } = await this.supabase
      .from('knowledge_base')
      .select('id, title, content, category, updated_at')
      .eq('tenant_id', input.tenantId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(input.limit);

    if (error) {
      throw toRepositoryError('Failed to load AI knowledge base', error);
    }

    return ((data ?? []) as KnowledgeBaseRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      content: truncate(row.content, 900),
      category: row.category,
      updatedAt: row.updated_at,
    }));
  }

  async matchKnowledgeBaseByEmbedding(input: {
    tenantId: string;
    embedding: number[];
    limit: number;
    minSimilarity: number;
  }): Promise<KnowledgeBaseSnippet[]> {
    const { data, error } = await this.supabase.rpc('match_knowledge_base', {
      p_tenant_id: input.tenantId,
      p_query_embedding: toPgVector(input.embedding),
      p_match_count: input.limit,
      p_min_similarity: input.minSimilarity,
    });

    if (error) {
      throw toRepositoryError('Failed to vector-match AI knowledge base', error);
    }

    return ((data ?? []) as KnowledgeBaseMatchRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      content: truncate(row.content, 900),
      category: row.category,
      score: row.similarity,
      updatedAt: row.updated_at,
    }));
  }
}

export function createAiContextProvider(): AiContextProvider {
  return new AiContextProvider(new SupabaseAiContextRepository(), createEmbeddingClient());
}

export function emptyAiRuntimeContext(input: {
  promptKey?: string;
  fallbackReason: string;
}): AiRuntimeContext {
  return {
    conversationMessages: [],
    activePrompt: null,
    knowledgeBase: [],
    metadata: {
      loaded: false,
      promptKey: input.promptKey ?? 'domain_reply',
      messageCount: 0,
      knowledgeBaseCount: 0,
      knowledgeBaseIds: [],
      activePromptId: null,
      activePromptVersion: null,
      fallbackReason: input.fallbackReason,
    },
  };
}

type MessageRow = {
  id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'ai' | 'human' | 'system';
  content: string | null;
  transcript_text: string | null;
  message_type: string;
  created_at: string;
};

type PromptRow = {
  id: string;
  tenant_id: string | null;
  prompt_key: string;
  version: number;
  model: string;
  prompt_text: string;
};

type KnowledgeBaseRow = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  updated_at: string;
};

type KnowledgeBaseMatchRow = KnowledgeBaseRow & {
  similarity: number;
};

function selectActivePrompt(prompts: ActiveAiPrompt[], tenantId: string): ActiveAiPrompt | null {
  const tenantPrompt = prompts
    .filter((prompt) => prompt.tenantId === tenantId)
    .sort((left, right) => right.version - left.version)[0];

  if (tenantPrompt) {
    return tenantPrompt;
  }

  return (
    prompts
      .filter((prompt) => prompt.tenantId === null)
      .sort((left, right) => right.version - left.version)[0] ?? null
  );
}

function rankKnowledgeBase(input: {
  query: string;
  entries: Array<Omit<KnowledgeBaseSnippet, 'score'>>;
  limit: number;
}): KnowledgeBaseSnippet[] {
  const queryTokens = tokenSet(input.query);

  if (queryTokens.size === 0) {
    return [];
  }

  return input.entries
    .map((entry) => ({
      ...entry,
      score: scoreKnowledgeEntry(entry, queryTokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit);
}

function scoreKnowledgeEntry(
  entry: Omit<KnowledgeBaseSnippet, 'score'>,
  queryTokens: Set<string>,
): number {
  const titleTokens = tokenSet(entry.title);
  const contentTokens = tokenSet(entry.content);
  let score = 0;

  for (const token of queryTokens) {
    if (titleTokens.has(token)) {
      score += 3;
    }

    if (contentTokens.has(token)) {
      score += 1;
    }
  }

  return score;
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeForMatching(value)
      .split(' ')
      .filter((token) => token.length >= 4),
  );
}

function truncateConversationMessage(
  message: ConversationContextMessage,
): ConversationContextMessage {
  return {
    ...message,
    text: truncate(message.text, 600),
  };
}

function truncateKnowledgeSnippet(snippet: KnowledgeBaseSnippet): KnowledgeBaseSnippet {
  return {
    ...snippet,
    content: truncate(snippet.content, 900),
  };
}

function truncate(value: string, maxLength: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trim()}...`;
}

function toPgVector(embedding: number[]): string {
  return `[${embedding.map((value) => normalizeVectorNumber(value)).join(',')}]`;
}

function normalizeVectorNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new AppError('bad_request', 'Embedding vector contains an invalid value');
  }

  return String(value);
}

function senderTypeToRole(
  senderType: MessageRow['sender_type'],
): ConversationContextMessage['role'] {
  if (senderType === 'ai') {
    return 'assistant';
  }

  return senderType;
}

function normalizeForMatching(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
