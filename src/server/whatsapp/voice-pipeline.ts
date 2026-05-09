import { AppError, toAppError } from '@/lib/errors/app-error';
import { transcribeVoiceMessage, type VoiceTranscript } from '@/lib/elevenlabs/audio';
import { createBookingBridgeService } from '@/server/ai/booking-bridge';
import { createUsageLimitsService, type UsageLimitsService } from '@/server/usage/limits';
import {
  WhatsAppAutoReplyService,
  type WhatsAppAutoReplyHandler,
} from '@/server/whatsapp/auto-reply';
import { createTenantMediaStorage, type TenantMediaStorage } from '@/server/storage/media-storage';
import {
  createWhatsAppMediaDownloader,
  type DownloadedWhatsAppMedia,
  type WhatsAppMediaDownloader,
} from '@/server/whatsapp/media';
import { SupabaseWhatsAppWebhookRepository } from '@/server/whatsapp/repository';
import {
  createWhatsAppVoiceRepository,
  currentSttModel,
  type ClaimedWhatsAppVoiceJob,
  type WhatsAppVoiceReplyContext,
  type WhatsAppVoiceRepository,
} from '@/server/whatsapp/voice-repository';

export type VoiceTranscriber = {
  transcribe(input: {
    audio: Blob;
    languageCode?: string;
    keyterms?: string[];
  }): Promise<VoiceTranscript>;
};

export type ProcessWhatsAppVoiceJobsResult = {
  claimedJobs: number;
  completedJobs: number;
  retriedJobs: number;
  deadLetterJobs: number;
};

export class WhatsAppVoicePipelineWorker {
  constructor(
    private readonly repository: WhatsAppVoiceRepository,
    private readonly mediaDownloader: WhatsAppMediaDownloader,
    private readonly mediaStorage: TenantMediaStorage,
    private readonly transcriber: VoiceTranscriber,
    private readonly options: {
      defaultLimit?: number;
      lockTtlSeconds?: number;
      sttModel?: string;
      autoReplyHandler?: WhatsAppAutoReplyHandler;
      // Fatto da Claude Code 2026-04-27: usage limits opzionale per
      // incrementare il counter `voice_messages_count` post-trascrizione.
      usageLimits?: UsageLimitsService;
    } = {},
  ) {}

  async processReadyJobs(
    input: {
      limit?: number;
      lockId?: string;
      now?: Date;
    } = {},
  ): Promise<ProcessWhatsAppVoiceJobsResult> {
    const lockId = input.lockId ?? `ambrogio-voice-${crypto.randomUUID()}`;
    const jobs = await this.repository.claimReadyJobs({
      limit: input.limit ?? this.options.defaultLimit ?? 5,
      lockId,
      lockTtlSeconds: this.options.lockTtlSeconds ?? 300,
    });
    const result: ProcessWhatsAppVoiceJobsResult = {
      claimedJobs: jobs.length,
      completedJobs: 0,
      retriedJobs: 0,
      deadLetterJobs: 0,
    };

    for (const job of jobs) {
      const jobResult = await this.processJob(job, input.now ?? new Date());

      result.completedJobs += jobResult === 'completed' ? 1 : 0;
      result.retriedJobs += jobResult === 'retry' ? 1 : 0;
      result.deadLetterJobs += jobResult === 'dead_letter' ? 1 : 0;
    }

    return result;
  }

  private async processJob(
    job: ClaimedWhatsAppVoiceJob,
    now: Date,
  ): Promise<'completed' | 'retry' | 'dead_letter'> {
    let voiceEventId: string | null = null;

    try {
      const existingContext = await this.repository.getVoiceReplyContext({
        tenantId: job.tenantId,
        messageId: job.messageId,
      });

      if (existingContext && existingContext.transcriptText !== null) {
        await this.handleAutoReply(existingContext);
        await this.repository.markJobCompleted(job.id);

        return 'completed';
      }

      voiceEventId = await this.repository.createVoiceEvent({
        tenantId: job.tenantId,
        messageId: job.messageId,
        model: this.options.sttModel ?? currentSttModel(),
        metadata: {
          jobId: job.id,
          mediaId: job.mediaId,
          mediaSha256: job.mediaSha256,
          payload: job.payload,
        },
      });

      const media = await this.mediaDownloader.downloadMedia({
        mediaId: job.mediaId,
        expectedMimeType: job.mediaMimeType,
      });
      const stored = await this.mediaStorage.storeVoiceMedia({
        tenantId: job.tenantId,
        messageId: job.messageId,
        mediaId: job.mediaId,
        bytes: media.bytes,
        contentType: media.contentType,
      });
      const transcript = await this.transcriber.transcribe({
        audio: mediaToBlob(media),
        languageCode: 'it',
      });
      const messageMetadata = {
        whatsappVoice: {
          jobId: job.id,
          mediaId: job.mediaId,
          mediaSha256: media.sha256 ?? job.mediaSha256,
          contentType: media.contentType,
          storage: stored,
          payload: job.payload,
          transcript: {
            languageCode: transcript.languageCode ?? null,
            languageProbability: transcript.languageProbability ?? null,
          },
          rawMediaMetadata: media.rawMetadata,
        },
      };

      await this.repository.updateMessageTranscript({
        tenantId: job.tenantId,
        messageId: job.messageId,
        transcriptText: transcript.text,
        transcriptLanguage: transcript.languageCode ?? null,
        audioDurationSecs: transcript.audioDurationSecs ?? null,
        mediaUri: stored.uri,
        metadata: messageMetadata,
      });
      await this.repository.markVoiceEventCompleted({
        voiceEventId,
        audioDurationSecs: transcript.audioDurationSecs ?? null,
        metadata: {
          ...messageMetadata,
          transcriptTextLength: transcript.text.length,
        },
      });

      // Fatto da Claude Code 2026-04-27: il vocale e' stato trascritto, conta
      // verso il limite voce del piano. Errori non bloccano il flusso.
      if (this.options.usageLimits) {
        try {
          await this.options.usageLimits.registerVoiceMessage({
            tenantId: job.tenantId,
            now,
          });
        } catch {
          // tracking-only, non interrompere la pipeline.
        }
      }

      await this.handleAutoReplyFromJob(job);
      await this.repository.markJobCompleted(job.id);

      return 'completed';
    } catch (error) {
      const appError = toAppError(error);
      const normalizedError = {
        code: appError.code,
        message: appError.message,
      };

      if (voiceEventId) {
        await this.repository.markVoiceEventFailed({
          voiceEventId,
          metadata: {
            jobId: job.id,
            mediaId: job.mediaId,
            error: normalizedError,
          },
        });
      }

      if (shouldRetryVoiceJob(appError, job)) {
        await this.repository.scheduleJobRetry({
          jobId: job.id,
          nextAttemptAt: calculateWhatsAppVoiceRetryAt(now, job.attemptCount),
          error: normalizedError,
        });

        return 'retry';
      }

      await this.repository.markJobDeadLetter({
        jobId: job.id,
        error: normalizedError,
      });

      return 'dead_letter';
    }
  }

  private async handleAutoReplyFromJob(job: ClaimedWhatsAppVoiceJob): Promise<void> {
    const context = await this.repository.getVoiceReplyContext({
      tenantId: job.tenantId,
      messageId: job.messageId,
    });

    if (!context) {
      throw new AppError('bad_request', 'WhatsApp voice message was not found after transcription');
    }

    await this.handleAutoReply(context);
  }

  private async handleAutoReply(context: WhatsAppVoiceReplyContext): Promise<void> {
    if (!this.options.autoReplyHandler) {
      return;
    }

    await this.options.autoReplyHandler.handleInboundMessage({
      tenantId: context.tenantId,
      conversationId: context.conversationId,
      inboundMessageId: context.messageId,
      inboundExternalId: context.externalId,
      customerIdentifier: context.customerIdentifier,
      text: context.transcriptText ?? '',
      occurredAt: context.createdAt,
      source: 'voice_transcript',
      provider: context.provider,
      whatsappMessageId: context.whatsappMessageId,
      phoneNumberId: context.phoneNumberId,
      displayPhoneNumber: context.displayPhoneNumber,
      existingMetadata: context.metadata,
      transcriptLanguage: context.transcriptLanguage,
      transcriptLanguageProbability: context.transcriptLanguageProbability,
    });
  }
}

export function createWhatsAppVoicePipelineWorker(): WhatsAppVoicePipelineWorker {
  // Fatto da Claude Code 2026-04-27: usage limits agganciato all'auto-reply
  // anche dal voice worker, cosi' il blocco rispetta sempre il piano.
  const usageLimits = createUsageLimitsService();

  return new WhatsAppVoicePipelineWorker(
    createWhatsAppVoiceRepository(),
    createWhatsAppMediaDownloader(),
    createTenantMediaStorage(),
    {
      transcribe: transcribeVoiceMessage,
    },
    {
      autoReplyHandler: new WhatsAppAutoReplyService(new SupabaseWhatsAppWebhookRepository(), {
        bookingBridge: createBookingBridgeService(),
        usageLimits,
      }),
      usageLimits,
    },
  );
}

export function calculateWhatsAppVoiceRetryAt(now: Date, attemptCount: number): Date {
  const normalizedAttempt = Math.max(1, attemptCount);
  const delayMs = Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.min(normalizedAttempt - 1, 7));

  return new Date(now.getTime() + delayMs);
}

function mediaToBlob(media: DownloadedWhatsAppMedia): Blob {
  const bytes = new Uint8Array(media.bytes);

  return new Blob([bytes.buffer as ArrayBuffer], { type: media.contentType });
}

function shouldRetryVoiceJob(error: AppError, job: ClaimedWhatsAppVoiceJob): boolean {
  if (job.attemptCount >= job.maxAttempts) {
    return false;
  }

  const providerStatus = getProviderStatus(error.cause);

  if (providerStatus === 429) {
    return true;
  }

  if (typeof providerStatus === 'number') {
    return providerStatus >= 500;
  }

  return error.code === 'upstream_error' || error.code === 'internal';
}

function getProviderStatus(cause: unknown): number | null {
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'status' in cause &&
    typeof cause.status === 'number'
  ) {
    return cause.status;
  }

  return null;
}
