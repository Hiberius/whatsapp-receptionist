import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { WhatsAppProvider } from '@/server/whatsapp/webhook-events';

export type TenantResolution = {
  tenantId: string;
  integrationId: string;
};

export type RecordWebhookEventInput = {
  tenantId: string | null;
  provider: WhatsAppProvider;
  eventType: 'message' | 'status';
  externalId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

export type RecordWebhookEventResult = {
  eventId: string | null;
  duplicate: boolean;
};

export type UpsertConversationInput = {
  tenantId: string;
  channel: 'whatsapp';
  customerIdentifier: string;
  customerName: string | null;
  lastMessageAt: Date;
  metadata: Record<string, unknown>;
};

export type UpsertConversationResult = {
  conversationId: string;
};

export type InsertInboundMessageInput = {
  tenantId: string;
  conversationId: string;
  externalId: string;
  messageType: 'text' | 'image' | 'audio' | 'document' | 'location';
  content: string | null;
  mediaUrls: string[];
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type InsertInboundMessageResult = {
  messageId: string | null;
  created: boolean;
};

export type TenantMessagingConfig = {
  assistantName: string;
  aiDisclosureEnabled: boolean;
  autoReplyEnabled: boolean;
  defaultLocale: string;
};

export type UpdateInboundMessageAnalysisInput = {
  tenantId: string;
  messageId: string;
  intent: string;
  confidence: number;
  tokensUsed?: number | null;
  costCents?: number | null;
  metadata: Record<string, unknown>;
};

export type InsertOutboundMessageInput = {
  tenantId: string;
  conversationId: string;
  externalId: string;
  content: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type InsertOutboundMessageResult = {
  messageId: string | null;
  created: boolean;
};

export type EnqueueOutboundMessageInput = {
  tenantId: string;
  messageId: string;
  recipientIdentifier: string;
  payload: Record<string, unknown>;
};

export type EnqueueOutboundMessageResult = {
  jobId: string | null;
  created: boolean;
};

export type EnqueueVoiceProcessingJobInput = {
  tenantId: string;
  messageId: string;
  mediaId: string;
  mediaMimeType: string | null;
  mediaSha256: string | null;
  payload: Record<string, unknown>;
};

export type EnqueueVoiceProcessingJobResult = {
  jobId: string | null;
  created: boolean;
};

export type WhatsAppMessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export type UpsertCustomerOptOutInput = {
  tenantId: string;
  channel: 'whatsapp';
  customerIdentifier: string;
  reason: string;
  optedOutAt: Date;
};

export interface WhatsAppWebhookRepository {
  recordWebhookEvent(input: RecordWebhookEventInput): Promise<RecordWebhookEventResult>;
  markWebhookEventProcessed(eventId: string, tenantId: string): Promise<void>;
  markWebhookEventFailed(
    eventId: string,
    error: { code: string; message: string },
    tenantId?: string,
  ): Promise<void>;
  resolveTenantByPhoneNumberId(phoneNumberId: string): Promise<TenantResolution | null>;
  upsertConversation(input: UpsertConversationInput): Promise<UpsertConversationResult>;
  insertInboundMessage(input: InsertInboundMessageInput): Promise<InsertInboundMessageResult>;
  updateInboundMessageAnalysis(input: UpdateInboundMessageAnalysisInput): Promise<void>;
  getTenantMessagingConfig(tenantId: string): Promise<TenantMessagingConfig>;
  isCustomerOptedOut(input: {
    tenantId: string;
    channel: 'whatsapp';
    customerIdentifier: string;
  }): Promise<boolean>;
  upsertCustomerOptOut(input: UpsertCustomerOptOutInput): Promise<void>;
  insertOutboundMessage(input: InsertOutboundMessageInput): Promise<InsertOutboundMessageResult>;
  enqueueOutboundMessage(input: EnqueueOutboundMessageInput): Promise<EnqueueOutboundMessageResult>;
  enqueueVoiceProcessingJob(
    input: EnqueueVoiceProcessingJobInput,
  ): Promise<EnqueueVoiceProcessingJobResult>;
  updateOutboundMessageStatus(input: {
    tenantId: string;
    providerMessageId: string;
    status: WhatsAppMessageStatus;
  }): Promise<void>;
  incrementUsage(input: {
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
    aiCostCentsDelta?: number;
  }): Promise<void>;
}

export class SupabaseWhatsAppWebhookRepository implements WhatsAppWebhookRepository {
  private readonly supabase = createSupabaseAdminClient();
  private readonly staleReceivedEventAfterMs = 60_000;

  async recordWebhookEvent(input: RecordWebhookEventInput): Promise<RecordWebhookEventResult> {
    const { data, error } = await this.supabase
      .from('webhook_events')
      .insert({
        tenant_id: input.tenantId,
        provider: input.provider,
        event_type: input.eventType,
        external_id: input.externalId,
        idempotency_key: input.idempotencyKey,
        payload: input.payload,
        status: 'received',
      })
      .select('id')
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return this.resolveExistingWebhookEvent(input);
      }

      throw toRepositoryError('Failed to record webhook event', error);
    }

    return { eventId: data.id as string, duplicate: false };
  }

  private async resolveExistingWebhookEvent(
    input: RecordWebhookEventInput,
  ): Promise<RecordWebhookEventResult> {
    const { data, error } = await this.supabase
      .from('webhook_events')
      .select('id, status, received_at')
      .eq('idempotency_key', input.idempotencyKey)
      .single();

    if (error) {
      throw toRepositoryError('Failed to read existing webhook event', error);
    }

    const status = data.status as 'received' | 'processed' | 'duplicate' | 'failed';
    const receivedAt = Date.parse(data.received_at as string);
    const isStaleReceived =
      status === 'received' &&
      Number.isFinite(receivedAt) &&
      Date.now() - receivedAt > this.staleReceivedEventAfterMs;

    if (status === 'failed' || isStaleReceived) {
      const update = await this.supabase
        .from('webhook_events')
        .update({
          tenant_id: input.tenantId,
          status: 'received',
          payload: input.payload,
          error_code: null,
          error_message: null,
          received_at: new Date().toISOString(),
          processed_at: null,
        })
        .eq('id', data.id);

      if (update.error) {
        throw toRepositoryError('Failed to reset webhook event for retry', update.error);
      }

      return { eventId: data.id as string, duplicate: false };
    }

    return { eventId: data.id as string, duplicate: true };
  }

  async markWebhookEventProcessed(eventId: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from('webhook_events')
      .update({
        tenant_id: tenantId,
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) {
      throw toRepositoryError('Failed to mark webhook event processed', error);
    }
  }

  async markWebhookEventFailed(
    eventId: string,
    errorInput: { code: string; message: string },
    tenantId?: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('webhook_events')
      .update({
        ...(tenantId ? { tenant_id: tenantId } : {}),
        status: 'failed',
        error_code: errorInput.code,
        error_message: errorInput.message,
        processed_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) {
      throw toRepositoryError('Failed to mark webhook event failed', error);
    }
  }

  async resolveTenantByPhoneNumberId(phoneNumberId: string): Promise<TenantResolution | null> {
    const direct = await this.supabase
      .from('integrations')
      .select('id, tenant_id')
      .eq('provider', 'whatsapp_360dialog')
      .eq('status', 'active')
      .eq('external_account_id', phoneNumberId)
      .maybeSingle();

    if (direct.error) {
      throw toRepositoryError('Failed to resolve WhatsApp tenant', direct.error);
    }

    if (direct.data) {
      return {
        integrationId: direct.data.id as string,
        tenantId: direct.data.tenant_id as string,
      };
    }

    const fallback = await this.supabase
      .from('integrations')
      .select('id, tenant_id')
      .eq('provider', 'whatsapp_360dialog')
      .eq('status', 'active')
      .contains('config', { phone_number_id: phoneNumberId })
      .maybeSingle();

    if (fallback.error) {
      throw toRepositoryError('Failed to resolve WhatsApp tenant', fallback.error);
    }

    if (!fallback.data) {
      return null;
    }

    return {
      integrationId: fallback.data.id as string,
      tenantId: fallback.data.tenant_id as string,
    };
  }

  async upsertConversation(input: UpsertConversationInput): Promise<UpsertConversationResult> {
    const existing = await this.supabase
      .from('conversations')
      .select('id, metadata')
      .eq('tenant_id', input.tenantId)
      .eq('channel', input.channel)
      .eq('customer_identifier', input.customerIdentifier)
      .maybeSingle();

    if (existing.error) {
      throw toRepositoryError('Failed to read WhatsApp conversation', existing.error);
    }

    if (existing.data?.id) {
      const metadata = {
        ...toPlainRecord(existing.data.metadata),
        ...input.metadata,
      };
      const { data, error } = await this.supabase
        .from('conversations')
        .update({
          customer_name: input.customerName,
          last_message_at: input.lastMessageAt.toISOString(),
          metadata,
          status: 'active',
        })
        .eq('id', existing.data.id)
        .eq('tenant_id', input.tenantId)
        .select('id')
        .single();

      if (error) {
        throw toRepositoryError('Failed to update WhatsApp conversation', error);
      }

      return { conversationId: data.id as string };
    }

    const { data, error } = await this.supabase
      .from('conversations')
      .insert({
        tenant_id: input.tenantId,
        channel: input.channel,
        customer_identifier: input.customerIdentifier,
        customer_name: input.customerName,
        last_message_at: input.lastMessageAt.toISOString(),
        metadata: input.metadata,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) {
      throw toRepositoryError('Failed to insert WhatsApp conversation', error);
    }

    return { conversationId: data.id as string };
  }

  async insertInboundMessage(
    input: InsertInboundMessageInput,
  ): Promise<InsertInboundMessageResult> {
    const { data, error } = await this.supabase
      .from('messages')
      .upsert(
        {
          tenant_id: input.tenantId,
          conversation_id: input.conversationId,
          direction: 'inbound',
          sender_type: 'customer',
          content: input.content,
          media_urls: input.mediaUrls,
          message_type: input.messageType,
          status: 'received',
          external_id: input.externalId,
          metadata: input.metadata,
          created_at: input.createdAt.toISOString(),
        },
        {
          onConflict: 'tenant_id,external_id',
          ignoreDuplicates: true,
        },
      )
      .select('id')
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to insert inbound WhatsApp message', error);
    }

    return {
      messageId: (data?.id as string | undefined) ?? null,
      created: Boolean(data?.id),
    };
  }

  async updateInboundMessageAnalysis(input: UpdateInboundMessageAnalysisInput): Promise<void> {
    const { error } = await this.supabase
      .from('messages')
      .update({
        intent: input.intent,
        confidence: input.confidence,
        tokens_used: input.tokensUsed ?? null,
        cost_cents: input.costCents ?? null,
        metadata: input.metadata,
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.messageId)
      .eq('direction', 'inbound');

    if (error) {
      throw toRepositoryError('Failed to update WhatsApp message analysis', error);
    }
  }

  async getTenantMessagingConfig(tenantId: string): Promise<TenantMessagingConfig> {
    const { data, error } = await this.supabase
      .from('tenant_config')
      .select('assistant_name, ai_disclosure_enabled, auto_reply_enabled, default_locale')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read tenant messaging config', error);
    }

    return {
      assistantName: (data?.assistant_name as string | undefined) ?? 'Ambrogio',
      aiDisclosureEnabled: (data?.ai_disclosure_enabled as boolean | undefined) ?? true,
      autoReplyEnabled: (data?.auto_reply_enabled as boolean | undefined) ?? false,
      defaultLocale: (data?.default_locale as string | undefined) ?? 'it-IT',
    };
  }

  async isCustomerOptedOut(input: {
    tenantId: string;
    channel: 'whatsapp';
    customerIdentifier: string;
  }): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('opt_outs')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('channel', input.channel)
      .eq('customer_identifier', input.customerIdentifier)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read WhatsApp opt-out state', error);
    }

    return Boolean(data?.id);
  }

  async upsertCustomerOptOut(input: UpsertCustomerOptOutInput): Promise<void> {
    const { error } = await this.supabase.from('opt_outs').upsert(
      {
        tenant_id: input.tenantId,
        channel: input.channel,
        customer_identifier: input.customerIdentifier,
        reason: input.reason,
        opted_out_at: input.optedOutAt.toISOString(),
      },
      {
        onConflict: 'tenant_id,channel,customer_identifier',
      },
    );

    if (error) {
      throw toRepositoryError('Failed to persist WhatsApp opt-out', error);
    }
  }

  async insertOutboundMessage(
    input: InsertOutboundMessageInput,
  ): Promise<InsertOutboundMessageResult> {
    const { data, error } = await this.supabase
      .from('messages')
      .upsert(
        {
          tenant_id: input.tenantId,
          conversation_id: input.conversationId,
          direction: 'outbound',
          sender_type: 'ai',
          content: input.content,
          media_urls: [],
          message_type: 'text',
          status: 'pending',
          external_id: input.externalId,
          metadata: input.metadata,
          created_at: input.createdAt.toISOString(),
        },
        {
          onConflict: 'tenant_id,external_id',
          ignoreDuplicates: true,
        },
      )
      .select('id')
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to insert outbound WhatsApp message', error);
    }

    return {
      messageId: (data?.id as string | undefined) ?? null,
      created: Boolean(data?.id),
    };
  }

  async enqueueOutboundMessage(
    input: EnqueueOutboundMessageInput,
  ): Promise<EnqueueOutboundMessageResult> {
    const { data, error } = await this.supabase
      .from('whatsapp_outbox_jobs')
      .upsert(
        {
          tenant_id: input.tenantId,
          message_id: input.messageId,
          recipient_identifier: input.recipientIdentifier,
          payload: input.payload,
          status: 'pending',
        },
        {
          onConflict: 'message_id',
          ignoreDuplicates: true,
        },
      )
      .select('id')
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to enqueue WhatsApp outbound message', error);
    }

    return {
      jobId: (data?.id as string | undefined) ?? null,
      created: Boolean(data?.id),
    };
  }

  async enqueueVoiceProcessingJob(
    input: EnqueueVoiceProcessingJobInput,
  ): Promise<EnqueueVoiceProcessingJobResult> {
    const { data, error } = await this.supabase
      .from('whatsapp_voice_jobs')
      .upsert(
        {
          tenant_id: input.tenantId,
          message_id: input.messageId,
          media_id: input.mediaId,
          media_mime_type: input.mediaMimeType,
          media_sha256: input.mediaSha256,
          payload: input.payload,
          status: 'pending',
        },
        {
          onConflict: 'message_id',
          ignoreDuplicates: true,
        },
      )
      .select('id')
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to enqueue WhatsApp voice message', error);
    }

    return {
      jobId: (data?.id as string | undefined) ?? null,
      created: Boolean(data?.id),
    };
  }

  async updateOutboundMessageStatus(input: {
    tenantId: string;
    providerMessageId: string;
    status: WhatsAppMessageStatus;
  }): Promise<void> {
    const primary = await this.supabase
      .from('messages')
      .update({ status: input.status })
      .eq('tenant_id', input.tenantId)
      .eq('provider_message_id', input.providerMessageId)
      .eq('direction', 'outbound')
      .select('id')
      .maybeSingle();

    if (primary.error) {
      throw toRepositoryError('Failed to update outbound WhatsApp status', primary.error);
    }

    if (primary.data) {
      return;
    }

    const fallback = await this.supabase
      .from('messages')
      .update({ status: input.status })
      .eq('tenant_id', input.tenantId)
      .eq('external_id', `outbound:${input.providerMessageId}`)
      .eq('direction', 'outbound');

    if (fallback.error) {
      throw toRepositoryError('Failed to update outbound WhatsApp status', fallback.error);
    }
  }

  async incrementUsage(input: {
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
    aiCostCentsDelta?: number;
  }): Promise<void> {
    const { error } = await this.supabase.rpc('increment_usage_metrics', {
      p_tenant_id: input.tenantId,
      p_metric_month: input.metricMonth,
      p_messages_delta: input.messagesDelta,
      p_conversations_delta: 0,
      p_ai_cost_cents_delta: input.aiCostCentsDelta ?? 0,
    });

    if (error) {
      throw toRepositoryError('Failed to increment usage metrics', error);
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
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
