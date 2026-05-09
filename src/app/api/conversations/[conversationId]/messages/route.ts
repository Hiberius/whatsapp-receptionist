// Fatto da Claude Code il 27 aprile 2026.
//
// Invio manuale operatore. Owner/admin possono inviare un messaggio
// free-form WhatsApp dentro la finestra 24h, rispettando opt-out.

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { createOperatorMessagesService } from '@/server/conversations/operator-messages';

const SendOperatorMessageBodySchema = z
  .object({
    content: z.string().min(1).max(4096),
  })
  .strict();

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return jsonHandler(async (apiContext) => {
    const session = await requireSession();
    const { conversationId } = await context.params;
    const payload = SendOperatorMessageBodySchema.parse(await readJsonBody(request));
    const service = createOperatorMessagesService();

    return service.sendMessage({
      session,
      conversationId,
      content: payload.content,
      ipAddress: apiContext.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
