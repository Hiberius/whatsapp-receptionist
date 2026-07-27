import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { applyRateLimit } from '@/lib/rate-limit/apply';
import { createAiPromptSettingsService } from '@/server/ai/prompt-settings';

/**
 * Un solo verbo per due scritture: la UI usa `useApiForm`, che parla solo POST
 * JSON. Il discriminante tiene i due payload separati in validazione.
 */
const AiPromptBodySchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('publish'),
      promptText: z.string().min(1).max(8000),
    })
    .strict(),
  z
    .object({
      action: z.literal('activate'),
      versionId: z.string().uuid(),
    })
    .strict(),
]);

export async function GET(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();

    return createAiPromptSettingsService().getSettings({ session });
  }, request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const session = await requireSession();
    await applyRateLimit('settingsWrite', { kind: 'tenantId', value: session.tenantId });
    const body = AiPromptBodySchema.parse(await readJsonBody(request));
    const service = createAiPromptSettingsService();
    const userAgent = request.headers.get('user-agent');

    if (body.action === 'activate') {
      return service.activateVersion({
        session,
        versionId: body.versionId,
        ipAddress: context.ipAddress,
        userAgent,
      });
    }

    return service.publishPersona({
      session,
      promptText: body.promptText,
      ipAddress: context.ipAddress,
      userAgent,
    });
  }, request);
}
