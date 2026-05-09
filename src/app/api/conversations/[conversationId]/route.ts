import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { createConversationInboxService } from '@/server/conversations/inbox';

const ConversationDetailQuerySchema = z.object({
  messageLimit: z.coerce.number().int().min(1).max(200).default(100),
});

const UpdateConversationBodySchema = z
  .object({
    status: z.enum(['active', 'escalated', 'closed', 'spam']).optional(),
    aiEnabled: z.boolean().optional(),
    customerName: z.string().trim().max(120).nullable().optional(),
  })
  .strict();

type ConversationRouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: ConversationRouteContext,
): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    const { conversationId } = await context.params;
    const query = ConversationDetailQuerySchema.parse({
      messageLimit: request.nextUrl.searchParams.get('messageLimit') ?? undefined,
    });
    const service = createConversationInboxService();

    return service.getConversation({
      session,
      conversationId,
      messageLimit: query.messageLimit,
    });
  }, request);
}

export async function PATCH(
  request: NextRequest,
  context: ConversationRouteContext,
): Promise<Response> {
  return jsonHandler(async (apiContext) => {
    const session = await requireSession();
    const { conversationId } = await context.params;
    const parsed = UpdateConversationBodySchema.parse(await readJsonBody(request));
    const patch = {
      ...(parsed.status !== undefined ? { status: parsed.status } : {}),
      ...(parsed.aiEnabled !== undefined ? { aiEnabled: parsed.aiEnabled } : {}),
      ...(parsed.customerName !== undefined ? { customerName: parsed.customerName } : {}),
    };
    const service = createConversationInboxService();

    return service.updateConversation({
      session,
      conversationId,
      patch,
      ipAddress: apiContext.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
