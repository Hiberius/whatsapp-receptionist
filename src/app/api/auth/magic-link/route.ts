// Fatto da Claude Code l'8 maggio 2026.
// POST /api/auth/magic-link — invia magic link via Supabase OTP.
// Anti-enumeration: response sempre `{ ok: true }`.

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { applyRateLimit } from '@/lib/rate-limit/apply';
import { createMagicLinkService, normalizeEmail } from '@/server/auth/magic-link';

export const runtime = 'nodejs';

const MagicLinkBodySchema = z
  .object({
    email: z.string().trim().min(3).max(254),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const parsed = MagicLinkBodySchema.parse(await readJsonBody(request));
    const normalized = normalizeEmail(parsed.email);

    // Identifier per il rate limit: usiamo l'email normalizzata se valida,
    // altrimenti l'IP cosi' un attaccante non puo' bypassare con email casuali.
    const identifier = normalized
      ? ({ kind: 'email', value: normalized } as const)
      : ({ kind: 'ip', value: context.ipAddress } as const);

    await applyRateLimit('authMagicLink', identifier);

    const service = createMagicLinkService();
    await service.request({
      email: parsed.email,
      requestId: context.requestId,
    });

    // Risposta uniforme: anti-enumeration, niente differenze tra
    // email esistente / inesistente / invalida.
    return { sent: true };
  }, request);
}
