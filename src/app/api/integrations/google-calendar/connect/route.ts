import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import { toAppError } from '@/lib/errors/app-error';
import { requireSession } from '@/lib/auth/session';
import { createGoogleCalendarOAuthService } from '@/server/integrations/google-calendar-oauth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const service = createGoogleCalendarOAuthService();
    const authorizationUrl = service.createAuthorizationUrl({
      session,
      returnTo: request.nextUrl.searchParams.get('returnTo'),
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

function oauthErrorResponse(error: unknown): NextResponse {
  const appError = toAppError(error);

  return NextResponse.redirect(
    new URL(`/settings?google_calendar=error&code=${appError.code}`, appBaseUrl()),
    { status: appError.status >= 500 ? 307 : 303 },
  );
}

function appBaseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
