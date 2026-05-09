import { z } from 'zod';
import { type NextRequest, type NextResponse } from 'next/server';

import { jsonHandler } from '@/lib/api/json';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import { assertStaticSecretHeader } from '@/lib/security/static-secret';
import { createWhatsAppVoicePipelineWorker } from '@/server/whatsapp/voice-pipeline';

export const runtime = 'nodejs';

const ProcessVoiceJobsBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  return jsonHandler(async (context) => {
    assertStaticSecretHeader({
      headers: request.headers,
      headerName: env.INTERNAL_JOB_HEADER_NAME,
      expectedSecret: env.INTERNAL_JOB_SECRET,
      notConfiguredMessage: 'Internal job secret is not configured',
    });

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
