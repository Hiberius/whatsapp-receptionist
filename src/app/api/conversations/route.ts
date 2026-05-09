import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { createConversationInboxService } from '@/server/conversations/inbox';

const ConversationQuerySchema = z.object({
  status: z.enum(['active', 'escalated', 'closed', 'spam']).optional(),
  channel: z.enum(['whatsapp', 'instagram_dm', 'web_chat', 'sms']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.coerce.date().nullable().optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    const query = ConversationQuerySchema.parse({
      status: request.nextUrl.searchParams.get('status') ?? undefined,
      channel: request.nextUrl.searchParams.get('channel') ?? undefined,
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
      before: request.nextUrl.searchParams.get('before') ?? undefined,
    });
    const filters = {
      limit: query.limit,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.channel !== undefined ? { channel: query.channel } : {}),
      ...(query.before !== undefined ? { before: query.before } : {}),
    };
    const service = createConversationInboxService();

    return service.listConversations({
      session,
      filters,
    });
  }, request);
}
