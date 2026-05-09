// Fatto da Claude Code il 27 aprile 2026.
import { type NextRequest } from 'next/server';

import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { createUsageLimitsService } from '@/server/usage/limits';

export async function GET(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    const service = createUsageLimitsService();

    return service.getDashboardSnapshot({ session });
  }, request);
}
