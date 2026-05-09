import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type ClaimedWhatsAppOutboxJob = {
  id: string;
  tenantId: string;
  messageId: string;
  recipientIdentifier: string;
  customerServiceWindowExpiresAt: Date | null;
  payload: unknown;
  attemptCount: number;
  maxAttempts: number;
};

export interface WhatsAppOutboxRepository {
  claimReadyJobs(input: {
    limit: number;
    lockId: string;
    lockTtlSeconds: number;
  }): Promise<ClaimedWhatsAppOutboxJob[]>;
  markJobSent(input: {
    jobId: string;
    providerMessageId: string;
    providerResponse: unknown;
    messageMetadata: Record<string, unknown>;
  }): Promise<void>;
  scheduleJobRetry(input: {
    jobId: string;
    nextAttemptAt: Date;
    error: { code: string; message: string };
  }): Promise<void>;
  markJobDeadLetter(input: {
    jobId: string;
    error: { code: string; message: string };
    messageMetadata: Record<string, unknown>;
  }): Promise<void>;
}

type ClaimedWhatsAppOutboxJobRow = {
  id: string;
  tenant_id: string;
  message_id: string;
  recipient_identifier: string;
  customer_service_window_expires_at: string | null;
  payload: unknown;
  attempt_count: number;
  max_attempts: number;
};

export class SupabaseWhatsAppOutboxRepository implements WhatsAppOutboxRepository {
  private readonly supabase = createSupabaseAdminClient();

  async claimReadyJobs(input: {
    limit: number;
    lockId: string;
    lockTtlSeconds: number;
  }): Promise<ClaimedWhatsAppOutboxJob[]> {
    const { data, error } = await this.supabase.rpc('claim_whatsapp_outbox_jobs', {
      p_limit: input.limit,
      p_lock_id: input.lockId,
      p_lock_ttl_seconds: input.lockTtlSeconds,
    });

    if (error) {
      throw toRepositoryError('Failed to claim WhatsApp outbox jobs', error);
    }

    return ((data ?? []) as ClaimedWhatsAppOutboxJobRow[]).map((job) => ({
      id: job.id as string,
      tenantId: job.tenant_id as string,
      messageId: job.message_id as string,
      recipientIdentifier: job.recipient_identifier as string,
      customerServiceWindowExpiresAt:
        typeof job.customer_service_window_expires_at === 'string'
          ? new Date(job.customer_service_window_expires_at)
          : null,
      payload: job.payload,
      attemptCount: job.attempt_count as number,
      maxAttempts: job.max_attempts as number,
    }));
  }

  async markJobSent(input: {
    jobId: string;
    providerMessageId: string;
    providerResponse: unknown;
    messageMetadata: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.rpc('complete_whatsapp_outbox_job', {
      p_job_id: input.jobId,
      p_provider_message_id: input.providerMessageId,
      p_provider_response: input.providerResponse,
      p_message_metadata: input.messageMetadata,
    });

    if (error) {
      throw toRepositoryError('Failed to complete WhatsApp outbox job', error);
    }
  }

  async scheduleJobRetry(input: {
    jobId: string;
    nextAttemptAt: Date;
    error: { code: string; message: string };
  }): Promise<void> {
    const { error } = await this.supabase.rpc('fail_whatsapp_outbox_job', {
      p_job_id: input.jobId,
      p_status: 'retry',
      p_next_attempt_at: input.nextAttemptAt.toISOString(),
      p_error_code: input.error.code,
      p_error_message: input.error.message,
      p_message_metadata: null,
    });

    if (error) {
      throw toRepositoryError('Failed to schedule WhatsApp outbox retry', error);
    }
  }

  async markJobDeadLetter(input: {
    jobId: string;
    error: { code: string; message: string };
    messageMetadata: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.rpc('fail_whatsapp_outbox_job', {
      p_job_id: input.jobId,
      p_status: 'dead_letter',
      p_next_attempt_at: null,
      p_error_code: input.error.code,
      p_error_message: input.error.message,
      p_message_metadata: input.messageMetadata,
    });

    if (error) {
      throw toRepositoryError('Failed to dead-letter WhatsApp outbox job', error);
    }
  }
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
