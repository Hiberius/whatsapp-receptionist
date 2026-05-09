// Fatto da Claude Code il 27 aprile 2026.
import { type NextRequest } from 'next/server';

import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { createStripeBillingService } from '@/server/billing/stripe-billing';

export async function POST(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const session = await requireSession();
    const service = createStripeBillingService();

    return service.createPortalSession({
      session,
      ipAddress: context.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
