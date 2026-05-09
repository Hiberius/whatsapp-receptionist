import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import type { VoiceTranscript } from '@/lib/elevenlabs/audio';
import type {
  StoreVoiceMediaInput,
  StoredVoiceMedia,
  TenantMediaStorage,
} from '@/server/storage/media-storage';
import type {
  WhatsAppAutoReplyHandler,
  WhatsAppAutoReplyInput,
  WhatsAppAutoReplyResult,
} from '@/server/whatsapp/auto-reply';
import type {
  DownloadedWhatsAppMedia,
  DownloadWhatsAppMediaInput,
  WhatsAppMediaDownloader,
} from '@/server/whatsapp/media';
import {
  WhatsAppVoicePipelineWorker,
  calculateWhatsAppVoiceRetryAt,
  type VoiceTranscriber,
} from '@/server/whatsapp/voice-pipeline';
import type {
  ClaimedWhatsAppVoiceJob,
  CreateVoiceEventInput,
  UpdateMessageTranscriptInput,
  WhatsAppVoiceReplyContext,
  WhatsAppVoiceRepository,
} from '@/server/whatsapp/voice-repository';

const now = new Date('2026-04-25T09:00:00.000Z');

describe('WhatsAppVoicePipelineWorker', () => {
  it('downloads, stores, transcribes and completes inbound audio jobs', async () => {
    const repository = new FakeVoiceRepository([voiceJob()]);
    const mediaDownloader = new FakeMediaDownloader();
    const storage = new FakeTenantMediaStorage();
    const transcriber = new FakeVoiceTranscriber();
    const worker = new WhatsAppVoicePipelineWorker(
      repository,
      mediaDownloader,
      storage,
      transcriber,
      { sttModel: 'scribe_v2' },
    );

    const result = await worker.processReadyJobs({ now, lockId: 'worker_1' });

    expect(result).toEqual({
      claimedJobs: 1,
      completedJobs: 1,
      retriedJobs: 0,
      deadLetterJobs: 0,
    });
    expect(mediaDownloader.downloads[0]).toEqual({
      mediaId: 'media_audio_1',
      expectedMimeType: 'audio/ogg',
    });
    expect(storage.uploads[0]).toMatchObject({
      tenantId: 'tenant_1',
      messageId: 'message_1',
      mediaId: 'media_audio_1',
      contentType: 'audio/ogg',
    });
    expect(transcriber.calls[0]?.audio.type).toBe('audio/ogg');
    expect(repository.messageTranscripts[0]).toMatchObject({
      tenantId: 'tenant_1',
      messageId: 'message_1',
      transcriptText: 'Vorrei prenotare domani mattina',
      transcriptLanguage: 'it',
      audioDurationSecs: 4.2,
      mediaUri: 'supabase://ambrogio-media/tenant_1/voice/message_1/media_audio_1.ogg',
    });
    expect(repository.completedVoiceEvents[0]).toMatchObject({
      voiceEventId: 'voice_event_1',
      audioDurationSecs: 4.2,
    });
    expect(repository.completedJobs).toEqual(['voice_job_1']);
  });

  it('passes completed transcripts to the AI auto-reply handler', async () => {
    const repository = new FakeVoiceRepository([voiceJob()]);
    const autoReplyHandler = new FakeAutoReplyHandler();
    const worker = new WhatsAppVoicePipelineWorker(
      repository,
      new FakeMediaDownloader(),
      new FakeTenantMediaStorage(),
      new FakeVoiceTranscriber(),
      {
        autoReplyHandler,
        sttModel: 'scribe_v2',
      },
    );

    const result = await worker.processReadyJobs({ now });

    expect(result.completedJobs).toBe(1);
    expect(autoReplyHandler.calls[0]).toMatchObject({
      tenantId: 'tenant_1',
      inboundMessageId: 'message_1',
      inboundExternalId: 'message:wamid.audio',
      customerIdentifier: '393331112233',
      text: 'Vorrei prenotare domani mattina',
      source: 'voice_transcript',
      whatsappMessageId: 'wamid.audio',
      phoneNumberId: 'phone_123',
      displayPhoneNumber: '390212345678',
      transcriptLanguage: 'it',
      transcriptLanguageProbability: 0.98,
    });
  });

  it('reuses an existing transcript on retry instead of transcribing twice', async () => {
    const repository = new FakeVoiceRepository([voiceJob()]);
    repository.existingContext = {
      ...repository.createReplyContext('message_1'),
      transcriptText: 'Vorrei prenotare domani mattina',
      transcriptLanguage: 'it',
      transcriptLanguageProbability: 0.98,
    };
    const mediaDownloader = new FakeMediaDownloader();
    const transcriber = new FakeVoiceTranscriber();
    const autoReplyHandler = new FakeAutoReplyHandler();
    const worker = new WhatsAppVoicePipelineWorker(
      repository,
      mediaDownloader,
      new FakeTenantMediaStorage(),
      transcriber,
      {
        autoReplyHandler,
      },
    );

    const result = await worker.processReadyJobs({ now });

    expect(result.completedJobs).toBe(1);
    expect(mediaDownloader.downloads).toHaveLength(0);
    expect(transcriber.calls).toHaveLength(0);
    expect(autoReplyHandler.calls[0]?.text).toBe('Vorrei prenotare domani mattina');
  });

  it('retries transient provider failures with backoff', async () => {
    const repository = new FakeVoiceRepository([voiceJob({ attemptCount: 2 })]);
    const mediaDownloader = new FakeMediaDownloader();
    mediaDownloader.failures.push(
      new AppError('upstream_error', 'Provider unavailable', {
        cause: { status: 503 },
      }),
    );
    const worker = new WhatsAppVoicePipelineWorker(
      repository,
      mediaDownloader,
      new FakeTenantMediaStorage(),
      new FakeVoiceTranscriber(),
    );

    const result = await worker.processReadyJobs({ now });

    expect(result.retriedJobs).toBe(1);
    expect(repository.failedVoiceEvents[0]).toMatchObject({
      voiceEventId: 'voice_event_1',
    });
    expect(repository.retriedJobs[0]).toMatchObject({
      jobId: 'voice_job_1',
      nextAttemptAt: calculateWhatsAppVoiceRetryAt(now, 2),
      error: {
        code: 'upstream_error',
      },
    });
  });

  it('dead-letters invalid media after max attempts', async () => {
    const repository = new FakeVoiceRepository([voiceJob({ attemptCount: 5, maxAttempts: 5 })]);
    const mediaDownloader = new FakeMediaDownloader();
    mediaDownloader.failures.push(new AppError('bad_request', 'WhatsApp media file is too large'));
    const worker = new WhatsAppVoicePipelineWorker(
      repository,
      mediaDownloader,
      new FakeTenantMediaStorage(),
      new FakeVoiceTranscriber(),
    );

    const result = await worker.processReadyJobs({ now });

    expect(result.deadLetterJobs).toBe(1);
    expect(repository.deadLetters[0]).toMatchObject({
      jobId: 'voice_job_1',
      error: {
        code: 'bad_request',
      },
    });
  });
});

function voiceJob(overrides: Partial<ClaimedWhatsAppVoiceJob> = {}): ClaimedWhatsAppVoiceJob {
  return {
    id: 'voice_job_1',
    tenantId: 'tenant_1',
    messageId: 'message_1',
    mediaId: 'media_audio_1',
    mediaMimeType: 'audio/ogg',
    mediaSha256: 'hash_1',
    payload: {
      whatsappMessageId: 'wamid.audio',
    },
    attemptCount: 1,
    maxAttempts: 5,
    ...overrides,
  };
}

class FakeVoiceRepository implements WhatsAppVoiceRepository {
  readonly createdVoiceEvents: CreateVoiceEventInput[] = [];
  readonly completedVoiceEvents: Array<{
    voiceEventId: string;
    audioDurationSecs: number | null;
    metadata: Record<string, unknown>;
  }> = [];
  readonly failedVoiceEvents: Array<{
    voiceEventId: string;
    metadata: Record<string, unknown>;
  }> = [];
  readonly messageTranscripts: UpdateMessageTranscriptInput[] = [];
  readonly completedJobs: string[] = [];
  readonly retriedJobs: Array<{
    jobId: string;
    nextAttemptAt: Date;
    error: { code: string; message: string };
  }> = [];
  readonly deadLetters: Array<{
    jobId: string;
    error: { code: string; message: string };
  }> = [];
  existingContext: WhatsAppVoiceReplyContext | null = null;

  constructor(private readonly jobs: ClaimedWhatsAppVoiceJob[]) {}

  async claimReadyJobs(): Promise<ClaimedWhatsAppVoiceJob[]> {
    return this.jobs;
  }

  async getVoiceReplyContext(input: {
    tenantId: string;
    messageId: string;
  }): Promise<WhatsAppVoiceReplyContext | null> {
    if (this.existingContext) {
      return this.existingContext;
    }

    return this.createReplyContext(input.messageId);
  }

  createReplyContext(messageId: string): WhatsAppVoiceReplyContext {
    const transcript = this.messageTranscripts.find(
      (messageTranscript) => messageTranscript.messageId === messageId,
    );

    return {
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      messageId,
      externalId: 'message:wamid.audio',
      customerIdentifier: '393331112233',
      createdAt: now,
      transcriptText: transcript?.transcriptText ?? null,
      transcriptLanguage: transcript?.transcriptLanguage ?? null,
      transcriptLanguageProbability: 0.98,
      provider: 'whatsapp_360dialog',
      whatsappMessageId: 'wamid.audio',
      phoneNumberId: 'phone_123',
      displayPhoneNumber: '390212345678',
      metadata: transcript?.metadata ?? {},
    };
  }

  async createVoiceEvent(input: CreateVoiceEventInput): Promise<string> {
    this.createdVoiceEvents.push(input);

    return `voice_event_${this.createdVoiceEvents.length}`;
  }

  async markVoiceEventCompleted(input: {
    voiceEventId: string;
    audioDurationSecs: number | null;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    this.completedVoiceEvents.push(input);
  }

  async markVoiceEventFailed(input: {
    voiceEventId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    this.failedVoiceEvents.push(input);
  }

  async updateMessageTranscript(input: UpdateMessageTranscriptInput): Promise<void> {
    this.messageTranscripts.push(input);
  }

  async markJobCompleted(jobId: string): Promise<void> {
    this.completedJobs.push(jobId);
  }

  async scheduleJobRetry(input: {
    jobId: string;
    nextAttemptAt: Date;
    error: { code: string; message: string };
  }): Promise<void> {
    this.retriedJobs.push(input);
  }

  async markJobDeadLetter(input: {
    jobId: string;
    error: { code: string; message: string };
  }): Promise<void> {
    this.deadLetters.push(input);
  }
}

class FakeMediaDownloader implements WhatsAppMediaDownloader {
  readonly downloads: DownloadWhatsAppMediaInput[] = [];
  readonly failures: Error[] = [];

  async downloadMedia(input: DownloadWhatsAppMediaInput): Promise<DownloadedWhatsAppMedia> {
    const failure = this.failures.shift();

    if (failure) {
      throw failure;
    }

    this.downloads.push(input);

    return {
      mediaId: input.mediaId,
      bytes: new Uint8Array([1, 2, 3]),
      contentType: input.expectedMimeType ?? 'audio/ogg',
      sha256: 'hash_1',
      rawMetadata: {
        id: input.mediaId,
      },
    };
  }
}

class FakeTenantMediaStorage implements TenantMediaStorage {
  readonly uploads: StoreVoiceMediaInput[] = [];

  async storeVoiceMedia(input: StoreVoiceMediaInput): Promise<StoredVoiceMedia> {
    this.uploads.push(input);

    return {
      bucket: 'ambrogio-media',
      path: `${input.tenantId}/voice/${input.messageId}/${input.mediaId}.ogg`,
      uri: `supabase://ambrogio-media/${input.tenantId}/voice/${input.messageId}/${input.mediaId}.ogg`,
    };
  }
}

class FakeVoiceTranscriber implements VoiceTranscriber {
  readonly calls: Array<{
    audio: Blob;
    languageCode?: string;
    keyterms?: string[];
  }> = [];

  async transcribe(input: {
    audio: Blob;
    languageCode?: string;
    keyterms?: string[];
  }): Promise<VoiceTranscript> {
    this.calls.push(input);

    return {
      text: 'Vorrei prenotare domani mattina',
      languageCode: 'it',
      languageProbability: 0.98,
      audioDurationSecs: 4.2,
    };
  }
}

class FakeAutoReplyHandler implements WhatsAppAutoReplyHandler {
  readonly calls: WhatsAppAutoReplyInput[] = [];

  async handleInboundMessage(input: WhatsAppAutoReplyInput): Promise<WhatsAppAutoReplyResult> {
    this.calls.push(input);

    return {
      analyzed: true,
      queued: true,
      skippedReason: null,
      classification: {
        intent: 'booking_request',
        confidence: 0.91,
        matchedSignals: [],
      },
    };
  }
}
