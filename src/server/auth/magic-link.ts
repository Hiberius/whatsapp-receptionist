// Fatto da Claude Code l'8 maggio 2026.
//
// Magic-link login: l'utente inserisce l'email, riceviamo POST /api/auth/magic-link
// e chiamiamo `supabase.auth.signInWithOtp`.
//
// Design anti-enumeration: la response e' sempre `{ ok: true }` indipendentemente
// dall'esistenza dell'account. Eventuali errori upstream Supabase vengono loggati
// ma NON propagati al client (altrimenti un attaccante puo' enumerare gli utenti).
//
// Pattern: factory + DI. Il sender e' iniettabile per i test.

import { logger } from '@/lib/logging/logger';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type MagicLinkInput = {
  email: string;
  requestId: string;
};

export type MagicLinkResult = {
  ok: true;
};

export interface MagicLinkSender {
  send(input: { email: string; redirectTo: string }): Promise<{ error: Error | null }>;
}

export class MagicLinkService {
  constructor(
    private readonly sender: MagicLinkSender,
    private readonly redirectTo: string,
  ) {}

  async request(input: MagicLinkInput): Promise<MagicLinkResult> {
    const email = normalizeEmail(input.email);

    if (!email) {
      // Anti-enumeration: anche se l'email e' invalida, rispondiamo OK lato HTTP.
      // Logghiamo per visibilita' interna.
      logger.info(
        { requestId: input.requestId },
        'Magic link request rejected: invalid email format',
      );
      return { ok: true };
    }

    const { error } = await this.sender.send({ email, redirectTo: this.redirectTo });

    if (error) {
      logger.warn(
        {
          requestId: input.requestId,
          err: error,
        },
        'Magic link sender returned error (response masked for anti-enumeration)',
      );
    } else {
      logger.info(
        {
          requestId: input.requestId,
        },
        'Magic link dispatched',
      );
    }

    return { ok: true };
  }
}

class SupabaseMagicLinkSender implements MagicLinkSender {
  private readonly supabase = createSupabaseAdminClient();

  async send(input: { email: string; redirectTo: string }): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.auth.signInWithOtp({
      email: input.email,
      options: {
        emailRedirectTo: input.redirectTo,
      },
    });

    return { error: error ?? null };
  }
}

export function createMagicLinkService(): MagicLinkService {
  const redirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/callback`;
  return new MagicLinkService(new SupabaseMagicLinkSender(), redirectTo);
}

export function normalizeEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 254) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}
