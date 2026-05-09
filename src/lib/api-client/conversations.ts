// Fatto da Claude Code il 27 aprile 2026.
//
// Client tipizzato per l'invio manuale operatore.
// POST /api/conversations/[conversationId]/messages.
//
// Le route GET/PATCH conversazioni esistenti (di Codex) NON sono coperte qui:
// rispetto la sua ownership di pattern frontend per quelle.

import { z } from 'zod';

import { apiFetch } from './fetch';

export const SendOperatorMessageInputSchema = z.object({
  content: z.string().min(1).max(4096),
});

export type SendOperatorMessageInput = z.infer<typeof SendOperatorMessageInputSchema>;

export const SendOperatorMessageResultSchema = z.object({
  messageId: z.string().min(1),
  externalId: z.string().min(1),
  conversationId: z.string().min(1),
  enqueuedJobId: z.string().nullable(),
  customerServiceWindowExpiresAt: z.string(),
});

export type SendOperatorMessageResult = z.infer<typeof SendOperatorMessageResultSchema>;

export type ConversationsClient = {
  sendOperatorMessage(input: {
    conversationId: string;
    content: string;
    signal?: AbortSignal;
  }): Promise<SendOperatorMessageResult>;
};

export function createConversationsClient(input?: { baseUrl?: string }): ConversationsClient {
  const baseUrl = input?.baseUrl ?? '';

  return {
    sendOperatorMessage({ conversationId, content, signal }) {
      const path = `/api/conversations/${encodeURIComponent(conversationId)}/messages`;
      const body = SendOperatorMessageInputSchema.parse({ content });

      return apiFetch(path, {
        schema: SendOperatorMessageResultSchema,
        method: 'POST',
        body,
        baseUrl,
        ...(signal !== undefined ? { signal } : {}),
      });
    },
  };
}
