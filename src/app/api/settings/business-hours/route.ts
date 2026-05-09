import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { applyRateLimit } from '@/lib/rate-limit/apply';
import { createTenantSettingsService } from '@/server/settings/tenant-settings';

const BusinessHourSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    opensAt: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/),
    closesAt: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/),
    active: z.boolean().optional(),
  })
  .strict();

const ReplaceBusinessHoursBodySchema = z
  .object({
    hours: z.array(BusinessHourSchema).max(28),
  })
  .strict();

export async function GET(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    const service = createTenantSettingsService();

    return service.listBusinessHours({ session });
  }, request);
}

export async function PUT(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const session = await requireSession();
    await applyRateLimit('settingsWrite', { kind: 'tenantId', value: session.tenantId });
    const body = ReplaceBusinessHoursBodySchema.parse(await readJsonBody(request));
    const service = createTenantSettingsService();

    const hours = body.hours.map((hour) => ({
      weekday: hour.weekday,
      opensAt: hour.opensAt,
      closesAt: hour.closesAt,
      ...(hour.active !== undefined ? { active: hour.active } : {}),
    }));

    return service.replaceBusinessHours({
      session,
      hours,
      ipAddress: context.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
