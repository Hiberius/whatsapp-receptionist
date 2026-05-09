import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { applyRateLimit } from '@/lib/rate-limit/apply';
import { createTenantSettingsService } from '@/server/settings/tenant-settings';

const CreateServiceBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    durationMinutes: z.number().int().min(5).max(480),
    priceCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();

export async function GET(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    const service = createTenantSettingsService();

    return service.listServices({ session });
  }, request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const session = await requireSession();
    await applyRateLimit('settingsWrite', { kind: 'tenantId', value: session.tenantId });
    const body = CreateServiceBodySchema.parse(await readJsonBody(request));
    const service = createTenantSettingsService();

    const servicePayload = {
      name: body.name,
      durationMinutes: body.durationMinutes,
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.priceCents !== undefined ? { priceCents: body.priceCents } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    };

    return service.createService({
      session,
      service: servicePayload,
      ipAddress: context.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
