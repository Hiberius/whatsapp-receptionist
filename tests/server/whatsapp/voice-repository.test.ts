// Test per SupabaseWhatsAppVoiceRepository: claimReadyJobs (RPC),
// getVoiceReplyContext (.from() chain), createVoiceEvent + transcript update,
// retry/dead-letter pathways. Mockiamo client admin + builder fluent.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';

// Builder fluent generico: ogni chain method ritorna se stesso.
// I test impostano l'output finale tramite .single() / .maybeSingle()
// settando rispettivamente singleResult e maybeSingleResult.

type FromResult = {
  data: unknown;
  error: { message: string } | null;
};

interface FluentBuilder {
  select: (...args: unknown[]) => FluentBuilder;
  insert: (...args: unknown[]) => FluentBuilder;
  update: (...args: unknown[]) => FluentBuilder;
  upsert: (...args: unknown[]) => FluentBuilder;
  eq: (...args: unknown[]) => FluentBuilder;
  single: () => Promise<FromResult>;
  maybeSingle: () => Promise<FromResult>;
  then?: undefined;
}

const fluentState: {
  fromCalls: string[];
  singleResult: FromResult;
  maybeSingleResult: FromResult;
  updateError: { message: string } | null;
} = {
  fromCalls: [],
  singleResult: { data: null, error: null },
  maybeSingleResult: { data: null, error: null },
  updateError: null,
};

const rpcMock = vi.fn();

function makeBuilder(): FluentBuilder {
  const builder: FluentBuilder = {
    select: () => builder,
    insert: () => builder,
    update: () => {
      // Dopo .update() la chain si chiude su .eq(...).eq(...) senza .single().
      // Ritorniamo un thenable che risolve a { error } per il pattern
      //   const { error } = await this.supabase.from(...).update(...).eq(...);
      const tail = {
        eq: () => tail,
        then: (resolve: (value: { error: { message: string } | null }) => void) =>
          resolve({ error: fluentState.updateError }),
      };
      // eslint-disable-next-line no-restricted-syntax -- thenable mock per chain await
      return tail as unknown as FluentBuilder;
    },
    upsert: () => builder,
    eq: () => builder,
    single: async () => fluentState.singleResult,
    maybeSingle: async () => fluentState.maybeSingleResult,
  };

  return builder;
}

const adminClientMock = {
  from: vi.fn((table: string) => {
    fluentState.fromCalls.push(table);
    return makeBuilder();
  }),
  rpc: rpcMock,
};

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => adminClientMock),
}));

const { SupabaseWhatsAppVoiceRepository, currentSttModel } =
  await import('@/server/whatsapp/voice-repository');

beforeEach(() => {
  rpcMock.mockReset();
  fluentState.fromCalls = [];
  fluentState.singleResult = { data: null, error: null };
  fluentState.maybeSingleResult = { data: null, error: null };
  fluentState.updateError = null;
  adminClientMock.from.mockClear();
});

describe('SupabaseWhatsAppVoiceRepository.claimReadyJobs', () => {
  it('maps RPC rows from snake_case to camelCase', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'job_1',
          tenant_id: 't',
          message_id: 'm',
          media_id: 'media_x',
          media_mime_type: 'audio/ogg',
          media_sha256: 'sha',
          payload: { foo: 1 },
          attempt_count: 1,
          max_attempts: 5,
        },
      ],
      error: null,
    });
    const repo = new SupabaseWhatsAppVoiceRepository();

    // Act
    const jobs = await repo.claimReadyJobs({
      limit: 5,
      lockId: 'lock_x',
      lockTtlSeconds: 30,
    });

    // Assert
    expect(jobs).toEqual([
      {
        id: 'job_1',
        tenantId: 't',
        messageId: 'm',
        mediaId: 'media_x',
        mediaMimeType: 'audio/ogg',
        mediaSha256: 'sha',
        payload: { foo: 1 },
        attemptCount: 1,
        maxAttempts: 5,
      },
    ]);
    expect(rpcMock).toHaveBeenCalledWith('claim_whatsapp_voice_jobs', {
      p_limit: 5,
      p_lock_id: 'lock_x',
      p_lock_ttl_seconds: 30,
    });
  });

  it('returns empty list for null data without crashing', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const repo = new SupabaseWhatsAppVoiceRepository();

    // Act
    const jobs = await repo.claimReadyJobs({ limit: 1, lockId: 'l', lockTtlSeconds: 1 });

    // Assert
    expect(jobs).toEqual([]);
  });

  it('throws upstream_error when RPC fails', async () => {
    // Arrange
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'db down' } });
    const repo = new SupabaseWhatsAppVoiceRepository();

    // Act + Assert
    await expect(
      repo.claimReadyJobs({ limit: 1, lockId: 'l', lockTtlSeconds: 1 }),
    ).rejects.toMatchObject({ code: 'upstream_error' });
  });
});

describe('SupabaseWhatsAppVoiceRepository.getVoiceReplyContext', () => {
  it('returns null when message is missing', async () => {
    // Arrange: prima maybeSingle (messages) ritorna data null
    fluentState.maybeSingleResult = { data: null, error: null };
    const repo = new SupabaseWhatsAppVoiceRepository();

    // Act
    const result = await repo.getVoiceReplyContext({ tenantId: 't', messageId: 'm' });

    // Assert
    expect(result).toBeNull();
  });

  it('throws upstream_error when message lookup fails', async () => {
    // Arrange
    fluentState.maybeSingleResult = { data: null, error: { message: 'select error' } };
    const repo = new SupabaseWhatsAppVoiceRepository();

    // Act + Assert
    await expect(
      repo.getVoiceReplyContext({ tenantId: 't', messageId: 'm' }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('SupabaseWhatsAppVoiceRepository.createVoiceEvent', () => {
  it('inserts a pending stt event and returns the new id', async () => {
    // Arrange
    fluentState.singleResult = { data: { id: 'voice_evt_1' }, error: null };
    const repo = new SupabaseWhatsAppVoiceRepository();

    // Act
    const id = await repo.createVoiceEvent({
      tenantId: 't',
      messageId: 'm',
      model: 'eleven_v2',
      metadata: { lang: 'it' },
    });

    // Assert
    expect(id).toBe('voice_evt_1');
    expect(fluentState.fromCalls).toContain('voice_events');
  });

  it('throws when insert fails', async () => {
    // Arrange
    fluentState.singleResult = { data: null, error: { message: 'pk violation' } };
    const repo = new SupabaseWhatsAppVoiceRepository();

    // Act + Assert
    await expect(
      repo.createVoiceEvent({ tenantId: 't', messageId: 'm', model: 'x', metadata: {} }),
    ).rejects.toMatchObject({ code: 'upstream_error' });
  });
});

describe('SupabaseWhatsAppVoiceRepository update operations', () => {
  it('markVoiceEventCompleted resolves on success and throws on db error', async () => {
    // Arrange — happy
    fluentState.updateError = null;
    const repo = new SupabaseWhatsAppVoiceRepository();
    await expect(
      repo.markVoiceEventCompleted({
        voiceEventId: 'v',
        audioDurationSecs: 12.4,
        metadata: { ok: true },
      }),
    ).resolves.toBeUndefined();

    // Arrange — failure path
    fluentState.updateError = { message: 'db error' };
    await expect(
      repo.markVoiceEventCompleted({
        voiceEventId: 'v',
        audioDurationSecs: null,
        metadata: {},
      }),
    ).rejects.toMatchObject({ code: 'upstream_error' });
  });

  it('markJobCompleted hits whatsapp_voice_jobs table', async () => {
    // Arrange
    fluentState.updateError = null;
    const repo = new SupabaseWhatsAppVoiceRepository();

    // Act
    await repo.markJobCompleted('job_99');

    // Assert
    expect(fluentState.fromCalls).toContain('whatsapp_voice_jobs');
  });
});

describe('SupabaseWhatsAppVoiceRepository scheduleJobRetry / markJobDeadLetter', () => {
  it('scheduleJobRetry surfaces error code and message', async () => {
    // Arrange
    fluentState.updateError = { message: 'lock conflict' };
    const repo = new SupabaseWhatsAppVoiceRepository();

    // Act + Assert
    await expect(
      repo.scheduleJobRetry({
        jobId: 'job_a',
        nextAttemptAt: new Date('2026-05-08T13:00:00.000Z'),
        error: { code: 'transient', message: 'try again' },
      }),
    ).rejects.toMatchObject({ code: 'upstream_error' });
  });

  it('markJobDeadLetter resolves cleanly when supabase returns no error', async () => {
    // Arrange
    fluentState.updateError = null;
    const repo = new SupabaseWhatsAppVoiceRepository();

    // Act + Assert
    await expect(
      repo.markJobDeadLetter({
        jobId: 'job_b',
        error: { code: 'permanent', message: 'too many attempts' },
      }),
    ).resolves.toBeUndefined();
  });
});

describe('currentSttModel helper', () => {
  it('returns a non-empty string from env', () => {
    // Assert: il default e' definito in env, non e' una stringa vuota
    expect(typeof currentSttModel()).toBe('string');
    expect(currentSttModel().length).toBeGreaterThan(0);
  });
});
