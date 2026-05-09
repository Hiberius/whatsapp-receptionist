// Fatto da Claude Code il 27 aprile 2026.
//
// Tipi envelope per le risposte JSON. Allineate a `src/lib/api/json.ts` che
// emette { ok: true, data } | { ok: false, error: { code, message } }.

import { z } from 'zod';

export type ApiErrorCode =
  | 'bad_request'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'upstream_error'
  | 'webhook_rejected'
  | 'internal'
  | 'network_error'
  | 'invalid_response';

export const ApiErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

/**
 * Errore tipizzato lanciato da `apiFetch`. Espone codice, status HTTP e
 * messaggio cosi' i consumer possono distinguere errori utente vs server.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  override readonly cause: unknown;

  constructor(input: { code: ApiErrorCode; message: string; status: number; cause?: unknown }) {
    super(input.message);
    this.name = 'ApiError';
    this.code = input.code;
    this.status = input.status;
    this.cause = input.cause;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
