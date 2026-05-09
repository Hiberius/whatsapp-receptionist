import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonHandler } from '@/lib/api/json';
import { readJsonBody } from '@/lib/api/body';
import { requireSession } from '@/lib/auth/session';
import { applyRateLimit } from '@/lib/rate-limit/apply';
import {
  createTenantSettingsService,
  type TenantSettingsPatch,
} from '@/server/settings/tenant-settings';

const TenantSettingsPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
    businessType: z.string().trim().max(80).nullable().optional(),
    studioName: z.string().trim().min(2).max(120).optional(),
    assistantName: z.string().trim().min(2).max(80).optional(),
    city: z.string().trim().max(80).nullable().optional(),
    address: z.string().trim().max(240).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().email().nullable().optional(),
    defaultLocale: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
      .optional(),
    aiDisclosureEnabled: z.boolean().optional(),
    autoReplyEnabled: z.boolean().optional(),
    voiceMessagesEnabled: z.boolean().optional(),
    voiceRepliesEnabled: z.boolean().optional(),
    bookingMinLeadMinutes: z.number().int().min(0).max(10_080).optional(),
    bookingSlotStepMinutes: z.number().int().min(5).max(240).optional(),
    bookingBufferMinutes: z.number().int().min(0).max(240).optional(),
    bookingMaxDaysAhead: z.number().int().min(1).max(365).optional(),
    elevenlabsVoiceId: z.string().trim().max(160).nullable().optional(),
    elevenlabsSttModel: z.string().trim().min(2).max(80).optional(),
    elevenlabsTtsModel: z.string().trim().min(2).max(80).optional(),
    humanEscalationEmail: z.string().trim().email().nullable().optional(),
  })
  .strict();

export async function GET(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    const service = createTenantSettingsService();

    return service.getSnapshot({ session });
  }, request);
}

export async function PATCH(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const session = await requireSession();
    await applyRateLimit('settingsWrite', { kind: 'tenantId', value: session.tenantId });
    const parsed = TenantSettingsPatchSchema.parse(await readJsonBody(request));
    const patch: TenantSettingsPatch = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== undefined) {
        (patch as Record<string, unknown>)[key] = value;
      }
    }
    const service = createTenantSettingsService();

    return service.updateSettings({
      session,
      patch,
      ipAddress: context.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });
  }, request);
}
