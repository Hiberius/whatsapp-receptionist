import { defineConfig, devices } from '@playwright/test';

/**
 * Configurazione E2E.
 *
 * Vincolo di progetto: la suite deve girare in CI senza credenziali reali di
 * Supabase, Stripe o WhatsApp. Le asserzioni verificano quindi redirect, forma
 * della richiesta e feedback in interfaccia — mai l'esito di un'operazione che
 * dipende da un servizio esterno. Un E2E che pretende segreti di produzione non
 * viene mai eseguito e smette di essere un segnale.
 */

const PORT = Number(process.env['E2E_PORT'] ?? 3100);

/**
 * Se valorizzata, la suite gira contro un'istanza già in piedi (preview,
 * staging) e Playwright non avvia nulla.
 */
const EXTERNAL_BASE_URL = process.env['E2E_BASE_URL'];
const BASE_URL = EXTERNAL_BASE_URL ?? `http://127.0.0.1:${PORT}`;

const isCI = process.env['CI'] !== undefined && process.env['CI'] !== '';

/**
 * Gli stessi segnaposto del job `build` in `.github/workflows/ci.yml`, con
 * un'unica differenza deliberata: qui NON impostiamo `UPSTASH_REDIS_REST_URL` /
 * `UPSTASH_REDIS_REST_TOKEN`.
 *
 * Con Upstash configurato, `applyRateLimit` costruisce un client REST e apre una
 * connessione verso l'host segnaposto a ogni richiesta API: in CI significa
 * attese di rete e fallimenti non deterministici su ogni submit di form.
 * Lasciandole vuote, `src/lib/rate-limit/apply.ts` ricade sul `MemoryRateLimiter`
 * in-process — stessa policy, zero rete, esito ripetibile.
 */
const PLACEHOLDER_ENV: Record<string, string> = {
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_APP_URL: BASE_URL,
  NEXT_PUBLIC_SITE_URL: BASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder',
  ANTHROPIC_API_KEY: 'placeholder',
  STRIPE_SECRET_KEY: 'placeholder',
  STRIPE_WEBHOOK_SECRET: 'placeholder',
  WHATSAPP_VERIFY_TOKEN: 'placeholder',
  WHATSAPP_APP_SECRET: 'placeholder',
  WHATSAPP_ACCESS_TOKEN: 'placeholder',
  WHATSAPP_WEBHOOK_HEADER_SECRET: 'placeholder',
  ELEVENLABS_API_KEY: 'placeholder',
  INTERNAL_JOB_SECRET: 'placeholder',
};

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  // Un solo retry: serve a coprire il rumore di rete/avvio, non a nascondere un
  // test instabile. Due esecuzioni restano sotto le soglie di rate limit delle
  // route pubbliche (5 tentativi per IP).
  retries: isCI ? 1 : 0,
  // Worker singolo in CI: il rate limiter di fallback è in-process, quindi le
  // richieste concorrenti condividono lo stesso contatore. Serializzando, il
  // budget per IP resta prevedibile. In locale si lascia decidere a Playwright.
  ...(isCI ? { workers: 1 } : {}),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // La suite gira contro una build di produzione, non contro `next dev`: CSP con
  // nonce, redirect dei guard e output `standalone` sono ciò che va in
  // produzione, ed è quello che vogliamo verificare.
  ...(EXTERNAL_BASE_URL === undefined
    ? {
        webServer: {
          command: `npm run build && npm run start -- --port ${PORT}`,
          url: BASE_URL,
          env: PLACEHOLDER_ENV,
          reuseExistingServer: !isCI,
          // Copre `next build` + avvio a freddo su un runner CI.
          timeout: 420_000,
          stdout: 'pipe' as const,
          stderr: 'pipe' as const,
        },
      }
    : {}),
});
