import { createHash, timingSafeEqual } from 'node:crypto';

import { AppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';

export function assertWhatsAppWebhookSecret(headers: Headers): void {
  const headerName = env.WHATSAPP_WEBHOOK_HEADER_NAME.toLowerCase();
  const expectedSecret = env.WHATSAPP_WEBHOOK_HEADER_SECRET;

  if (!expectedSecret) {
    throw new AppError('internal', 'WhatsApp webhook secret is not configured', {
      expose: false,
    });
  }

  const receivedSecret = headers.get(headerName);

  if (!receivedSecret || !safeEqual(receivedSecret, expectedSecret)) {
    throw new AppError('webhook_rejected', 'Webhook secret mismatch');
  }
}

export function createWebhookIdempotencyKey(input: {
  provider: 'whatsapp_360dialog' | 'stripe';
  externalId: string;
}): string {
  return createHash('sha256').update(`${input.provider}:${input.externalId}`).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
