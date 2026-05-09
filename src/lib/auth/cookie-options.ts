import { type CookieOptions } from '@supabase/ssr';

import { env } from '@/lib/env';

/**
 * Default sicuri per i cookie applicativi (sessione Supabase, CSRF, etc.).
 *
 * Decisioni:
 * - `httpOnly: true`  – impedisce a `document.cookie` di leggere il valore.
 * - `secure: true` solo in produzione, cosi' `localhost` (HTTP) resta usabile
 *   in sviluppo e test.
 * - `sameSite: 'lax'` – `'strict'` romperebbe il redirect OAuth Google
 *   Calendar, perche' il cookie non sarebbe inviato sulla richiesta GET di
 *   ritorno cross-site.
 * - `path: '/'` – il cookie e' valido per tutta l'app.
 * - **Nessun `domain` esplicito**: lasciamo che il browser usi l'host della
 *   richiesta. Settarlo manualmente espone i cookie a sub-domini non desiderati.
 */
const SECURE_DEFAULTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Restituisce un oggetto `CookieOptions` con i default sicuri applicati.
 *
 * Eventuali `overrides` vincono sui default (utile per casi limitati come
 * il logout, dove serve `maxAge: 0`). `domain` non e' mai settato dai default
 * ma puo' essere passato esplicitamente in override quando serve.
 *
 * @param overrides Override parziali (es. `maxAge`, `expires`).
 * @returns CookieOptions pronto da passare a `cookies().set(...)`.
 */
export function getSecureCookieOptions(overrides: CookieOptions = {}): CookieOptions {
  return {
    ...SECURE_DEFAULTS,
    secure: env.NODE_ENV === 'production',
    ...overrides,
  };
}

/**
 * Variante che accetta un `nodeEnv` esplicito, utile a test e a contesti
 * dove `env.NODE_ENV` non riflette la modalita' di esecuzione corrente.
 *
 * @param nodeEnv  Stringa NODE_ENV ('production', 'development', 'test', ...).
 * @param overrides Override parziali.
 */
export function getSecureCookieOptionsForEnv(
  nodeEnv: string,
  overrides: CookieOptions = {},
): CookieOptions {
  return {
    ...SECURE_DEFAULTS,
    secure: nodeEnv === 'production',
    ...overrides,
  };
}
