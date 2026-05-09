// Fatto da Claude Code il 27 aprile 2026.
//
// Stripe webhook endpoint. La signature viene verificata sul raw body PRIMA
// di qualsiasi parsing JSON, come da requisito Stripe. La idempotency e' poi
// gestita lato service via webhook_events.

import { NextResponse, type NextRequest } from 'next/server';

import { toAppError } from '@/lib/errors/app-error';
import { getRequestId } from '@/lib/http/request';
import { logger } from '@/lib/logging/logger';
import { enforceStripeWebhookRateLimit } from '@/lib/rate-limit';
import { STRIPE_SIGNATURE_HEADER, constructStripeEvent } from '@/lib/stripe/webhook-security';
import { createStripeBillingService } from '@/server/billing/stripe-billing';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request.headers);

  try {
    await enforceStripeWebhookRateLimit(request.headers);

    const rawBody = await request.text();
    const signature = request.headers.get(STRIPE_SIGNATURE_HEADER);
    const event = constructStripeEvent(rawBody, signature);

    const service = createStripeBillingService();
    const result = await service.handleWebhookEvent({ event });

    logger.info(
      {
        requestId,
        stripeEventId: event.id,
        stripeEventType: event.type,
        processed: result.processed,
        reason: result.reason ?? null,
      },
      'Stripe webhook processed',
    );

    return NextResponse.json(
      { ok: true, data: result },
      { headers: { 'x-request-id': requestId } },
    );
  } catch (error) {
    const appError = toAppError(error);

    logger.error(
      {
        requestId,
        code: appError.code,
        status: appError.status,
        cause: appError.cause,
      },
      appError.message,
    );

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: appError.code,
          message: appError.expose ? appError.message : 'Internal server error',
        },
      },
      {
        status: appError.status,
        headers: { 'x-request-id': requestId },
      },
    );
  }
}
