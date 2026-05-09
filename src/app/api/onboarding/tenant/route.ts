import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { applyRateLimit } from '@/lib/rate-limit/apply';
import { createTenantOnboardingService } from '@/server/onboarding/tenant-onboarding';

const OnboardingServiceSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    durationMinutes: z.number().int().min(5).max(480).optional(),
    priceCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();

const OnboardingBusinessHourSchema = z
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

const CompleteTenantOnboardingBodySchema = z
  .object({
    tenantName: z.string().trim().min(2).max(120),
    billingEmail: z.string().trim().email().nullable().optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
    businessType: z.string().trim().max(80).nullable().optional(),
    studioName: z.string().trim().max(120).nullable().optional(),
    assistantName: z.string().trim().min(2).max(80).optional(),
    city: z.string().trim().max(80).nullable().optional(),
    address: z.string().trim().max(240).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().email().nullable().optional(),
    fullName: z.string().trim().max(120).nullable().optional(),
    services: z.array(OnboardingServiceSchema).max(20).optional(),
    businessHours: z.array(OnboardingBusinessHourSchema).max(28).optional(),
  })
  .strict();

export async function GET(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const user = await requireAuthenticatedUser();
    const service = createTenantOnboardingService();

    return service.getStatus({ user });
  }, request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const user = await requireAuthenticatedUser();
    await applyRateLimit('onboarding', { kind: 'userId', value: user.userId });
    const parsed = CompleteTenantOnboardingBodySchema.parse(await readJsonBody(request));
    const payload = {
      tenantName: parsed.tenantName,
      ...(parsed.billingEmail !== undefined ? { billingEmail: parsed.billingEmail } : {}),
      ...(parsed.timezone !== undefined ? { timezone: parsed.timezone } : {}),
      ...(parsed.businessType !== undefined ? { businessType: parsed.businessType } : {}),
      ...(parsed.studioName !== undefined ? { studioName: parsed.studioName } : {}),
      ...(parsed.assistantName !== undefined ? { assistantName: parsed.assistantName } : {}),
      ...(parsed.city !== undefined ? { city: parsed.city } : {}),
      ...(parsed.address !== undefined ? { address: parsed.address } : {}),
      ...(parsed.phone !== undefined ? { phone: parsed.phone } : {}),
      ...(parsed.email !== undefined ? { email: parsed.email } : {}),
      ...(parsed.fullName !== undefined ? { fullName: parsed.fullName } : {}),
      ...(parsed.services !== undefined
        ? {
            services: parsed.services.map((service) => ({
              name: service.name,
              ...(service.description !== undefined ? { description: service.description } : {}),
              ...(service.durationMinutes !== undefined
                ? { durationMinutes: service.durationMinutes }
                : {}),
              ...(service.priceCents !== undefined ? { priceCents: service.priceCents } : {}),
              ...(service.active !== undefined ? { active: service.active } : {}),
            })),
          }
        : {}),
      ...(parsed.businessHours !== undefined
        ? {
            businessHours: parsed.businessHours.map((hour) => ({
              weekday: hour.weekday,
              opensAt: hour.opensAt,
              closesAt: hour.closesAt,
              ...(hour.active !== undefined ? { active: hour.active } : {}),
            })),
          }
        : {}),
    };
    const service = createTenantOnboardingService();

    return service.complete({
      user,
      payload,
      ipAddress: context.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
