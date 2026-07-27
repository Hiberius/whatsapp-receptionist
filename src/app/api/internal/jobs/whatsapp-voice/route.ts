import { z } from 'zod';
import { type NextRequest, type NextResponse } from 'next/server';

import { jsonHandler } from '@/lib/api/json';
import { AppError } from '@/lib/errors/app-error';
import { assertInternalJobAuth } from '@/lib/security/internal-job-auth';
import { createWhatsAppVoicePipelineWorker } from '@/server/whatsapp/voice-pipeline';

export const runtime = 'nodejs';

const ProcessVoiceJobsBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  return jsonHandler(async (context) => {
    assertInternalJobAuth(request.headers);

    const body = ProcessVoiceJobsBodySchema.parse(await readOptionalJson(request));
    const worker = createWhatsAppVoicePipelineWorker();

    return worker.processReadyJobs({
      ...(body.limit !== undefined ? { limit: body.limit } : {}),
      lockId: context.requestId,
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
