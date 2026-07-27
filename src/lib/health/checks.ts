/**
 * Check di salute delle dipendenze esterne.
 *
 * Unica fonte di verità condivisa da `/api/health/deep` (monitoraggio macchina)
 * e dalla pagina pubblica `/status` (monitoraggio umano). La pagina di stato
 * deve riportare ciò che il sistema misura davvero: qualunque valore scritto a
 * mano lì sarebbe un'affermazione non verificabile verso il pubblico.
 */

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthCheck {
  /** Identificativo tecnico stabile del componente. */
  readonly name: string;
  /** Etichetta leggibile mostrata sulla pagina di stato pubblica. */
  readonly label: string;
  readonly status: HealthStatus;
  readonly latencyMs?: number;
  /** Dettaglio diagnostico. Mai esposto al pubblico: può contenere URL interni. */
  readonly details?: string;
}

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Esegue una probe HTTP mappando esito e latenza su un `HealthCheck`.
 *
 * `classify` riceve lo status HTTP e decide la semantica: ogni provider ha
 * convenzioni diverse su cosa significhi una risposta non-2xx.
 */
async function probe(
  name: string,
  label: string,
  request: () => Promise<Response>,
  classify: (status: number) => HealthStatus,
): Promise<HealthCheck> {
  const start = Date.now();

  try {
    const response = await request();
    return {
      name,
      label,
      status: classify(response.status),
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name,
      label,
      status: 'down',
      latencyMs: Date.now() - start,
      details: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

function notConfigured(name: string, label: string): HealthCheck {
  return { name, label, status: 'down', details: 'not configured' };
}

async function checkSupabase(): Promise<HealthCheck> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  if (!url) return notConfigured('supabase', 'Database (Supabase)');

  return probe(
    'supabase',
    'Database (Supabase)',
    () =>
      fetch(`${url}/auth/v1/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      }),
    (status) => (status >= 200 && status < 300 ? 'ok' : 'degraded'),
  );
}

async function checkUpstash(): Promise<HealthCheck> {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) return notConfigured('upstash', 'Rate limiting (Upstash)');

  return probe(
    'upstash',
    'Rate limiting (Upstash)',
    () =>
      fetch(`${url}/ping`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(2000),
      }),
    (status) => (status >= 200 && status < 300 ? 'ok' : 'degraded'),
  );
}

async function checkStripe(): Promise<HealthCheck> {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) return notConfigured('stripe', 'Fatturazione (Stripe)');

  // `/v1/balance` è un endpoint autenticato: a differenza della radice `/v1`
  // (che risponde 404 a qualsiasi chiave) distingue una chiave valida da una
  // revocata o errata. 401/403 = credenziale non valida, non "servizio su".
  return probe(
    'stripe',
    'Fatturazione (Stripe)',
    () =>
      fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      }),
    (status) => {
      if (status >= 200 && status < 300) return 'ok';
      if (status === 401 || status === 403) return 'down';
      return 'degraded';
    },
  );
}

async function checkAnthropic(): Promise<HealthCheck> {
  const key = process.env['ANTHROPIC_API_KEY'];
  if (!key) return notConfigured('anthropic', 'Motore AI (Anthropic)');

  // `/v1/models` è la probe autenticata più economica: non consuma token.
  return probe(
    'anthropic',
    'Motore AI (Anthropic)',
    () =>
      fetch('https://api.anthropic.com/v1/models?limit=1', {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      }),
    (status) => {
      if (status >= 200 && status < 300) return 'ok';
      if (status === 401 || status === 403) return 'down';
      return 'degraded';
    },
  );
}

/**
 * Esegue tutti i check in parallelo.
 *
 * I check sono indipendenti: un provider giù non deve ritardare o mascherare
 * la diagnosi degli altri.
 */
export async function runHealthChecks(): Promise<readonly HealthCheck[]> {
  return Promise.all([checkSupabase(), checkUpstash(), checkStripe(), checkAnthropic()]);
}

export function overallStatus(checks: readonly HealthCheck[]): HealthStatus {
  if (checks.some((check) => check.status === 'down')) return 'down';
  if (checks.some((check) => check.status === 'degraded')) return 'degraded';
  return 'ok';
}
