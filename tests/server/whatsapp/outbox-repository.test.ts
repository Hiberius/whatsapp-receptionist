// Test per SupabaseWhatsAppOutboxRepository: tutte e 4 le operazioni passano
// per Supabase RPC. Mockiamo il client admin per verificare gli argomenti
// passati e il mapping di errori in AppError(upstream_error).

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';

// Mock del Supabase admin client. Esponiamo solo .rpc() che e' tutto cio'
// che il repository utilizza.
const rpcMock = vi.fn();
const adminClientMock = { rpc: rpcMock };

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => adminClientMock),
}));

// Importazione differita dopo vi.mock.
const { SupabaseWhatsAppOutboxRepository } = await import('@/server/whatsapp/outbox-repository');

describe('SupabaseWhatsAppOutboxRepository.claimReadyJobs', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('returns mapped jobs with parsed dates and counters', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'job_1',
          tenant_id: 'tenant_1',
          message_id: 'msg_1',
          recipient_identifier: '393331112233',
          customer_service_window_expires_at: '2026-05-08T12:00:00.000Z',
          payload: { type: 'text' },
          attempt_count: 2,
          max_attempts: 5,
        },
      ],
      error: null,
    });
    const repo = new SupabaseWhatsAppOutboxRepository();

    // Act
    const jobs = await repo.claimReadyJobs({
      limit: 10,
      lockId: 'lock_a',
      lockTtlSeconds: 30,
    });

    // Assert: shape del DTO + parsing date
    expect(jobs).toEqual([
      {
        id: 'job_1',
        tenantId: 'tenant_1',
        messageId: 'msg_1',
        recipientIdentifier: '393331112233',
        customerServiceWindowExpiresAt: new Date('2026-05-08T12:00:00.000Z'),
        payload: { type: 'text' },
        attemptCount: 2,
        maxAttempts: 5,
      },
    ]);
    expect(rpcMock).toHaveBeenCalledWith('claim_whatsapp_outbox_jobs', {
      p_limit: 10,
      p_lock_id: 'lock_a',
      p_lock_ttl_seconds: 30,
    });
  });

  it('returns empty array when data is null (no available jobs)', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const repo = new SupabaseWhatsAppOutboxRepository();

    // Act
    const jobs = await repo.claimReadyJobs({ limit: 5, lockId: 'l', lockTtlSeconds: 30 });

    // Assert
    expect(jobs).toEqual([]);
  });

  it('keeps customerServiceWindowExpiresAt null when source is missing', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'job_2',
          tenant_id: 't',
          message_id: 'm',
          recipient_identifier: 'r',
          customer_service_window_expires_at: null,
          payload: {},
          attempt_count: 0,
          max_attempts: 3,
        },
      ],
      error: null,
    });
    const repo = new SupabaseWhatsAppOutboxRepository();

    // Act
    const jobs = await repo.claimReadyJobs({ limit: 1, lockId: 'l', lockTtlSeconds: 30 });

    // Assert
    expect(jobs[0]?.customerServiceWindowExpiresAt).toBeNull();
  });

  it('throws upstream_error AppError when Supabase returns an error', async () => {
    // Arrange
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'connection lost', code: '57P01' },
    });
    const repo = new SupabaseWhatsAppOutboxRepository();

    // Act + Assert: deve lanciare un AppError con code upstream_error
    await expect(
      repo.claimReadyJobs({ limit: 1, lockId: 'l', lockTtlSeconds: 30 }),
    ).rejects.toMatchObject({ code: 'upstream_error' });
    // verifico anche che sia un AppError con expose=false
    try {
      await repo.claimReadyJobs({ limit: 1, lockId: 'l', lockTtlSeconds: 30 });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).expose).toBe(false);
    }
  });
});

describe('SupabaseWhatsAppOutboxRepository.markJobSent', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('calls complete_whatsapp_outbox_job with provider response and metadata', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({ error: null });
    const repo = new SupabaseWhatsAppOutboxRepository();

    // Act
    await repo.markJobSent({
      jobId: 'job_x',
      providerMessageId: 'wamid.abc',
      providerResponse: { messages: [{ id: 'wamid.abc' }] },
      messageMetadata: { source: 'auto-reply' },
    });

    // Assert
    expect(rpcMock).toHaveBeenCalledWith('complete_whatsapp_outbox_job', {
      p_job_id: 'job_x',
      p_provider_message_id: 'wamid.abc',
      p_provider_response: { messages: [{ id: 'wamid.abc' }] },
      p_message_metadata: { source: 'auto-reply' },
    });
  });

  it('throws upstream_error AppError on Supabase failure', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({ error: { message: 'fk violation' } });
    const repo = new SupabaseWhatsAppOutboxRepository();

    // Act + Assert
    await expect(
      repo.markJobSent({
        jobId: 'job_x',
        providerMessageId: 'wamid.abc',
        providerResponse: {},
        messageMetadata: {},
      }),
    ).rejects.toMatchObject({ code: 'upstream_error' });
  });
});

describe('SupabaseWhatsAppOutboxRepository.scheduleJobRetry', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('schedules retry with isoformat next attempt and error code', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({ error: null });
    const repo = new SupabaseWhatsAppOutboxRepository();
    const nextAt = new Date('2026-05-08T13:00:00.000Z');

    // Act
    await repo.scheduleJobRetry({
      jobId: 'job_a',
      nextAttemptAt: nextAt,
      error: { code: 'rate_limited', message: '429 from provider' },
    });

    // Assert
    expect(rpcMock).toHaveBeenCalledWith('fail_whatsapp_outbox_job', {
      p_job_id: 'job_a',
      p_status: 'retry',
      p_next_attempt_at: '2026-05-08T13:00:00.000Z',
      p_error_code: 'rate_limited',
      p_error_message: '429 from provider',
      p_message_metadata: null,
    });
  });
});

describe('SupabaseWhatsAppOutboxRepository.markJobDeadLetter', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('marks job as dead_letter with metadata snapshot', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({ error: null });
    const repo = new SupabaseWhatsAppOutboxRepository();

    // Act
    await repo.markJobDeadLetter({
      jobId: 'job_d',
      error: { code: 'permanent_failure', message: 'recipient blocked' },
      messageMetadata: { lastAttempt: '2026-05-08T13:00:00.000Z' },
    });

    // Assert
    expect(rpcMock).toHaveBeenCalledWith('fail_whatsapp_outbox_job', {
      p_job_id: 'job_d',
      p_status: 'dead_letter',
      p_next_attempt_at: null,
      p_error_code: 'permanent_failure',
      p_error_message: 'recipient blocked',
      p_message_metadata: { lastAttempt: '2026-05-08T13:00:00.000Z' },
    });
  });
});
