import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { applyRateLimit } from '@/lib/rate-limit/apply';
import { createTenantSettingsService } from '@/server/settings/tenant-settings';

const UpdateServiceBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    durationMinutes: z.number().int().min(5).max(480).optional(),
    priceCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();

type ServiceRouteContext = {
  params: Promise<{
    serviceId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: ServiceRouteContext): Promise<Response> {
  return jsonHandler(async (apiContext) => {
    const session = await requireSession();
    await applyRateLimit('settingsWrite', { kind: 'tenantId', value: session.tenantId });
    const { serviceId } = await context.params;
    const parsed = UpdateServiceBodySchema.parse(await readJsonBody(request));
    const patch = {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.durationMinutes !== undefined ? { durationMinutes: parsed.durationMinutes } : {}),
      ...(parsed.priceCents !== undefined ? { priceCents: parsed.priceCents } : {}),
      ...(parsed.active !== undefined ? { active: parsed.active } : {}),
    };
    const service = createTenantSettingsService();

    return service.updateService({
      session,
      serviceId,
      patch,
      ipAddress: apiContext.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}

export async function DELETE(
  request: NextRequest,
  context: ServiceRouteContext,
): Promise<Response> {
  return jsonHandler(async (apiContext) => {
    const session = await requireSession();
    await applyRateLimit('settingsWrite', { kind: 'tenantId', value: session.tenantId });
    const { serviceId } = await context.params;
    const service = createTenantSettingsService();

    return service.archiveService({
      session,
      serviceId,
      ipAddress: apiContext.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
