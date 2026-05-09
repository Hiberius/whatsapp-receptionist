import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import { toAppError } from '@/lib/errors/app-error';
import { requireSession } from '@/lib/auth/session';
import { createGoogleCalendarOAuthService } from '@/server/integrations/google-calendar-oauth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const service = createGoogleCalendarOAuthService();
    const result = await service.handleCallback({
      session,
      code: request.nextUrl.searchParams.get('code'),
      state: request.nextUrl.searchParams.get('state'),
      error: request.nextUrl.searchParams.get('error'),
    });

    return NextResponse.redirect(new URL(result.returnTo, appBaseUrl()));
  } catch (error) {
    const appError = toAppError(error);

    return NextResponse.redirect(
      new URL(`/settings?google_calendar=error&code=${appError.code}`, appBaseUrl()),
      { status: appError.status >= 500 ? 307 : 303 },
    );
  }
}

function appBaseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
