import { z } from 'zod';
import { type NextRequest, type NextResponse } from 'next/server';

import { jsonHandler } from '@/lib/api/json';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import { assertStaticSecretHeader } from '@/lib/security/static-secret';
import { createAppointmentNotificationService } from '@/server/appointments/notifications';

export const runtime = 'nodejs';

const ProcessAppointmentRemindersBodySchema = z.object({
  tenantId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  return jsonHandler(async () => {
    assertStaticSecretHeader({
      headers: request.headers,
      headerName: env.INTERNAL_JOB_HEADER_NAME,
      expectedSecret: env.INTERNAL_JOB_SECRET,
      notConfiguredMessage: 'Internal job secret is not configured',
    });

    const body = ProcessAppointmentRemindersBodySchema.parse(await readOptionalJson(request));
    const service = createAppointmentNotificationService();

    return service.processDueReminders({
      ...(body.tenantId !== undefined ? { tenantId: body.tenantId } : {}),
      ...(body.limit !== undefined ? { limit: body.limit } : {}),
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
