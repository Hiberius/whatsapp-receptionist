import { z } from 'zod';
import { type NextRequest, type NextResponse } from 'next/server';

import { jsonHandler } from '@/lib/api/json';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import { assertStaticSecretHeader } from '@/lib/security/static-secret';
import { createAppointmentBookingService } from '@/server/appointments/booking';

export const runtime = 'nodejs';

const AvailabilityBodySchema = z.object({
  tenantId: z.string().uuid(),
  serviceId: z.string().uuid(),
  from: z.coerce.date(),
  to: z.coerce.date(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  maxSlots: z.coerce.number().int().min(1).max(50).optional(),
  slotStepMinutes: z.coerce.number().int().min(5).max(240).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  return jsonHandler(async () => {
    assertStaticSecretHeader({
      headers: request.headers,
      headerName: env.INTERNAL_JOB_HEADER_NAME,
      expectedSecret: env.INTERNAL_JOB_SECRET,
      notConfiguredMessage: 'Internal booking secret is not configured',
    });

    const body = AvailabilityBodySchema.parse(await readOptionalJson(request));
    const service = createAppointmentBookingService();

    return service.getAvailableSlots({
      tenantId: body.tenantId,
      serviceId: body.serviceId,
      from: body.from,
      to: body.to,
      ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
      ...(body.maxSlots !== undefined ? { maxSlots: body.maxSlots } : {}),
      ...(body.slotStepMinutes !== undefined ? { slotStepMinutes: body.slotStepMinutes } : {}),
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
