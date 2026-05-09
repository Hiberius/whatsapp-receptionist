import { AppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { WhatsAppProvider } from '@/server/whatsapp/webhook-events';

export type ClaimedWhatsAppVoiceJob = {
  id: string;
  tenantId: string;
  messageId: string;
  mediaId: string;
  mediaMimeType: string | null;
  mediaSha256: string | null;
  payload: unknown;
  attemptCount: number;
  maxAttempts: number;
};

export type CreateVoiceEventInput = {
  tenantId: string;
  messageId: string;
  model: string;
  metadata: Record<string, unknown>;
};

export type UpdateMessageTranscriptInput = {
  tenantId: string;
  messageId: string;
  transcriptText: string;
  transcriptLanguage: string | null;
  audioDurationSecs: number | null;
  mediaUri: string;
  metadata: Record<string, unknown>;
};

export type WhatsAppVoiceReplyContext = {
  tenantId: string;
  conversationId: string;
  messageId: string;
  externalId: string;
  customerIdentifier: string;
  createdAt: Date;
  transcriptText: string | null;
  transcriptLanguage: string | null;
  transcriptLanguageProbability: number | null;
  provider: WhatsAppProvider;
  whatsappMessageId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  metadata: Record<string, unknown>;
};

export interface WhatsAppVoiceRepository {
  claimReadyJobs(input: {
    limit: number;
    lockId: string;
    lockTtlSeconds: number;
  }): Promise<ClaimedWhatsAppVoiceJob[]>;
  getVoiceReplyContext(input: {
    tenantId: string;
    messageId: string;
  }): Promise<WhatsAppVoiceReplyContext | null>;
  createVoiceEvent(input: CreateVoiceEventInput): Promise<string>;
  markVoiceEventCompleted(input: {
    voiceEventId: string;
    audioDurationSecs: number | null;
    metadata: Record<string, unknown>;
  }): Promise<void>;
  markVoiceEventFailed(input: {
    voiceEventId: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
  updateMessageTranscript(input: UpdateMessageTranscriptInput): Promise<void>;
  markJobCompleted(jobId: string): Promise<void>;
  scheduleJobRetry(input: {
    jobId: string;
    nextAttemptAt: Date;
    error: { code: string; message: string };
  }): Promise<void>;
  markJobDeadLetter(input: {
    jobId: string;
    error: { code: string; message: string };
  }): Promise<void>;
}

type ClaimedWhatsAppVoiceJobRow = {
  id: string;
  tenant_id: string;
  message_id: string;
  media_id: string;
  media_mime_type: string | null;
  media_sha256: string | null;
  payload: unknown;
  attempt_count: number;
  max_attempts: number;
};

type VoiceMessageRow = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  external_id: string | null;
  created_at: string;
  transcript_text: string | null;
  transcript_language: string | null;
  metadata: unknown;
};

type VoiceConversationRow = {
  customer_identifier: string;
};

export class SupabaseWhatsAppVoiceRepository implements WhatsAppVoiceRepository {
  private readonly supabase = createSupabaseAdminClient();

  async claimReadyJobs(input: {
    limit: number;
    lockId: string;
    lockTtlSeconds: number;
  }): Promise<ClaimedWhatsAppVoiceJob[]> {
    const { data, error } = await this.supabase.rpc('claim_whatsapp_voice_jobs', {
      p_limit: input.limit,
      p_lock_id: input.lockId,
      p_lock_ttl_seconds: input.lockTtlSeconds,
    });

    if (error) {
      throw toRepositoryError('Failed to claim WhatsApp voice jobs', error);
    }

    return ((data ?? []) as ClaimedWhatsAppVoiceJobRow[]).map((job) => ({
      id: job.id,
      tenantId: job.tenant_id,
      messageId: job.message_id,
      mediaId: job.media_id,
      mediaMimeType: job.media_mime_type,
      mediaSha256: job.media_sha256,
      payload: job.payload,
      attemptCount: job.attempt_count,
      maxAttempts: job.max_attempts,
    }));
  }

  async getVoiceReplyContext(input: {
    tenantId: string;
    messageId: string;
  }): Promise<WhatsAppVoiceReplyContext | null> {
    const message = await this.supabase
      .from('messages')
      .select(
        'id, tenant_id, conversation_id, external_id, created_at, transcript_text, transcript_language, metadata',
      )
      .eq('tenant_id', input.tenantId)
      .eq('id', input.messageId)
      .eq('direction', 'inbound')
      .eq('message_type', 'audio')
      .maybeSingle();

    if (message.error) {
      throw toRepositoryError('Failed to read WhatsApp voice message', message.error);
    }

    if (!message.data) {
      return null;
    }

    const row = message.data as VoiceMessageRow;
    const conversation = await this.supabase
      .from('conversations')
      .select('customer_identifier')
      .eq('tenant_id', input.tenantId)
      .eq('id', row.conversation_id)
      .maybeSingle();

    if (conversation.error) {
      throw toRepositoryError('Failed to read WhatsApp voice conversation', conversation.error);
    }

    if (!conversation.data) {
      return null;
    }

    const metadata = asRecord(row.metadata);
    const whatsappVoice = asRecord(metadata.whatsappVoice);
    const payload = asRecord(whatsappVoice.payload);
    const transcript = asRecord(whatsappVoice.transcript);

    return {
      tenantId: row.tenant_id,
      conversationId: row.conversation_id,
      messageId: row.id,
      externalId: row.external_id ?? row.id,
      customerIdentifier: (conversation.data as VoiceConversationRow).customer_identifier,
      createdAt: new Date(row.created_at),
      transcriptText: row.transcript_text,
      transcriptLanguage: row.transcript_language,
      transcriptLanguageProbability: getOptionalNumber(transcript.languageProbability),
      provider: 'whatsapp_360dialog',
      whatsappMessageId: getOptionalString(payload.whatsappMessageId),
      phoneNumberId: getOptionalString(payload.phoneNumberId),
      displayPhoneNumber: getOptionalString(payload.displayPhoneNumber),
      metadata,
    };
  }

  async createVoiceEvent(input: CreateVoiceEventInput): Promise<string> {
    const { data, error } = await this.supabase
      .from('voice_events')
      .insert({
        tenant_id: input.tenantId,
        message_id: input.messageId,
        provider: 'elevenlabs',
        direction: 'stt',
        model: input.model,
        status: 'pending',
        metadata: input.metadata,
      })
      .select('id')
      .single();

    if (error) {
      throw toRepositoryError('Failed to create voice event', error);
    }

    return data.id as string;
  }

  async markVoiceEventCompleted(input: {
    voiceEventId: string;
    audioDurationSecs: number | null;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('voice_events')
      .update({
        status: 'completed',
        audio_duration_secs: input.audioDurationSecs,
        metadata: input.metadata,
      })
      .eq('id', input.voiceEventId);

    if (error) {
      throw toRepositoryError('Failed to complete voice event', error);
    }
  }

  async markVoiceEventFailed(input: {
    voiceEventId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('voice_events')
      .update({
        status: 'failed',
        metadata: input.metadata,
      })
      .eq('id', input.voiceEventId);

    if (error) {
      throw toRepositoryError('Failed to fail voice event', error);
    }
  }

  async updateMessageTranscript(input: UpdateMessageTranscriptInput): Promise<void> {
    const { error } = await this.supabase
      .from('messages')
      .update({
        transcript_text: input.transcriptText,
        transcript_language: input.transcriptLanguage,
        audio_duration_secs: input.audioDurationSecs,
        media_urls: [input.mediaUri],
        metadata: input.metadata,
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.messageId)
      .eq('direction', 'inbound')
      .eq('message_type', 'audio');

    if (error) {
      throw toRepositoryError('Failed to update WhatsApp voice transcript', error);
    }
  }

  async markJobCompleted(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('whatsapp_voice_jobs')
      .update({
        status: 'completed',
        locked_at: null,
        locked_by: null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      throw toRepositoryError('Failed to complete WhatsApp voice job', error);
    }
  }

  async scheduleJobRetry(input: {
    jobId: string;
    nextAttemptAt: Date;
    error: { code: string; message: string };
  }): Promise<void> {
    const { error } = await this.supabase
      .from('whatsapp_voice_jobs')
      .update({
        status: 'retry',
        next_attempt_at: input.nextAttemptAt.toISOString(),
        last_error_code: input.error.code,
        last_error_message: input.error.message,
        locked_at: null,
        locked_by: null,
      })
      .eq('id', input.jobId);

    if (error) {
      throw toRepositoryError('Failed to retry WhatsApp voice job', error);
    }
  }

  async markJobDeadLetter(input: {
    jobId: string;
    error: { code: string; message: string };
  }): Promise<void> {
    const { error } = await this.supabase
      .from('whatsapp_voice_jobs')
      .update({
        status: 'dead_letter',
        last_error_code: input.error.code,
        last_error_message: input.error.message,
        locked_at: null,
        locked_by: null,
      })
      .eq('id', input.jobId);

    if (error) {
      throw toRepositoryError('Failed to dead-letter WhatsApp voice job', error);
    }
  }
}

export function createWhatsAppVoiceRepository(): WhatsAppVoiceRepository {
  return new SupabaseWhatsAppVoiceRepository();
}

export function currentSttModel(): string {
  return env.ELEVENLABS_STT_MODEL;
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function getOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
