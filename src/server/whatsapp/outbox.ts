import { z } from 'zod';

import { type AppError, toAppError } from '@/lib/errors/app-error';
import { createWhatsAppMessageSender, type WhatsAppMessageSender } from '@/server/whatsapp/client';
import {
  SupabaseWhatsAppOutboxRepository,
  type ClaimedWhatsAppOutboxJob,
  type WhatsAppOutboxRepository,
} from '@/server/whatsapp/outbox-repository';

const WhatsAppTemplateParameterSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(1024),
});

const WhatsAppTemplateComponentSchema = z.object({
  type: z.enum(['header', 'body', 'button']),
  subType: z.enum(['quick_reply', 'url']).optional(),
  index: z.union([z.string(), z.number()]).optional(),
  parameters: z.array(WhatsAppTemplateParameterSchema).optional().default([]),
});

const WhatsAppOutboxTextPayloadSchema = z.object({
  type: z.literal('text'),
  text: z.object({
    body: z.string().min(1).max(4096),
    previewUrl: z.boolean().optional().default(false),
  }),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const WhatsAppOutboxTemplatePayloadSchema = z.object({
  type: z.literal('template'),
  template: z.object({
    name: z.string().min(1).max(512),
    languageCode: z.string().min(2).max(35),
    components: z.array(WhatsAppTemplateComponentSchema).optional().default([]),
  }),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const WhatsAppOutboxPayloadSchema = z.discriminatedUnion('type', [
  WhatsAppOutboxTextPayloadSchema,
  WhatsAppOutboxTemplatePayloadSchema,
]);

export type WhatsAppOutboxPayload = z.infer<typeof WhatsAppOutboxPayloadSchema>;

export type ProcessWhatsAppOutboxResult = {
  claimedJobs: number;
  sentJobs: number;
  retriedJobs: number;
  deadLetterJobs: number;
};

export class WhatsAppOutboxWorker {
  constructor(
    private readonly repository: WhatsAppOutboxRepository,
    private readonly messageSender: WhatsAppMessageSender,
    private readonly options: {
      defaultLimit?: number;
      lockTtlSeconds?: number;
    } = {},
  ) {}

  async processReadyJobs(
    input: {
      limit?: number;
      lockId?: string;
      now?: Date;
    } = {},
  ): Promise<ProcessWhatsAppOutboxResult> {
    const lockId = input.lockId ?? `ambrogio-outbox-${crypto.randomUUID()}`;
    const jobs = await this.repository.claimReadyJobs({
      limit: input.limit ?? this.options.defaultLimit ?? 10,
      lockId,
      lockTtlSeconds: this.options.lockTtlSeconds ?? 300,
    });
    const result: ProcessWhatsAppOutboxResult = {
      claimedJobs: jobs.length,
      sentJobs: 0,
      retriedJobs: 0,
      deadLetterJobs: 0,
    };

    for (const job of jobs) {
      const jobResult = await this.processJob(job, input.now ?? new Date());

      result.sentJobs += jobResult === 'sent' ? 1 : 0;
      result.retriedJobs += jobResult === 'retry' ? 1 : 0;
      result.deadLetterJobs += jobResult === 'dead_letter' ? 1 : 0;
    }

    return result;
  }

  private async processJob(
    job: ClaimedWhatsAppOutboxJob,
    now: Date,
  ): Promise<'sent' | 'retry' | 'dead_letter'> {
    const payload = WhatsAppOutboxPayloadSchema.safeParse(job.payload);

    if (!payload.success) {
      await this.repository.markJobDeadLetter({
        jobId: job.id,
        error: {
          code: 'bad_request',
          message: 'Invalid WhatsApp outbox payload',
        },
        messageMetadata: {
          sendError: {
            code: 'bad_request',
            message: 'Invalid WhatsApp outbox payload',
          },
        },
      });

      return 'dead_letter';
    }

    try {
      const windowPolicy = evaluateWhatsAppWindowPolicy(job, payload.data, now);

      if (!windowPolicy.allowed) {
        await this.repository.markJobDeadLetter({
          jobId: job.id,
          error: {
            code: windowPolicy.code,
            message: windowPolicy.message,
          },
          messageMetadata: {
            ...payload.data.metadata,
            customerServiceWindow: windowPolicy.metadata,
            sendError: {
              code: windowPolicy.code,
              message: windowPolicy.message,
            },
          },
        });

        return 'dead_letter';
      }

      const sent =
        payload.data.type === 'text'
          ? await this.messageSender.sendText({
              to: job.recipientIdentifier,
              body: payload.data.text.body,
              previewUrl: payload.data.text.previewUrl,
            })
          : await this.messageSender.sendTemplate({
              to: job.recipientIdentifier,
              name: payload.data.template.name,
              languageCode: payload.data.template.languageCode,
              components: payload.data.template.components.map((component) => ({
                type: component.type,
                ...(component.subType !== undefined ? { subType: component.subType } : {}),
                ...(component.index !== undefined ? { index: component.index } : {}),
                parameters: component.parameters,
              })),
            });

      await this.repository.markJobSent({
        jobId: job.id,
        providerMessageId: sent.providerMessageId,
        providerResponse: sent.rawResponse,
        messageMetadata: {
          ...payload.data.metadata,
          providerResponse: sent.rawResponse,
        },
      });

      return 'sent';
    } catch (error) {
      const appError = toAppError(error);
      const normalizedError = {
        code: appError.code,
        message: appError.message,
      };

      if (shouldRetryWhatsAppSend(appError, job)) {
        await this.repository.scheduleJobRetry({
          jobId: job.id,
          nextAttemptAt: calculateWhatsAppRetryAt(now, job.attemptCount),
          error: normalizedError,
        });

        return 'retry';
      }

      await this.repository.markJobDeadLetter({
        jobId: job.id,
        error: normalizedError,
        messageMetadata: {
          ...(payload.success ? payload.data.metadata : {}),
          sendError: normalizedError,
        },
      });

      return 'dead_letter';
    }
  }
}

type WhatsAppWindowPolicyResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      code: 'whatsapp_window_closed';
      message: string;
      metadata: {
        windowExpiresAt: string | null;
        checkedAt: string;
      };
    };

function evaluateWhatsAppWindowPolicy(
  job: ClaimedWhatsAppOutboxJob,
  payload: WhatsAppOutboxPayload,
  now: Date,
): WhatsAppWindowPolicyResult {
  if (payload.type === 'template') {
    return { allowed: true };
  }

  if (isWhatsAppCustomerServiceWindowOpen(job.customerServiceWindowExpiresAt, now)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: 'whatsapp_window_closed',
    message:
      'Free-form WhatsApp messages require an open 24h customer service window; enqueue an approved template instead.',
    metadata: {
      windowExpiresAt: job.customerServiceWindowExpiresAt?.toISOString() ?? null,
      checkedAt: now.toISOString(),
    },
  };
}

export function isWhatsAppCustomerServiceWindowOpen(
  windowExpiresAt: Date | null,
  now: Date,
): boolean {
  if (!windowExpiresAt || Number.isNaN(windowExpiresAt.getTime())) {
    return false;
  }

  return windowExpiresAt.getTime() > now.getTime();
}

export function createWhatsAppOutboxWorker(): WhatsAppOutboxWorker {
  return new WhatsAppOutboxWorker(
    new SupabaseWhatsAppOutboxRepository(),
    createWhatsAppMessageSender(),
  );
}

export function calculateWhatsAppRetryAt(now: Date, attemptCount: number): Date {
  const normalizedAttempt = Math.max(1, attemptCount);
  const delayMs = Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.min(normalizedAttempt - 1, 7));

  return new Date(now.getTime() + delayMs);
}

function shouldRetryWhatsAppSend(error: AppError, job: ClaimedWhatsAppOutboxJob): boolean {
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
