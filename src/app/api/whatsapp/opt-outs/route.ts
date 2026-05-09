import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { createWhatsAppOptOutService } from '@/server/whatsapp/opt-outs';

const OptOutQuerySchema = z.object({
  customerIdentifier: z.string().min(5).max(64),
});

export async function GET(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    const query = OptOutQuerySchema.parse({
      customerIdentifier: request.nextUrl.searchParams.get('customerIdentifier'),
    });
    const service = createWhatsAppOptOutService();

    return service.getStatus({
      session,
      customerIdentifier: query.customerIdentifier,
    });
  }, request);
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const session = await requireSession();
    const query = OptOutQuerySchema.parse({
      customerIdentifier: request.nextUrl.searchParams.get('customerIdentifier'),
    });
    const service = createWhatsAppOptOutService();

    return service.revoke({
      session,
      customerIdentifier: query.customerIdentifier,
      ipAddress: context.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
