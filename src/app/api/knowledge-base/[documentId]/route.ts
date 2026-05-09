import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { createKnowledgeBaseDocumentService } from '@/server/knowledge-base/documents';

const UpdateKnowledgeBaseBodySchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    content: z.string().trim().min(1).max(30_000).optional(),
    category: z.string().trim().max(80).nullable().optional(),
    active: z.boolean().optional(),
    generateEmbedding: z.boolean().optional(),
  })
  .strict();

type KnowledgeBaseRouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: KnowledgeBaseRouteContext,
): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    const { documentId } = await context.params;
    const service = createKnowledgeBaseDocumentService();

    return service.getDocument({
      session,
      documentId,
    });
  }, request);
}

export async function PATCH(
  request: NextRequest,
  context: KnowledgeBaseRouteContext,
): Promise<Response> {
  return jsonHandler(async (apiContext) => {
    const session = await requireSession();
    const { documentId } = await context.params;
    const parsed = UpdateKnowledgeBaseBodySchema.parse(await readJsonBody(request));
    const patch = {
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.content !== undefined ? { content: parsed.content } : {}),
      ...(parsed.category !== undefined ? { category: parsed.category } : {}),
      ...(parsed.active !== undefined ? { active: parsed.active } : {}),
      ...(parsed.generateEmbedding !== undefined
        ? { generateEmbedding: parsed.generateEmbedding }
        : {}),
    };
    const service = createKnowledgeBaseDocumentService();

    return service.updateDocument({
      session,
      documentId,
      patch,
      ipAddress: apiContext.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}

export async function DELETE(
  request: NextRequest,
  context: KnowledgeBaseRouteContext,
): Promise<Response> {
  return jsonHandler(async (apiContext) => {
    const session = await requireSession();
    const { documentId } = await context.params;
    const service = createKnowledgeBaseDocumentService();

    return service.archiveDocument({
      session,
      documentId,
      ipAddress: apiContext.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
