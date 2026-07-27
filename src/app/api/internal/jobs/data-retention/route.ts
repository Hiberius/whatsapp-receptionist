import { type NextRequest, type NextResponse } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { assertInternalJobAuth } from '@/lib/security/internal-job-auth';
import { createDataRetentionService } from '@/server/gdpr/data-retention';

export const runtime = 'nodejs';

const RetentionBodySchema = z
  .object({
    dryRun: z.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(50_000).optional(),
  })
  .strict();

/**
 * Applica la retention dichiarata nella privacy policy.
 *
 * `dryRun` esiste perché la prima esecuzione su dati reali è irreversibile:
 * conviene poter osservare quante righe verrebbero cancellate prima di
 * cancellarle davvero.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return jsonHandler(async () => {
    assertInternalJobAuth(request.headers);

    const body = RetentionBodySchema.parse(await readJsonBody(request));
    const service = createDataRetentionService();

    return service.sweep({
      ...(body.dryRun !== undefined ? { dryRun: body.dryRun } : {}),
      ...(body.limit !== undefined ? { limit: body.limit } : {}),
    });
  }, request);
}

/**
 * Vercel Cron invoca i job in `GET` e non può inviare header custom.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
