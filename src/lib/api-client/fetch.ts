// Fatto da Claude Code il 27 aprile 2026.
//
// `apiFetch<T>(...)` e' il fetcher centrale del client. Si occupa di:
// - serializzare il body JSON;
// - normalizzare gli URL (assoluti o relativi alla baseUrl);
// - parsare l'envelope { ok, data | error };
// - validare `data` con lo schema Zod fornito;
// - mappare errori di rete e di parsing a `ApiError` tipizzato.
//
// USO PREVISTO: browser-side (Client Components, useEffect, hook custom).
// Per uso server-side (RSC/Server Actions) invocare direttamente i service
// in `src/server/...`. Il fetcher non gestisce cookie pass-through e non e'
// pensato per chiamate server-to-server.

import { z } from 'zod';

import { ApiError, ApiErrorEnvelopeSchema, type ApiErrorCode } from './types';

export type ApiFetchOptions<TSchema extends z.ZodTypeAny> = {
  /**
   * Schema Zod che descrive il payload `data` di una risposta success.
   */
  schema: TSchema;
  /**
   * Metodo HTTP. Default: 'GET'.
   */
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /**
   * Body JSON-serializzabile. Aggiunge automaticamente
   * `Content-Type: application/json`.
   */
  body?: unknown;
  /**
   * Header aggiuntivi.
   */
  headers?: Record<string, string>;
  /**
   * AbortSignal per cancellare la richiesta in flight.
   */
  signal?: AbortSignal;
  /**
   * Base URL per percorsi relativi. Default: stringa vuota (relative path).
   * Utile per testing con un URL fittizio.
   */
  baseUrl?: string;
};

export async function apiFetch<TSchema extends z.ZodTypeAny>(
  path: string,
  options: ApiFetchOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  const { schema, method = 'GET', body, headers = {}, signal, baseUrl = '' } = options;

  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(signal !== undefined ? { signal } : {}),
      credentials: 'same-origin',
    });
  } catch (cause) {
    throw new ApiError({
      code: 'network_error',
      message: 'Network request failed',
      status: 0,
      cause,
    });
  }

  let parsed: unknown;

  try {
    parsed = await response.json();
  } catch (cause) {
    throw new ApiError({
      code: 'invalid_response',
      message: 'Response was not valid JSON',
      status: response.status,
      cause,
    });
  }

  const errorEnvelope = ApiErrorEnvelopeSchema.safeParse(parsed);
  if (errorEnvelope.success) {
    throw new ApiError({
      code: normalizeErrorCode(errorEnvelope.data.error.code),
      message: errorEnvelope.data.error.message,
      status: response.status,
    });
  }

  const successShape = z.object({ ok: z.literal(true), data: z.unknown() }).safeParse(parsed);
  if (!successShape.success) {
    throw new ApiError({
      code: 'invalid_response',
      message: 'Response did not use the API envelope',
      status: response.status,
      cause: successShape.error,
    });
  }

  const dataParse = schema.safeParse(successShape.data.data);
  if (!dataParse.success) {
    throw new ApiError({
      code: 'invalid_response',
      message: 'Response payload did not match expected schema',
      status: response.status,
      cause: dataParse.error,
    });
  }

  return dataParse.data as z.infer<TSchema>;
}

function normalizeErrorCode(code: string): ApiErrorCode {
  switch (code) {
    case 'bad_request':
    case 'conflict':
    case 'unauthorized':
    case 'forbidden':
    case 'not_found':
    case 'rate_limited':
    case 'upstream_error':
    case 'webhook_rejected':
    case 'internal':
      return code;
    default:
      return 'internal';
  }
}
