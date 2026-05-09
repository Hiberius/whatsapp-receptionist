/**
 * Definizione centralizzata delle policy di rate limit dell'applicazione.
 *
 * Ogni policy specifica:
 * - `window`: finestra temporale in **secondi**.
 * - `limit`: numero massimo di richieste consentite in quella finestra.
 *
 * Le policy sono nominate per intent (es. `authLogin`, `onboarding`)
 * cosi' che chi applica un rate limit non si accoppi a numeri magici
 * sparsi nel codebase.
 */
export type RateLimitPolicy = {
  /** Finestra in secondi. */
  readonly window: number;
  /** Numero massimo di tentativi nella finestra. */
  readonly limit: number;
};

const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RATE_LIMIT_POLICIES = {
  /** Login Supabase via route custom (5 tentativi / 15 min). */
  authLogin: { window: 15 * MINUTE, limit: 5 },
  /** Reset password (3 / ora). */
  authPasswordReset: { window: 1 * HOUR, limit: 3 },
  /** Magic link (3 / ora). */
  authMagicLink: { window: 1 * HOUR, limit: 3 },
  /** Onboarding tenant (10 / ora per utente). */
  onboarding: { window: 1 * HOUR, limit: 10 },
  /** Scrittura settings (30 / minuto per tenant). */
  settingsWrite: { window: 1 * MINUTE, limit: 30 },
  /** Export GDPR (1 / 24h). */
  gdprExport: { window: 1 * DAY, limit: 1 },
  /** Cancellazione GDPR (1 / 24h). */
  gdprDelete: { window: 1 * DAY, limit: 1 },
  /** Contact form pubblico (5 / minuto per IP, anti-spam). */
  contactForm: { window: 1 * MINUTE, limit: 5 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyKey = keyof typeof RATE_LIMIT_POLICIES;
