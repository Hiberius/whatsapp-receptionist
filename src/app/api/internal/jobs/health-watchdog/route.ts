import { type NextRequest, type NextResponse } from 'next/server';

import { jsonHandler } from '@/lib/api/json';
import { assertInternalJobAuth } from '@/lib/security/internal-job-auth';
import { createHealthWatchdogService } from '@/server/monitoring/health-watchdog';

export const runtime = 'nodejs';

/**
 * Sorveglia la coda di uscita e avvisa quando smette di essere drenata.
 *
 * Deliberatamente separato dal worker dell'outbox: se fosse lo stesso job, un
 * worker fermo impedirebbe anche l'allarme sul worker fermo.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return jsonHandler(async () => {
    assertInternalJobAuth(request.headers);

    const service = createHealthWatchdogService();

    return service.check();
  }, request);
}

/**
 * Vercel Cron invoca i job in `GET` e non può inviare header custom.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
