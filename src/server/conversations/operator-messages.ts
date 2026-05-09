// Fatto da Claude Code il 27 aprile 2026.
//
// Invio manuale operatore dall'inbox. Step 3 dell'handoff Codex.
//
// Vincoli applicati upfront (prima di accodare nel worker outbox):
// - solo owner/admin del tenant possono inviare;
// - conversazione deve esistere ed essere tenant-scoped;
// - se il customer e' opted-out, non si invia;
// - canale supportato in MVP: solo WhatsApp;
// - free-form solo dentro la customer service window 24h dall'ultimo
//   messaggio inbound. Fuori finestra il template manuale NON e' ancora
//   supportato (i template reali devono essere approvati prima);
// - lunghezza testo allineata al limite WhatsApp text body (4096 char);
// - external_id sempre unico per evitare doppi invii in caso di doppio click.
//
// Sender_type del messaggio inserito: 'human' (gia' previsto dal check
// constraint su public.messages).

import { randomUUID } from 'node:crypto';

import type { AuthSession } from '@/lib/auth/session';
import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type OperatorMessageChannel = 'whatsapp';
export type ConversationChannel = 'whatsapp' | 'instagram_dm' | 'web_chat' | 'sms';

export type SendOperatorMessageInput = {
  session: AuthSession;
  conversationId: string;
  content: string;
  ipAddress: string | null;
  userAgent: string | null;
  now?: Date;
};

export type SendOperatorMessageResult = {
  messageId: string;
  externalId: string;
  conversationId: string;
  enqueuedJobId: string | null;
  customerServiceWindowExpiresAt: string;
};

export type OperatorConversationSnapshot = {
  conversationId: string;
  tenantId: string;
  channel: ConversationChannel;
  customerIdentifier: string;
  lastMessageAt: string;
};

export type OperatorMessageInsertInput = {
  tenantId: string;
  conversationId: string;
  externalId: string;
  content: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type OperatorMessageInsertResult = {
  messageId: string;
  created: boolean;
};

export type OperatorOutboxEnqueueInput = {
  tenantId: string;
  messageId: string;
  recipientIdentifier: string;
  payload: Record<string, unknown>;
};

export type OperatorOutboxEnqueueResult = {
  jobId: string | null;
  created: boolean;
};

export type OperatorAuditLogInput = {
  tenantId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
};

export interface OperatorMessagesRepository {
  getConversation(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<OperatorConversationSnapshot | null>;
  isCustomerOptedOut(input: {
    tenantId: string;
    channel: OperatorMessageChannel;
    customerIdentifier: string;
  }): Promise<boolean>;
  insertOperatorMessage(input: OperatorMessageInsertInput): Promise<OperatorMessageInsertResult>;
  enqueueOutboundMessage(input: OperatorOutboxEnqueueInput): Promise<OperatorOutboxEnqueueResult>;
  recordAuditLog(input: OperatorAuditLogInput): Promise<void>;
}

export const WHATSAPP_TEXT_MAX_LENGTH = 4096;
export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export class OperatorMessagesService {
  constructor(private readonly repository: OperatorMessagesRepository) {}

  async sendMessage(input: SendOperatorMessageInput): Promise<SendOperatorMessageResult> {
    if (input.session.role !== 'owner' && input.session.role !== 'admin') {
      throw new AppError('forbidden', 'Owner or admin role is required');
    }

    const content = normalizeContent(input.content);
    const now = input.now ?? new Date();

    const conversation = await this.repository.getConversation({
      tenantId: input.session.tenantId,
      conversationId: input.conversationId,
    });

    if (!conversation) {
      throw new AppError('not_found', 'Conversation not found');
    }

    if (conversation.channel !== 'whatsapp') {
      throw new AppError(
        'bad_request',
        'Manual operator messaging is only available for WhatsApp in MVP',
      );
    }

    const optedOut = await this.repository.isCustomerOptedOut({
      tenantId: conversation.tenantId,
      channel: conversation.channel,
      customerIdentifier: conversation.customerIdentifier,
    });

    if (optedOut) {
      throw new AppError('forbidden', 'Customer has opted out of WhatsApp messages');
    }

    const windowExpiresAt = new Date(
      Date.parse(conversation.lastMessageAt) + CUSTOMER_SERVICE_WINDOW_MS,
    );

    if (Number.isNaN(windowExpiresAt.getTime())) {
      throw new AppError('upstream_error', 'Invalid customer service window timestamp', {
        expose: false,
      });
    }

    if (windowExpiresAt.getTime() <= now.getTime()) {
      throw new AppError(
        'conflict',
        'Customer service window is closed. Send an approved template instead (not yet supported).',
      );
    }

    const externalId = `manual:${randomUUID()}`;
    const inserted = await this.repository.insertOperatorMessage({
      tenantId: conversation.tenantId,
      conversationId: conversation.conversationId,
      externalId,
      content,
      createdAt: now,
      metadata: {
        source: 'manual_operator',
        operatorUserId: input.session.userId,
      },
    });

    if (!inserted.created) {
      throw new AppError('upstream_error', 'Operator message persistence returned no row', {
        expose: false,
      });
    }

    const enqueueResult = await this.repository.enqueueOutboundMessage({
      tenantId: conversation.tenantId,
      messageId: inserted.messageId,
      recipientIdentifier: conversation.customerIdentifier,
      payload: {
        type: 'text',
        text: { body: content },
        metadata: {
          source: 'manual_operator',
          operatorUserId: input.session.userId,
          conversationId: conversation.conversationId,
        },
      },
    });

    await this.repository.recordAuditLog({
      tenantId: conversation.tenantId,
      userId: input.session.userId,
      action: 'conversations.message.sent',
      resourceType: 'message',
      resourceId: inserted.messageId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {
        conversationId: conversation.conversationId,
        externalId,
        senderType: 'human',
        channel: conversation.channel,
        contentLength: content.length,
        windowExpiresAt: windowExpiresAt.toISOString(),
      },
    });

    return {
      messageId: inserted.messageId,
      externalId,
      conversationId: conversation.conversationId,
      enqueuedJobId: enqueueResult.jobId,
      customerServiceWindowExpiresAt: windowExpiresAt.toISOString(),
    };
  }
}

function normalizeContent(content: string): string {
  const trimmed = content.replace(/ /g, ' ').trim();

  if (trimmed.length === 0) {
    throw new AppError('bad_request', 'Message content is required');
  }

  if (trimmed.length > WHATSAPP_TEXT_MAX_LENGTH) {
    throw new AppError(
      'bad_request',
      `Message content exceeds ${WHATSAPP_TEXT_MAX_LENGTH} characters`,
    );
  }

  return trimmed;
}

export class SupabaseOperatorMessagesRepository implements OperatorMessagesRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getConversation(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<OperatorConversationSnapshot | null> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('id, tenant_id, channel, customer_identifier, last_message_at')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.conversationId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read conversation', error);
    }

    if (!data) {
      return null;
    }

    return {
      conversationId: data.id as string,
      tenantId: data.tenant_id as string,
      channel: normalizeChannel(data.channel as string),
      customerIdentifier: data.customer_identifier as string,
      lastMessageAt: String(data.last_message_at),
    };
  }

  async isCustomerOptedOut(input: {
    tenantId: string;
    channel: OperatorMessageChannel;
    customerIdentifier: string;
  }): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('opt_outs')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('channel', input.channel)
      .eq('customer_identifier', input.customerIdentifier)
      .limit(1);

    if (error) {
      throw toRepositoryError('Failed to read opt-out status', error);
    }

    return Array.isArray(data) && data.length > 0;
  }

  async insertOperatorMessage(
    input: OperatorMessageInsertInput,
  ): Promise<OperatorMessageInsertResult> {
    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        tenant_id: input.tenantId,
        conversation_id: input.conversationId,
        direction: 'outbound',
        sender_type: 'human',
        content: input.content,
        media_urls: [],
        message_type: 'text',
        status: 'pending',
        external_id: input.externalId,
        metadata: input.metadata,
        created_at: input.createdAt.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw toRepositoryError('Failed to insert operator message', error);
    }

    return {
      messageId: String(data.id),
      created: true,
    };
  }

  async enqueueOutboundMessage(
    input: OperatorOutboxEnqueueInput,
  ): Promise<OperatorOutboxEnqueueResult> {
    const { data, error } = await this.supabase
      .from('whatsapp_outbox_jobs')
      .insert({
        tenant_id: input.tenantId,
        message_id: input.messageId,
        recipient_identifier: input.recipientIdentifier,
        payload: input.payload,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      throw toRepositoryError('Failed to enqueue manual operator outbound message', error);
    }

    return {
      jobId: String(data.id),
      created: true,
    };
  }

  async recordAuditLog(input: OperatorAuditLogInput): Promise<void> {
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
      throw toRepositoryError('Failed to write operator message audit log', error);
    }
  }
}

export function createOperatorMessagesService(): OperatorMessagesService {
  return new OperatorMessagesService(new SupabaseOperatorMessagesRepository());
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}

function normalizeChannel(value: string): ConversationChannel {
  if (value === 'whatsapp' || value === 'instagram_dm' || value === 'web_chat' || value === 'sms') {
    return value;
  }

  throw new AppError('upstream_error', `Unknown conversation channel: ${value}`, {
    expose: false,
  });
}
