import { z } from 'zod';
import { type NextRequest, type NextResponse } from 'next/server';

import { jsonHandler } from '@/lib/api/json';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import { assertStaticSecretHeader } from '@/lib/security/static-secret';
import { createWhatsAppTemplateSyncService } from '@/server/whatsapp/template-sync';

export const runtime = 'nodejs';

const SyncTemplatesBodySchema = z.object({
  tenantId: z.string().uuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  return jsonHandler(async () => {
    assertStaticSecretHeader({
      headers: request.headers,
      headerName: env.INTERNAL_JOB_HEADER_NAME,
      expectedSecret: env.INTERNAL_JOB_SECRET,
      notConfiguredMessage: 'Internal job secret is not configured',
    });

    const body = SyncTemplatesBodySchema.parse(await readOptionalJson(request));
    const service = createWhatsAppTemplateSyncService();

    return service.syncTenantTemplates({
      tenantId: body.tenantId,
    });
  }, request);
}

async function readOptionalJson(request: NextRequest): Promise<unknown> {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new AppError('bad_request', 'Invalid JSON body', {
      cause: error,
      expose: true,
    });
  }
}
