import { NextResponse, type NextRequest } from 'next/server';

import { jsonHandler } from '@/lib/api/json';
import { env } from '@/lib/env';
import { enforceWhatsAppWebhookRateLimit } from '@/lib/rate-limit';
import { assertWhatsAppWebhookSecret } from '@/lib/whatsapp/webhook-security';
import { createWhatsAppWebhookService } from '@/server/whatsapp/service';
import { WhatsAppWebhookPayloadSchema } from '@/types/whatsapp';

export function GET(request: NextRequest): NextResponse {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && challenge && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ ok: false, error: { code: 'webhook_rejected' } }, { status: 403 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return jsonHandler(async (context) => {
    assertWhatsAppWebhookSecret(request.headers);
    await enforceWhatsAppWebhookRateLimit(request.headers);

    const payload = WhatsAppWebhookPayloadSchema.parse(await request.json());
    const service = createWhatsAppWebhookService();

    return service.processPayload(payload, {
      requestId: context.requestId,
      ipAddress: context.ipAddress,
    });
  }, request);
}
