// Fatto da Claude Code l'8 maggio 2026.
// GDPR Art. 17 — job cron giornaliero hard-delete tenant scaduti.
//
// Auth: header INTERNAL_JOB_SECRET (pattern coerente con
// appointment-reminders e whatsapp-outbox jobs).

import { type NextRequest, type NextResponse } from 'next/server';
import { z } from 'zod';

import { jsonHandler } from '@/lib/api/json';
import { readJsonBody } from '@/lib/api/body';
import { logger } from '@/lib/logging/logger';
import { assertInternalJobAuth } from '@/lib/security/internal-job-auth';
import { createGdprDeleteService } from '@/server/gdpr/data-delete';

export const runtime = 'nodejs';

const ProcessHardDeleteBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  return jsonHandler(async () => {
    assertInternalJobAuth(request.headers);

    const body = ProcessHardDeleteBodySchema.parse(await readJsonBody(request));
    const limit = body.limit ?? 50;
    const dryRun = body.dryRun ?? false;
    const service = createGdprDeleteService();
    const now = new Date();
    const candidates = await service.listScheduledHardDeletes(now);
    const slice = candidates.slice(0, limit);
    const results: Array<{
      tenantId: string;
      scheduledHardDeleteAt: string;
      status: 'executed' | 'skipped_dry_run' | 'failed';
      error?: string;
    }> = [];

    for (const candidate of slice) {
      if (dryRun) {
        results.push({
          tenantId: candidate.tenantId,
          scheduledHardDeleteAt: candidate.scheduledHardDeleteAt,
          status: 'skipped_dry_run',
        });
        continue;
      }

      try {
        await service.executeTenantHardDelete({
          tenantId: candidate.tenantId,
          now,
        });
        results.push({
          tenantId: candidate.tenantId,
          scheduledHardDeleteAt: candidate.scheduledHardDeleteAt,
          status: 'executed',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        logger.error(
          { tenantId: candidate.tenantId, cause: error },
          'GDPR hard delete failed for tenant',
        );
        results.push({
          tenantId: candidate.tenantId,
          scheduledHardDeleteAt: candidate.scheduledHardDeleteAt,
          status: 'failed',
          error: message,
        });
      }
    }

    return {
      processedAt: now.toISOString(),
      candidates: candidates.length,
      processed: results.length,
      results,
      dryRun,
    };
  }, request);
}

/**
 * Vercel Cron invoca i job in `GET` e non può inviare header custom: senza
 * questo handler lo scheduler riceveva 405 e il job non girava mai.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
