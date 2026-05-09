// Fatto da Claude Code l'8 maggio 2026.
// GDPR Art. 17 — tenant account deletion (soft delete + 30gg grace).
//
// DELETE: l'owner conferma con la frase di sicurezza per programmare la
//   cancellazione definitiva tra 30 giorni. Il tenant viene marcato
//   `status='cancelled'` e `deleted_at = now() + 30d`. Un job cron
//   giornaliero (api/internal/jobs/gdpr-hard-delete) eseguira' l'hard
//   delete CASCADE.
// POST: annulla la deletion entro il grace period.

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonHandler } from '@/lib/api/json';
import { readJsonBody } from '@/lib/api/body';
import { requireSession } from '@/lib/auth/session';
import { applyRateLimit } from '@/lib/rate-limit/apply';
import { createGdprDeleteService } from '@/server/gdpr/data-delete';

export const runtime = 'nodejs';

const DeleteAccountBodySchema = z.object({
  confirmationPhrase: z.literal('ELIMINA DEFINITIVAMENTE'),
});

const CancelDeletionBodySchema = z.object({
  action: z.literal('cancel-deletion'),
});

export async function DELETE(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const session = await requireSession();

    // Rate limit GDPR Art. 17: 1 richiesta di hard-delete / 24h per utente.
    // Applicato PRIMA della validazione body cosi' un attaccante non puo'
    // brute-forzare la confirmation phrase.
    await applyRateLimit('gdprDelete', { kind: 'userId', value: session.userId });

    DeleteAccountBodySchema.parse(await readJsonBody(request));

    const service = createGdprDeleteService();
    const result = await service.requestTenantDeletion({
      session,
      actor: {
        ipAddress: context.ipAddress,
        userAgent: request.headers.get('user-agent'),
      },
    });

    // TODO email service: spedire conferma owner@tenant.it con
    // istruzioni per annullamento entro 30gg. Pattern: vedere
    // src/server/appointments/notifications.ts per i job email asincroni
    // quando il provider verra' integrato.

    return result;
  }, request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    const session = await requireSession();

    CancelDeletionBodySchema.parse(await readJsonBody(request));

    const service = createGdprDeleteService();
    await service.cancelTenantDeletion({
      session,
      actor: {
        ipAddress: context.ipAddress,
        userAgent: request.headers.get('user-agent'),
      },
    });

    return { cancelled: true };
  }, request);
}
