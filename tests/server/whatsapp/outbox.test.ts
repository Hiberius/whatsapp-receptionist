import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import type {
  SendWhatsAppTemplateInput,
  SendWhatsAppTemplateResult,
  SendWhatsAppTextInput,
  SendWhatsAppTextResult,
  WhatsAppMessageSender,
} from '@/server/whatsapp/client';
import {
  WhatsAppOutboxWorker,
  calculateWhatsAppRetryAt,
  isWhatsAppCustomerServiceWindowOpen,
} from '@/server/whatsapp/outbox';
import type {
  ClaimedWhatsAppOutboxJob,
  WhatsAppOutboxRepository,
} from '@/server/whatsapp/outbox-repository';

const now = new Date('2026-04-25T08:00:00.000Z');

describe('WhatsAppOutboxWorker', () => {
  it('sends claimed text jobs and completes them with provider ids', async () => {
    const repository = new FakeOutboxRepository([
      outboxJob({
        payload: {
          type: 'text',
          text: { body: 'Ciao, sono Ambrogio', previewUrl: false },
          metadata: { source: 'ai_auto_reply' },
        },
      }),
    ]);
    const sender = new FakeWhatsAppMessageSender();
    const worker = new WhatsAppOutboxWorker(repository, sender);

    const result = await worker.processReadyJobs({
      limit: 5,
      lockId: 'worker_1',
      now,
    });

    expect(result).toEqual({
      claimedJobs: 1,
      sentJobs: 1,
      retriedJobs: 0,
      deadLetterJobs: 0,
    });
    expect(sender.sent[0]).toEqual({
      to: '393331112233',
      body: 'Ciao, sono Ambrogio',
      previewUrl: false,
    });
    expect(repository.sentJobs[0]).toMatchObject({
      jobId: 'job_1',
      providerMessageId: 'wamid.outbound.1',
      messageMetadata: {
        source: 'ai_auto_reply',
      },
    });
  });

  it('dead-letters free-form text outside the 24h customer service window', async () => {
    const repository = new FakeOutboxRepository([
      outboxJob({
        customerServiceWindowExpiresAt: new Date('2026-04-25T07:59:59.000Z'),
        payload: {
          type: 'text',
          text: { body: 'Risposta arrivata troppo tardi' },
          metadata: { source: 'ai_auto_reply' },
        },
      }),
    ]);
    const sender = new FakeWhatsAppMessageSender();
    const worker = new WhatsAppOutboxWorker(repository, sender);

    const result = await worker.processReadyJobs({ now });

    expect(result.deadLetterJobs).toBe(1);
    expect(sender.sent).toHaveLength(0);
    expect(repository.deadLetters[0]).toMatchObject({
      jobId: 'job_1',
      error: {
        code: 'whatsapp_window_closed',
      },
      messageMetadata: {
        source: 'ai_auto_reply',
        sendError: {
          code: 'whatsapp_window_closed',
        },
        customerServiceWindow: {
          checkedAt: now.toISOString(),
          windowExpiresAt: '2026-04-25T07:59:59.000Z',
        },
      },
    });
  });

  it('sends template jobs even when the customer service window is closed', async () => {
    const repository = new FakeOutboxRepository([
      outboxJob({
        customerServiceWindowExpiresAt: new Date('2026-04-24T08:00:00.000Z'),
        payload: {
          type: 'template',
          template: {
            name: 'appointment_reminder_24h',
            languageCode: 'it',
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: 'Mario' },
                  { type: 'text', text: 'domani alle 10:00' },
                ],
              },
            ],
          },
          metadata: { source: 'appointment_reminder' },
        },
      }),
    ]);
    const sender = new FakeWhatsAppMessageSender();
    const worker = new WhatsAppOutboxWorker(repository, sender);

    const result = await worker.processReadyJobs({ now });

    expect(result.sentJobs).toBe(1);
    expect(sender.sentTemplates[0]).toEqual({
      to: '393331112233',
      name: 'appointment_reminder_24h',
      languageCode: 'it',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Mario' },
            { type: 'text', text: 'domani alle 10:00' },
          ],
        },
      ],
    });
    expect(sender.sent).toHaveLength(0);
  });

  it('enforces closed-window policy per job while still delivering templates', async () => {
    const repository = new FakeOutboxRepository([
      outboxJob({
        id: 'job_text',
        customerServiceWindowExpiresAt: new Date('2026-04-24T08:00:00.000Z'),
        payload: {
          type: 'text',
          text: { body: 'Risposta libera fuori finestra' },
          metadata: { source: 'ai_auto_reply' },
        },
      }),
      outboxJob({
        id: 'job_template',
        customerServiceWindowExpiresAt: new Date('2026-04-24T08:00:00.000Z'),
        payload: {
          type: 'template',
          template: {
            name: 'appointment_cancellation',
            languageCode: 'it',
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: 'Mario' },
                  { type: 'text', text: 'visita di domani' },
                ],
              },
            ],
          },
          metadata: { source: 'appointment_cancellation' },
        },
      }),
    ]);
    const sender = new FakeWhatsAppMessageSender();
    const worker = new WhatsAppOutboxWorker(repository, sender);

    const result = await worker.processReadyJobs({ now });

    expect(result).toEqual({
      claimedJobs: 2,
      sentJobs: 1,
      retriedJobs: 0,
      deadLetterJobs: 1,
    });
    expect(sender.sent).toHaveLength(0);
    expect(sender.sentTemplates[0]).toMatchObject({
      to: '393331112233',
      name: 'appointment_cancellation',
      languageCode: 'it',
    });
    expect(repository.deadLetters[0]).toMatchObject({
      jobId: 'job_text',
      error: {
        code: 'whatsapp_window_closed',
      },
    });
    expect(repository.sentJobs[0]).toMatchObject({
      jobId: 'job_template',
      providerMessageId: 'wamid.template.1',
    });
  });

  it('retries transient provider failures with exponential backoff', async () => {
    const repository = new FakeOutboxRepository([
      outboxJob({
        attemptCount: 2,
        payload: {
          type: 'text',
          text: { body: 'Riproviamo' },
          metadata: { source: 'ai_auto_reply' },
        },
      }),
    ]);
    const sender = new FakeWhatsAppMessageSender();
    sender.failures.push(
      new AppError('upstream_error', 'Provider unavailable', {
        cause: { status: 500 },
      }),
    );
    const worker = new WhatsAppOutboxWorker(repository, sender);

    const result = await worker.processReadyJobs({ now });

    expect(result.retriedJobs).toBe(1);
    expect(repository.retriedJobs[0]).toMatchObject({
      jobId: 'job_1',
      error: {
        code: 'upstream_error',
      },
    });
    expect(repository.retriedJobs[0]?.nextAttemptAt).toEqual(calculateWhatsAppRetryAt(now, 2));
  });

  it('dead-letters non-retryable provider failures', async () => {
    const repository = new FakeOutboxRepository([
      outboxJob({
        payload: {
          type: 'text',
          text: { body: 'Payload formalmente valido' },
          metadata: { source: 'ai_auto_reply' },
        },
      }),
    ]);
    const sender = new FakeWhatsAppMessageSender();
    sender.failures.push(
      new AppError('upstream_error', 'Bad recipient', {
        cause: { status: 400 },
      }),
    );
    const worker = new WhatsAppOutboxWorker(repository, sender);

    const result = await worker.processReadyJobs({ now });

    expect(result.deadLetterJobs).toBe(1);
    expect(repository.deadLetters[0]).toMatchObject({
      jobId: 'job_1',
      error: {
        code: 'upstream_error',
      },
      messageMetadata: {
        source: 'ai_auto_reply',
        sendError: {
          code: 'upstream_error',
        },
      },
    });
  });

  it('dead-letters transient failures after max attempts', async () => {
    const repository = new FakeOutboxRepository([
      outboxJob({
        attemptCount: 5,
        maxAttempts: 5,
        payload: {
          type: 'text',
          text: { body: 'Ultimo tentativo' },
          metadata: { source: 'ai_auto_reply' },
        },
      }),
    ]);
    const sender = new FakeWhatsAppMessageSender();
    sender.failures.push(
      new AppError('upstream_error', 'Still down', {
        cause: { status: 503 },
      }),
    );
    const worker = new WhatsAppOutboxWorker(repository, sender);

    const result = await worker.processReadyJobs({ now });

    expect(result.retriedJobs).toBe(0);
    expect(result.deadLetterJobs).toBe(1);
  });

  it('dead-letters invalid payloads before calling WhatsApp', async () => {
    const repository = new FakeOutboxRepository([
      outboxJob({
        payload: {
          type: 'text',
          text: { body: '' },
        },
      }),
    ]);
    const sender = new FakeWhatsAppMessageSender();
    const worker = new WhatsAppOutboxWorker(repository, sender);

    const result = await worker.processReadyJobs({ now });

    expect(result.deadLetterJobs).toBe(1);
    expect(sender.sent).toHaveLength(0);
    expect(repository.deadLetters[0]).toMatchObject({
      error: {
        code: 'bad_request',
      },
    });
  });

  it('treats missing customer service window as closed for free-form text', () => {
    expect(isWhatsAppCustomerServiceWindowOpen(null, now)).toBe(false);
    expect(isWhatsAppCustomerServiceWindowOpen(new Date('2026-04-25T07:59:59.999Z'), now)).toBe(
      false,
    );
    expect(isWhatsAppCustomerServiceWindowOpen(new Date('2026-04-25T08:00:00.001Z'), now)).toBe(
      true,
    );
  });
});

function outboxJob(overrides: Partial<ClaimedWhatsAppOutboxJob> = {}): ClaimedWhatsAppOutboxJob {
  return {
    id: 'job_1',
    tenantId: 'tenant_1',
    messageId: 'message_1',
    recipientIdentifier: '393331112233',
    customerServiceWindowExpiresAt: new Date('2026-04-25T08:30:00.000Z'),
    payload: {},
    attemptCount: 1,
    maxAttempts: 5,
    ...overrides,
  };
}

class FakeOutboxRepository implements WhatsAppOutboxRepository {
  readonly sentJobs: Array<{
    jobId: string;
    providerMessageId: string;
    providerResponse: unknown;
    messageMetadata: Record<string, unknown>;
  }> = [];
  readonly retriedJobs: Array<{
    jobId: string;
    nextAttemptAt: Date;
    error: { code: string; message: string };
  }> = [];
  readonly deadLetters: Array<{
    jobId: string;
    error: { code: string; message: string };
    messageMetadata: Record<string, unknown>;
  }> = [];

  constructor(private readonly jobs: ClaimedWhatsAppOutboxJob[]) {}

  async claimReadyJobs(): Promise<ClaimedWhatsAppOutboxJob[]> {
    return this.jobs;
  }

  async markJobSent(input: {
    jobId: string;
    providerMessageId: string;
    providerResponse: unknown;
    messageMetadata: Record<string, unknown>;
  }): Promise<void> {
    this.sentJobs.push(input);
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
    messageMetadata: Record<string, unknown>;
  }): Promise<void> {
    this.deadLetters.push(input);
  }
}

class FakeWhatsAppMessageSender implements WhatsAppMessageSender {
  readonly sent: SendWhatsAppTextInput[] = [];
  readonly sentTemplates: SendWhatsAppTemplateInput[] = [];
  readonly failures: Error[] = [];

  async sendText(input: SendWhatsAppTextInput): Promise<SendWhatsAppTextResult> {
    const failure = this.failures.shift();

    if (failure) {
      throw failure;
    }

    this.sent.push(input);

    return {
      providerMessageId: `wamid.outbound.${this.sent.length}`,
      rawResponse: {
        messages: [{ id: `wamid.outbound.${this.sent.length}` }],
      },
    };
  }

  async sendTemplate(input: SendWhatsAppTemplateInput): Promise<SendWhatsAppTemplateResult> {
    const failure = this.failures.shift();

    if (failure) {
      throw failure;
    }

    this.sentTemplates.push(input);

    return {
      providerMessageId: `wamid.template.${this.sentTemplates.length}`,
      rawResponse: {
        messages: [{ id: `wamid.template.${this.sentTemplates.length}` }],
      },
    };
  }
}
