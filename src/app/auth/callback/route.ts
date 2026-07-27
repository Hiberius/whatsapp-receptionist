import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { safeDestination } from '@/lib/auth/safe-destination';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Atterraggio del magic link.
 *
 * `magic-link.ts` e `sign-up.ts` configurano entrambi
 * `emailRedirectTo = ${NEXT_PUBLIC_APP_URL}/auth/callback`, ma la route non
 * esisteva: ogni link inviato per email finiva su 404 e nessuno poteva
 * completare l'accesso.
 *
 * Supabase può consegnare la sessione in due forme a seconda della
 * configurazione del progetto: `?code=` (flusso PKCE) oppure
 * `?token_hash=&type=` (link di verifica). Gestiamo entrambe perché quale
 * delle due arrivi dipende da impostazioni lato Supabase che non controlliamo
 * dal codice.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;

  const next = safeDestination(searchParams.get('next'));

  // Supabase segnala i fallimenti (link scaduto, già usato) via query string.
  const providerError = searchParams.get('error_description') ?? searchParams.get('error');
  if (providerError) {
    logger.warn({ providerError }, 'Auth callback ricevuto con errore dal provider');
    return NextResponse.redirect(new URL(loginWithError('link_non_valido'), origin));
  }

  const supabase = await createSupabaseServerClient();

  const code = searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logger.warn({ err: error }, 'Scambio del code per la sessione fallito');
      return NextResponse.redirect(new URL(loginWithError('link_non_valido'), origin));
    }
    return NextResponse.redirect(new URL(next, origin));
  }

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'magiclink' | 'signup' | 'email' | 'recovery' | 'invite',
    });
    if (error) {
      logger.warn({ err: error }, 'Verifica OTP fallita');
      return NextResponse.redirect(new URL(loginWithError('link_non_valido'), origin));
    }
    return NextResponse.redirect(new URL(next, origin));
  }

  logger.warn('Auth callback invocato senza code né token_hash');
  return NextResponse.redirect(new URL(loginWithError('link_incompleto'), origin));
}

function loginWithError(reason: string): string {
  return `/login?error=${encodeURIComponent(reason)}`;
}
