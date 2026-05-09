import { describe, expect, it } from 'vitest';

import { extractWhatsAppWebhookEvents } from '@/server/whatsapp/webhook-events';
import { WhatsAppWebhookPayloadSchema } from '@/types/whatsapp';

describe('extractWhatsAppWebhookEvents', () => {
  it('extracts text, audio and status events with stable idempotency keys', () => {
    const payload = WhatsAppWebhookPayloadSchema.parse({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '390212345678',
                  phone_number_id: 'phone_123',
                },
                messages: [
                  {
                    from: '393331112233',
                    id: 'wamid.text',
                    timestamp: '1761300000',
                    type: 'text',
                    text: { body: 'Vorrei prenotare domani' },
                  },
                  {
                    from: '393331112233',
                    id: 'wamid.audio',
                    timestamp: '1761300060',
                    type: 'audio',
                    audio: {
                      id: 'media_audio_1',
                      mime_type: 'audio/ogg',
                      sha256: 'hash',
                      voice: true,
                    },
                  },
                ],
                statuses: [
                  {
                    id: 'wamid.outbound',
                    status: 'delivered',
                    recipient_id: '393331112233',
                    timestamp: '1761300120',
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const events = extractWhatsAppWebhookEvents(payload);

    expect(events).toHaveLength(3);
    expect(events.map((event) => event.externalId)).toEqual([
      'message:wamid.text',
      'message:wamid.audio',
      'status:wamid.outbound:delivered',
    ]);
    expect(new Set(events.map((event) => event.idempotencyKey)).size).toBe(3);
    expect(events[1]?.kind).toBe('message');
    expect(events[1]?.kind === 'message' ? events[1].message.audio?.id : null).toBe(
      'media_audio_1',
    );
  });
});
