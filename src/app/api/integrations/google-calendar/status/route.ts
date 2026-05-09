import { type NextRequest } from 'next/server';

import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { createGoogleCalendarOAuthService } from '@/server/integrations/google-calendar-oauth';

export async function GET(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    const service = createGoogleCalendarOAuthService();

    return service.getStatus({
      session,
      returnTo: request.nextUrl.searchParams.get('returnTo'),
    });
  }, request);
}
