import { z } from 'zod';
import { type NextRequest, type NextResponse } from 'next/server';

import { jsonHandler } from '@/lib/api/json';
import { AppError } from '@/lib/errors/app-error';
import { assertInternalJobAuth } from '@/lib/security/internal-job-auth';
import { createWhatsAppTemplateSyncService } from '@/server/whatsapp/template-sync';

export const runtime = 'nodejs';

const SyncTemplatesBodySchema = z.object({
  tenantId: z.string().uuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  return jsonHandler(async () => {
    assertInternalJobAuth(request.headers);

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

/**
 * Vercel Cron invoca i job in `GET` e non può inviare header custom: senza
 * questo handler lo scheduler riceveva 405 e il job non girava mai.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
