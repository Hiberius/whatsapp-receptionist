import { AppError } from '@/lib/errors/app-error';
import type { AuthSession } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type ConversationChannel = 'whatsapp' | 'instagram_dm' | 'web_chat' | 'sms';
export type ConversationStatus = 'active' | 'escalated' | 'closed' | 'spam';

export type ConversationSummary = {
  id: string;
  channel: ConversationChannel;
  customerIdentifier: string;
  customerName: string | null;
  status: ConversationStatus;
  aiEnabled: boolean;
  lastMessageAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  senderType: 'customer' | 'ai' | 'human' | 'system';
  content: string | null;
  mediaUrls: string[];
  messageType: 'text' | 'image' | 'audio' | 'document' | 'location' | 'status';
  status: 'received' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  transcriptText: string | null;
  transcriptLanguage: string | null;
  audioDurationSecs: number | null;
  generatedAudioUrl: string | null;
  voiceId: string | null;
  voiceModelId: string | null;
  intent: string | null;
  confidence: number | null;
  tokensUsed: number | null;
  costCents: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ConversationDetail = {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
};

export type ListConversationsResult = {
  conversations: ConversationSummary[];
  nextCursor: string | null;
};

export type ListConversationsInput = {
  status?: ConversationStatus;
  channel?: ConversationChannel;
  limit?: number;
  before?: Date | null;
};

export type UpdateConversationInput = Partial<{
  status: ConversationStatus;
  aiEnabled: boolean;
  customerName: string | null;
}>;

export type ConversationInboxRepository = {
  listConversations(input: {
    tenantId: string;
    filters: Required<Pick<ListConversationsInput, 'limit'>> &
      Omit<ListConversationsInput, 'limit'>;
  }): Promise<ConversationSummary[]>;
  getConversation(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<ConversationSummary | null>;
  listMessages(input: {
    tenantId: string;
    conversationId: string;
    limit: number;
  }): Promise<ConversationMessage[]>;
  updateConversation(input: {
    tenantId: string;
    conversationId: string;
    patch: UpdateConversationNormalized;
  }): Promise<ConversationSummary | null>;
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

type UpdateConversationNormalized = Partial<{
  status: ConversationStatus;
  aiEnabled: boolean;
  customerName: string | null;
}>;

export class ConversationInboxService {
  constructor(private readonly repository: ConversationInboxRepository) {}

  async listConversations(input: {
    session: AuthSession;
    filters?: ListConversationsInput;
  }): Promise<ListConversationsResult> {
    const limit = normalizeLimit(input.filters?.limit ?? 30, 1, 100);
    const conversations = await this.repository.listConversations({
      tenantId: input.session.tenantId,
      filters: {
        limit,
        ...(input.filters?.status !== undefined ? { status: input.filters.status } : {}),
        ...(input.filters?.channel !== undefined ? { channel: input.filters.channel } : {}),
        before: input.filters?.before ?? null,
      },
    });
    const nextCursor =
      conversations.length === limit
        ? (conversations[conversations.length - 1]?.lastMessageAt ?? null)
        : null;

    return {
      conversations,
      nextCursor,
    };
  }

  async getConversation(input: {
    session: AuthSession;
    conversationId: string;
    messageLimit?: number;
  }): Promise<ConversationDetail> {
    const conversation = await this.repository.getConversation({
      tenantId: input.session.tenantId,
      conversationId: input.conversationId,
    });

    if (!conversation) {
      throw new AppError('not_found', 'Conversation not found');
    }

    const messages = await this.repository.listMessages({
      tenantId: input.session.tenantId,
      conversationId: input.conversationId,
      limit: normalizeLimit(input.messageLimit ?? 100, 1, 200),
    });

    return {
      conversation,
      messages,
    };
  }

  async updateConversation(input: {
    session: AuthSession;
    conversationId: string;
    patch: UpdateConversationInput;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<ConversationSummary> {
    assertConversationAdmin(input.session);
    const patch = normalizeConversationPatch(input.patch);

    if (Object.keys(patch).length === 0) {
      throw new AppError('bad_request', 'Conversation update payload is empty');
    }

    const conversation = await this.repository.updateConversation({
      tenantId: input.session.tenantId,
      conversationId: input.conversationId,
      patch,
    });

    if (!conversation) {
      throw new AppError('not_found', 'Conversation not found');
    }

    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'conversations.conversation.updated',
      resourceType: 'conversation',
      resourceId: conversation.id,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        fields: Object.keys(patch),
        status: conversation.status,
        aiEnabled: conversation.aiEnabled,
      },
    });

    return conversation;
  }
}

export class SupabaseConversationInboxRepository implements ConversationInboxRepository {
  private readonly supabase = createSupabaseAdminClient();

  async listConversations(input: {
    tenantId: string;
    filters: Required<Pick<ListConversationsInput, 'limit'>> &
      Omit<ListConversationsInput, 'limit'>;
  }): Promise<ConversationSummary[]> {
    let query = this.supabase
      .from('conversations')
      .select(
        'id, channel, customer_identifier, customer_name, status, ai_enabled, last_message_at, metadata, created_at, updated_at',
      )
      .eq('tenant_id', input.tenantId)
      .order('last_message_at', { ascending: false })
      .limit(input.filters.limit);

    if (input.filters.status) {
      query = query.eq('status', input.filters.status);
    }

    if (input.filters.channel) {
      query = query.eq('channel', input.filters.channel);
    }

    if (input.filters.before) {
      query = query.lt('last_message_at', input.filters.before.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw toRepositoryError('Failed to list conversations', error);
    }

    return ((data ?? []) as ConversationRow[]).map(conversationFromRow);
  }

  async getConversation(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<ConversationSummary | null> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select(
        'id, channel, customer_identifier, customer_name, status, ai_enabled, last_message_at, metadata, created_at, updated_at',
      )
      .eq('tenant_id', input.tenantId)
      .eq('id', input.conversationId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read conversation', error);
    }

    return data ? conversationFromRow(data as ConversationRow) : null;
  }

  async listMessages(input: {
    tenantId: string;
    conversationId: string;
    limit: number;
  }): Promise<ConversationMessage[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select(
        'id, direction, sender_type, content, media_urls, message_type, status, transcript_text, transcript_language, audio_duration_secs, generated_audio_url, voice_id, voice_model_id, intent, confidence, tokens_used, cost_cents, metadata, created_at, updated_at',
      )
      .eq('tenant_id', input.tenantId)
      .eq('conversation_id', input.conversationId)
      .order('created_at', { ascending: true })
      .limit(input.limit);

    if (error) {
      throw toRepositoryError('Failed to list conversation messages', error);
    }

    // Il select sopra usa una stringa literal: Supabase produce un tipo
    // strutturalmente compatibile con MessageRow ma non identico (i campi
    // sono tutti `unknown` finché non sappiamo che non ci sono errori
    // typed-route). Single-cast diretto invece di doppio cast via unknown.
    return ((data ?? []) as MessageRow[]).map(messageFromRow);
  }

  async updateConversation(input: {
    tenantId: string;
    conversationId: string;
    patch: UpdateConversationNormalized;
  }): Promise<ConversationSummary | null> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.patch.status !== undefined) {
      patch.status = input.patch.status;
    }

    if (input.patch.aiEnabled !== undefined) {
      patch.ai_enabled = input.patch.aiEnabled;
    }

    if (input.patch.customerName !== undefined) {
      patch.customer_name = input.patch.customerName;
    }

    const { data, error } = await this.supabase
      .from('conversations')
      .update(patch)
      .eq('tenant_id', input.tenantId)
      .eq('id', input.conversationId)
      .select(
        'id, channel, customer_identifier, customer_name, status, ai_enabled, last_message_at, metadata, created_at, updated_at',
      )
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to update conversation', error);
    }

    return data ? conversationFromRow(data as ConversationRow) : null;
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
      throw toRepositoryError('Failed to write conversation audit log', error);
    }
  }
}

export function createConversationInboxService(): ConversationInboxService {
  return new ConversationInboxService(new SupabaseConversationInboxRepository());
}

type ConversationRow = {
  id: string;
  channel: ConversationChannel;
  customer_identifier: string;
  customer_name: string | null;
  status: ConversationStatus;
  ai_enabled: boolean;
  last_message_at: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'ai' | 'human' | 'system';
  content: string | null;
  media_urls: string[] | null;
  message_type: 'text' | 'image' | 'audio' | 'document' | 'location' | 'status';
  status: 'received' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  transcript_text: string | null;
  transcript_language: string | null;
  audio_duration_secs: number | string | null;
  generated_audio_url: string | null;
  voice_id: string | null;
  voice_model_id: string | null;
  intent: string | null;
  confidence: number | string | null;
  tokens_used: number | null;
  cost_cents: number | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

function assertConversationAdmin(
  session: AuthSession,
): asserts session is AuthSession & { role: 'owner' | 'admin' } {
  if (session.role !== 'owner' && session.role !== 'admin') {
    throw new AppError('forbidden', 'Admin role required');
  }
}

function normalizeConversationPatch(input: UpdateConversationInput): UpdateConversationNormalized {
  const patch: UpdateConversationNormalized = {};

  if (input.status !== undefined) {
    patch.status = input.status;
  }

  if (input.aiEnabled !== undefined) {
    patch.aiEnabled = input.aiEnabled;
  }

  if (input.customerName !== undefined) {
    patch.customerName = normalizeNullableText(input.customerName, 120);
  }

  return patch;
}

function normalizeLimit(value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AppError('bad_request', 'Limit is out of range');
  }

  return value;
}

function normalizeNullableText(value: string | null | undefined, maxLength: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new AppError('bad_request', 'Text value is too long');
  }

  return normalized;
}

function conversationFromRow(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    channel: row.channel,
    customerIdentifier: row.customer_identifier,
    customerName: row.customer_name,
    status: row.status,
    aiEnabled: row.ai_enabled,
    lastMessageAt: row.last_message_at,
    metadata: toPlainRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function messageFromRow(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    direction: row.direction,
    senderType: row.sender_type,
    content: row.content,
    mediaUrls: row.media_urls ?? [],
    messageType: row.message_type,
    status: row.status,
    transcriptText: row.transcript_text,
    transcriptLanguage: row.transcript_language,
    audioDurationSecs: nullableNumber(row.audio_duration_secs),
    generatedAudioUrl: row.generated_audio_url,
    voiceId: row.voice_id,
    voiceModelId: row.voice_model_id,
    intent: row.intent,
    confidence: nullableNumber(row.confidence),
    tokensUsed: row.tokens_used,
    costCents: row.cost_cents,
    metadata: toPlainRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function nullableNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toPlainRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
