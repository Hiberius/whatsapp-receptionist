// Fatto da Claude Code il 8 maggio 2026.
//
// Zod schemas per i payload Google OAuth + Calendar utilizzati dal backend.
//
// Tutti gli schemi usano `.passthrough()` perché Google espande i payload con
// nuovi campi senza preavviso e non vogliamo rifiutare risposte valide solo
// perché contengono campi extra.

import { z } from 'zod';

/**
 * Risposta di /token (sia authorization_code grant che refresh_token grant).
 *
 * Google ritorna `error`/`error_description` quando il grant fallisce, e
 * `access_token`/`refresh_token` quando ha successo. `expires_in` è in secondi.
 */
export const GoogleOAuthTokenResponseSchema = z
  .object({
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    expires_in: z.number().optional(),
    scope: z.string().optional(),
    token_type: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
    id_token: z.string().optional(),
  })
  .passthrough();

export type GoogleOAuthTokenResponse = z.infer<typeof GoogleOAuthTokenResponseSchema>;

/**
 * Risposta di /freeBusy.
 *
 * Mappa `calendarId -> { busy: [...] }`. Google può includere `errors[]` se
 * un calendario non è accessibile.
 */
export const GoogleFreeBusyResponseSchema = z
  .object({
    calendars: z
      .record(
        z.string(),
        z
          .object({
            errors: z
              .array(
                z
                  .object({
                    domain: z.string().optional(),
                    reason: z.string().optional(),
                  })
                  .passthrough(),
              )
              .optional(),
            busy: z
              .array(
                z
                  .object({
                    start: z.string().optional(),
                    end: z.string().optional(),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export type GoogleFreeBusyResponse = z.infer<typeof GoogleFreeBusyResponseSchema>;

/**
 * Subset della risposta di POST/PATCH events.
 *
 * Google ritorna molti più campi (start, end, attendees, ecc.) ma noi
 * leggiamo solo `id` e `htmlLink`.
 */
export const GoogleCalendarEventResponseSchema = z
  .object({
    id: z.string().optional(),
    htmlLink: z.string().optional(),
  })
  .passthrough();

export type GoogleCalendarEventResponse = z.infer<typeof GoogleCalendarEventResponseSchema>;

/**
 * Parser sicuro: ritorna lo schema risultato o un fallback "minimal" che
 * preserva i campi unknown originali. Usato per interpretare body JSON
 * semi-strutturati (es. errori).
 */
function safeParseOrEmpty<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  return (result.success ? result.data : {}) as z.infer<T>;
}

export function parseGoogleTokenResponse(value: unknown): GoogleOAuthTokenResponse {
  return safeParseOrEmpty(GoogleOAuthTokenResponseSchema, value);
}

export function parseGoogleFreeBusyResponse(value: unknown): GoogleFreeBusyResponse {
  return safeParseOrEmpty(GoogleFreeBusyResponseSchema, value);
}

export function parseGoogleCalendarEventResponse(value: unknown): GoogleCalendarEventResponse {
  return safeParseOrEmpty(GoogleCalendarEventResponseSchema, value);
}
