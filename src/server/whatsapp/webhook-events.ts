import { toWhatsAppPayloadRecord } from '@/lib/external-schemas/whatsapp';
import { createWebhookIdempotencyKey } from '@/lib/whatsapp/webhook-security';
import type { WhatsAppWebhookPayload } from '@/types/whatsapp';

export const WHATSAPP_PROVIDER = 'whatsapp_360dialog' as const;

export type WhatsAppProvider = typeof WHATSAPP_PROVIDER;

export type WhatsAppWebhookEvent =
  | {
      kind: 'message';
      provider: WhatsAppProvider;
      externalId: string;
      idempotencyKey: string;
      phoneNumberId: string;
      displayPhoneNumber: string;
      occurredAt: Date;
      payload: Record<string, unknown>;
      message: {
        id: string;
        from: string;
        type: 'text' | 'image' | 'audio' | 'document' | 'location';
        textBody: string | null;
        audio: {
          id: string;
          mimeType: string | null;
          sha256: string | null;
          voice: boolean | null;
        } | null;
      };
    }
  | {
      kind: 'status';
      provider: WhatsAppProvider;
      externalId: string;
      idempotencyKey: string;
      phoneNumberId: string;
      displayPhoneNumber: string;
      occurredAt: Date;
      payload: Record<string, unknown>;
      status: {
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed' | null;
        recipientId: string | null;
      };
    };

export function extractWhatsAppWebhookEvents(
  payload: WhatsAppWebhookPayload,
): WhatsAppWebhookEvent[] {
  return payload.entry.flatMap((entry) =>
    entry.changes.flatMap((change) => {
      const metadata = change.value.metadata;
      const messages =
        change.value.messages?.map((message): WhatsAppWebhookEvent => {
          const externalId = `message:${message.id}`;

          return {
            kind: 'message',
            provider: WHATSAPP_PROVIDER,
            externalId,
            idempotencyKey: createWebhookIdempotencyKey({
              provider: WHATSAPP_PROVIDER,
              externalId,
            }),
            phoneNumberId: metadata.phone_number_id,
            displayPhoneNumber: metadata.display_phone_number,
            occurredAt: parseWhatsAppTimestamp(message.timestamp),
            payload: toWhatsAppPayloadRecord(message),
            message: {
              id: message.id,
              from: message.from,
              type: message.type,
              textBody: message.text?.body ?? null,
              audio: message.audio
                ? {
                    id: message.audio.id,
                    mimeType: message.audio.mime_type ?? null,
                    sha256: message.audio.sha256 ?? null,
                    voice: message.audio.voice ?? null,
                  }
                : null,
            },
          };
        }) ?? [];

      const statuses =
        change.value.statuses?.map((status): WhatsAppWebhookEvent => {
          const statusValue = status.status ?? 'unknown';
          const externalId = `status:${status.id}:${statusValue}`;

          return {
            kind: 'status',
            provider: WHATSAPP_PROVIDER,
            externalId,
            idempotencyKey: createWebhookIdempotencyKey({
              provider: WHATSAPP_PROVIDER,
              externalId,
            }),
            phoneNumberId: metadata.phone_number_id,
            displayPhoneNumber: metadata.display_phone_number,
            occurredAt: parseWhatsAppTimestamp(status.timestamp),
            payload: toWhatsAppPayloadRecord(status),
            status: {
              id: status.id,
              status: status.status ?? null,
              recipientId: status.recipient_id ?? null,
            },
          };
        }) ?? [];

      return [...messages, ...statuses];
    }),
  );
}

function parseWhatsAppTimestamp(timestamp: string | undefined): Date {
  if (!timestamp) {
    return new Date();
  }

  const seconds = Number(timestamp);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return new Date();
  }

  return new Date(seconds * 1000);
}
