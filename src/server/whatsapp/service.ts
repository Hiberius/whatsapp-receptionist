import { AppError, toAppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { createBookingBridgeService } from '@/server/ai/booking-bridge';
import { type ReplyOrchestrator } from '@/server/ai/reply-orchestrator';
import { createUsageLimitsService, type UsageLimitsService } from '@/server/usage/limits';
import { WhatsAppAutoReplyService } from '@/server/whatsapp/auto-reply';
import type { WhatsAppWebhookPayload } from '@/types/whatsapp';
import {
  extractWhatsAppWebhookEvents,
  type WhatsAppWebhookEvent,
} from '@/server/whatsapp/webhook-events';
import {
  SupabaseWhatsAppWebhookRepository,
  type WhatsAppWebhookRepository,
} from '@/server/whatsapp/repository';

export type ProcessWhatsAppWebhookContext = {
  requestId: string;
  ipAddress: string;
};

export type ProcessWhatsAppWebhookResult = {
  accepted: true;
  totalEvents: number;
  processedEvents: number;
  duplicateEvents: number;
  unresolvedTenantEvents: number;
  failedEvents: number;
};

export class WhatsAppWebhookService {
  private readonly autoReplyService: WhatsAppAutoReplyService;
  // Fatto da Claude Code 2026-04-27: usage limits opzionale per conteggio
  // conversazioni mensili. I test esistenti continuano a passare null.
  private readonly usageLimits: UsageLimitsService | null;

  constructor(
    private readonly repository: WhatsAppWebhookRepository,
    options: {
      autoReplyEnabled?: boolean;
      replyOrchestrator?: ReplyOrchestrator;
      autoReplyService?: WhatsAppAutoReplyService;
      usageLimits?: UsageLimitsService;
    } = {},
  ) {
    this.autoReplyService =
      options.autoReplyService ??
      new WhatsAppAutoReplyService(this.repository, {
        autoReplyEnabled: options.autoReplyEnabled ?? env.AMBROGIO_AI_AUTOREPLY_ENABLED,
        ...(options.replyOrchestrator !== undefined
          ? { replyOrchestrator: options.replyOrchestrator }
          : {}),
      });
    this.usageLimits = options.usageLimits ?? null;
  }

  async processPayload(
    payload: WhatsAppWebhookPayload,
    context: ProcessWhatsAppWebhookContext,
  ): Promise<ProcessWhatsAppWebhookResult> {
    const events = extractWhatsAppWebhookEvents(payload);

    if (events.length === 0) {
      throw new AppError('bad_request', 'Webhook payload has no processable events');
    }

    const summary: ProcessWhatsAppWebhookResult = {
      accepted: true,
      totalEvents: events.length,
      processedEvents: 0,
      duplicateEvents: 0,
      unresolvedTenantEvents: 0,
      failedEvents: 0,
    };

    for (const event of events) {
      const result = await this.processEvent(event, context);
      summary.processedEvents += result === 'processed' ? 1 : 0;
      summary.duplicateEvents += result === 'duplicate' ? 1 : 0;
      summary.unresolvedTenantEvents += result === 'unresolved' ? 1 : 0;
      summary.failedEvents += result === 'failed' ? 1 : 0;
    }

    if (summary.failedEvents > 0) {
      throw new AppError(
        'upstream_error',
        'WhatsApp webhook processing failed; provider should retry',
        {
          cause: summary,
          expose: false,
        },
      );
    }

    return summary;
  }

  private async processEvent(
    event: WhatsAppWebhookEvent,
    context: ProcessWhatsAppWebhookContext,
  ): Promise<'processed' | 'duplicate' | 'unresolved' | 'failed'> {
    const recorded = await this.repository.recordWebhookEvent({
      tenantId: null,
      provider: event.provider,
      eventType: event.kind,
      externalId: event.externalId,
      idempotencyKey: event.idempotencyKey,
      payload: event.payload,
    });

    if (recorded.duplicate || !recorded.eventId) {
      return 'duplicate';
    }

    let tenantId: string | null = null;

    try {
      const tenant = await this.repository.resolveTenantByPhoneNumberId(event.phoneNumberId);

      if (!tenant) {
        await this.repository.markWebhookEventFailed(recorded.eventId, {
          code: 'tenant_not_found',
          message: `No active WhatsApp integration for phone_number_id ${event.phoneNumberId}`,
        });

        logger.warn(
          {
            requestId: context.requestId,
            phoneNumberId: event.phoneNumberId,
            externalId: event.externalId,
          },
          'WhatsApp webhook tenant not resolved',
        );

        return 'unresolved';
      }

      tenantId = tenant.tenantId;

      if (event.kind === 'message') {
        await this.processInboundMessage(event, tenantId);
      } else if (event.status.status) {
        await this.repository.updateOutboundMessageStatus({
          tenantId,
          providerMessageId: event.status.id,
          status: event.status.status,
        });
      }

      await this.repository.markWebhookEventProcessed(recorded.eventId, tenantId);
      return 'processed';
    } catch (error) {
      const appError = toAppError(error);

      await this.repository.markWebhookEventFailed(
        recorded.eventId,
        {
          code: appError.code,
          message: appError.message,
        },
        tenantId ?? undefined,
      );

      logger.error(
        {
          requestId: context.requestId,
          externalId: event.externalId,
          cause: appError.cause,
        },
        'WhatsApp webhook event failed',
      );

      return 'failed';
    }
  }

  private async processInboundMessage(
    event: Extract<WhatsAppWebhookEvent, { kind: 'message' }>,
    tenantId: string,
  ): Promise<void> {
    const conversation = await this.repository.upsertConversation({
      tenantId,
      channel: 'whatsapp',
      customerIdentifier: event.message.from,
      customerName: null,
      lastMessageAt: event.occurredAt,
      metadata: {
        provider: event.provider,
        phoneNumberId: event.phoneNumberId,
        displayPhoneNumber: event.displayPhoneNumber,
      },
    });

    const inserted = await this.repository.insertInboundMessage({
      tenantId,
      conversationId: conversation.conversationId,
      externalId: event.externalId,
      messageType: event.message.type,
      content: event.message.textBody,
      mediaUrls: [],
      createdAt: event.occurredAt,
      metadata: {
        provider: event.provider,
        whatsappMessageId: event.message.id,
        phoneNumberId: event.phoneNumberId,
        displayPhoneNumber: event.displayPhoneNumber,
        audio: event.message.audio,
      },
    });

    if (inserted.created) {
      await this.repository.incrementUsage({
        tenantId,
        metricMonth: toMetricMonth(event.occurredAt),
        messagesDelta: 1,
      });

      // Fatto da Claude Code 2026-04-27: una conversation/mese conta una sola
      // volta verso il limite del piano, anche se il cliente scrive piu' volte.
      if (this.usageLimits) {
        await this.usageLimits.registerInboundConversation({
          tenantId,
          customerIdentifier: event.message.from,
          channel: 'whatsapp',
          now: event.occurredAt,
        });
      }

      if (inserted.messageId && event.message.textBody) {
        if (isWhatsAppOptOutCommand(event.message.textBody)) {
          await this.repository.upsertCustomerOptOut({
            tenantId,
            channel: 'whatsapp',
            customerIdentifier: event.message.from,
            reason: 'keyword_stop',
            optedOutAt: event.occurredAt,
          });
          await this.repository.updateInboundMessageAnalysis({
            tenantId,
            messageId: inserted.messageId,
            intent: 'other',
            confidence: 1,
            tokensUsed: 0,
            costCents: 0,
            metadata: {
              optOut: {
                reason: 'keyword_stop',
                keyword: event.message.textBody,
              },
            },
          });
          await this.enqueueOptOutConfirmation({
            tenantId,
            conversationId: conversation.conversationId,
            customerIdentifier: event.message.from,
            inboundExternalId: event.externalId,
            messageId: inserted.messageId,
            occurredAt: event.occurredAt,
          });

          return;
        }

        await this.autoReplyService.handleInboundMessage({
          tenantId,
          conversationId: conversation.conversationId,
          inboundMessageId: inserted.messageId,
          inboundExternalId: event.externalId,
          customerIdentifier: event.message.from,
          text: event.message.textBody,
          occurredAt: event.occurredAt,
          source: 'text',
          provider: event.provider,
          whatsappMessageId: event.message.id,
          phoneNumberId: event.phoneNumberId,
          displayPhoneNumber: event.displayPhoneNumber,
          existingMetadata: {
            provider: event.provider,
            whatsappMessageId: event.message.id,
            phoneNumberId: event.phoneNumberId,
            displayPhoneNumber: event.displayPhoneNumber,
          },
        });
      }

      if (inserted.messageId && event.message.audio) {
        await this.repository.enqueueVoiceProcessingJob({
          tenantId,
          messageId: inserted.messageId,
          mediaId: event.message.audio.id,
          mediaMimeType: event.message.audio.mimeType,
          mediaSha256: event.message.audio.sha256,
          payload: {
            provider: event.provider,
            whatsappMessageId: event.message.id,
            phoneNumberId: event.phoneNumberId,
            displayPhoneNumber: event.displayPhoneNumber,
            customerIdentifier: event.message.from,
            audio: event.message.audio,
          },
        });
      }
    }
  }

  private async enqueueOptOutConfirmation(input: {
    tenantId: string;
    conversationId: string;
    customerIdentifier: string;
    inboundExternalId: string;
    messageId: string;
    occurredAt: Date;
  }): Promise<void> {
    const outbound = await this.repository.insertOutboundMessage({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      externalId: `opt-out-confirmation:${input.inboundExternalId}`,
      content:
        'Confermo: non riceverai piu messaggi automatici da Ambrogio su WhatsApp. Per riattivarli, contatta direttamente lo studio.',
      createdAt: input.occurredAt,
      metadata: {
        source: 'whatsapp_opt_out_confirmation',
        inboundMessageId: input.messageId,
        inboundExternalId: input.inboundExternalId,
      },
    });

    if (!outbound.created || !outbound.messageId) {
      return;
    }

    await this.repository.enqueueOutboundMessage({
      tenantId: input.tenantId,
      messageId: outbound.messageId,
      recipientIdentifier: input.customerIdentifier,
      payload: {
        type: 'text',
        text: {
          body: 'Confermo: non riceverai piu messaggi automatici da Ambrogio su WhatsApp. Per riattivarli, contatta direttamente lo studio.',
          previewUrl: false,
        },
        metadata: {
          source: 'whatsapp_opt_out_confirmation',
          inboundMessageId: input.messageId,
          inboundExternalId: input.inboundExternalId,
        },
      },
    });
  }
}

export function createWhatsAppWebhookService(): WhatsAppWebhookService {
  const repository = new SupabaseWhatsAppWebhookRepository();
  // Fatto da Claude Code 2026-04-27: aggancio dei limiti usage all'auto-reply.
  const usageLimits = createUsageLimitsService();

  return new WhatsAppWebhookService(repository, {
    autoReplyService: new WhatsAppAutoReplyService(repository, {
      bookingBridge: createBookingBridgeService(),
      usageLimits,
    }),
    usageLimits,
  });
}

function toMetricMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `${year}-${month}-01`;
}

function isWhatsAppOptOutCommand(text: string): boolean {
  const normalized = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return false;
  }

  if (/\b(appuntamento|prenotazione|visita|orario|sposta|annulla)\b/.test(normalized)) {
    return false;
  }

  return (
    /\b(stop|unsubscribe|rimuovimi|cancellami|disiscrivimi)\b/.test(normalized) ||
    /\b(non scrivetemi|non contattatemi|basta messaggi)\b/.test(normalized)
  );
}
