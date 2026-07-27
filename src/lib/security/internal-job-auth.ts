import { timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';

/**
 * Autenticazione delle route dei job interni.
 *
 * Esistono due modi legittimi di invocare un job, e la differenza non è
 * stilistica ma imposta dalle piattaforme:
 *
 * - **Vercel Cron** invoca in `GET` e può inviare solo
 *   `Authorization: Bearer <CRON_SECRET>`: non supporta header custom. Prima di
 *   questo modulo le route accettavano solo `POST` con header custom, quindi
 *   nessun cron è mai partito in produzione e l'outbox non veniva mai drenato.
 * - **Trigger manuali e scheduler self-hosted** usano l'header custom
 *   `INTERNAL_JOB_HEADER_NAME`, che resta supportato.
 *
 * Entrambi i confronti sono timing-safe.
 */
export interface InternalJobAuthConfig {
  readonly headerName: string;
  readonly headerSecret: string;
  /** Se vuoto ricade su `headerSecret`: il self-hosting resta a una variabile sola. */
  readonly cronSecret: string;
}

function configFromEnv(): InternalJobAuthConfig {
  return {
    headerName: env.INTERNAL_JOB_HEADER_NAME,
    headerSecret: env.INTERNAL_JOB_SECRET,
    cronSecret: env.CRON_SECRET || env.INTERNAL_JOB_SECRET,
  };
}

export function assertInternalJobAuth(
  headers: Headers,
  config: InternalJobAuthConfig = configFromEnv(),
): void {
  if (!config.headerSecret && !config.cronSecret) {
    throw new AppError('internal', 'Internal job secret is not configured', {
      expose: false,
    });
  }

  if (config.headerSecret) {
    const received = headers.get(config.headerName.toLowerCase());
    if (received && safeEqual(received, config.headerSecret)) {
      return;
    }
  }

  if (config.cronSecret) {
    const authorization = headers.get('authorization');
    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (bearer && safeEqual(bearer, config.cronSecret)) {
      return;
    }
  }

  throw new AppError('forbidden', 'Invalid internal job secret');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  // `timingSafeEqual` richiede lunghezze identiche: il confronto di lunghezza
  // non è timing-safe ma non rivela nulla oltre alla lunghezza del segreto.
  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
