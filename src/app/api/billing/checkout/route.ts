// Fatto da Claude Code il 27 aprile 2026.
import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { createStripeBillingService } from '@/server/billing/stripe-billing';

const CheckoutBodySchema = z
  .object({
    plan: z.enum(['starter', 'professional']),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const session = await requireSession();
    const payload = CheckoutBodySchema.parse(await readJsonBody(request));
    const service = createStripeBillingService();

    return service.createCheckoutSession({
      session,
      plan: payload.plan,
      ipAddress: context.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
