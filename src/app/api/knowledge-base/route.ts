import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { createKnowledgeBaseDocumentService } from '@/server/knowledge-base/documents';

const KnowledgeBaseQuerySchema = z.object({
  active: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  category: z.string().trim().max(80).nullable().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const CreateKnowledgeBaseBodySchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    content: z.string().trim().min(1).max(30_000),
    category: z.string().trim().max(80).nullable().optional(),
    active: z.boolean().optional(),
    generateEmbedding: z.boolean().optional(),
  })
  .strict();

export async function GET(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    const query = KnowledgeBaseQuerySchema.parse({
      active: request.nextUrl.searchParams.get('active') ?? undefined,
      category: request.nextUrl.searchParams.get('category') ?? undefined,
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    });
    const filters = {
      limit: query.limit,
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.category !== undefined ? { category: query.category } : {}),
    };
    const service = createKnowledgeBaseDocumentService();

    return service.listDocuments({
      session,
      filters,
    });
  }, request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const session = await requireSession();
    const parsed = CreateKnowledgeBaseBodySchema.parse(await readJsonBody(request));
    const document = {
      title: parsed.title,
      content: parsed.content,
      ...(parsed.category !== undefined ? { category: parsed.category } : {}),
      ...(parsed.active !== undefined ? { active: parsed.active } : {}),
      ...(parsed.generateEmbedding !== undefined
        ? { generateEmbedding: parsed.generateEmbedding }
        : {}),
    };
    const service = createKnowledgeBaseDocumentService();

    return service.createDocument({
      session,
      document,
      ipAddress: context.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
