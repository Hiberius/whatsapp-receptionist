import { AppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * 10s: sta sotto ai ~20s che Meta concede al webhook WhatsApp prima di
 * considerare la consegna fallita e ritentare, e sotto al limite di durata
 * delle function serverless. Lascia comunque margine alle API lente
 * (Anthropic in generazione lunga) senza tenere una connessione appesa.
 */
export const DEFAULT_TIMEOUT_MS = 10_000;

const DEFAULT_RETRY_BASE_DELAY_MS = 250;

/**
 * PUT e DELETE sono idempotenti per semantica HTTP; POST/PATCH no, quindi
 * un retry automatico rischia di duplicare un invio o un addebito.
 */
const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'HEAD',
  'OPTIONS',
  'PUT',
  'DELETE',
]);

export type FetchWithTimeoutOptions = {
  /** Timeout della singola richiesta in ms. Default: {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /**
   * Tentativi aggiuntivi dopo il primo, solo per errori di trasporto
   * (timeout / rete). Default 0: il retry è sempre una scelta esplicita
   * del chiamante, mai un comportamento implicito.
   */
  retries?: number;
  /** Ritardo base del backoff esponenziale (base * 2^(tentativo-1)). */
  retryBaseDelayMs?: number;
  /**
   * Dichiara idempotente una richiesta che il metodo HTTP non garantisce tale
   * (es. POST con Idempotency-Key Stripe). Necessario per usare `retries`
   * su POST/PATCH.
   */
  idempotent?: boolean;
  /** Etichetta usata nei messaggi d'errore al posto di metodo + URL. */
  label?: string;
  /** Implementazione di fetch iniettabile (test). Default: `globalThis.fetch`. */
  fetchImpl?: FetchLike;
  /** Attesa iniettabile per il backoff (test). */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Esegue una fetch con timeout obbligatorio, componendo l'eventuale
 * `signal` del chiamante invece di scartarlo.
 *
 * Timeout ed errori di rete diventano `AppError('upstream_error')`, codice che
 * l'outbox WhatsApp già considera ritentabile. L'abort richiesto dal chiamante
 * viene invece rilanciato inalterato: è una cancellazione voluta, non un
 * guasto upstream, e non deve finire nella coda dei retry.
 */
export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
    label,
    fetchImpl = globalThis.fetch,
    sleep = defaultSleep,
  } = options;

  const target = label ?? describeTarget(input, init);
  const callerSignal = init.signal ?? null;

  assertRetryIsSafe({ retries, input, init, idempotent: options.idempotent === true, target });

  const attempts = Math.max(1, Math.floor(retries) + 1);
  let lastError: AppError | undefined;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);

    try {
      return await fetchImpl(input, {
        ...init,
        signal: combineSignals(timeoutSignal, callerSignal),
      });
    } catch (error) {
      if (callerSignal?.aborted === true) {
        throw error;
      }

      lastError = timeoutSignal.aborted
        ? new AppError('upstream_error', `${target} timed out after ${timeoutMs}ms`, {
            cause: error,
            expose: false,
          })
        : new AppError('upstream_error', `${target} failed with a network error`, {
            cause: error,
            expose: false,
          });

      logger.warn(
        { target, attempt, attempts, timeoutMs, timedOut: timeoutSignal.aborted },
        'Outbound HTTP request failed',
      );

      if (attempt >= attempts) {
        break;
      }

      await sleep(retryBaseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError ?? new AppError('upstream_error', `${target} failed`, { expose: false });
}

function assertRetryIsSafe(params: {
  retries: number;
  input: string | URL | Request;
  init: RequestInit;
  idempotent: boolean;
  target: string;
}): void {
  if (params.retries <= 0) {
    return;
  }

  const method = resolveMethod(params.input, params.init);

  if (!params.idempotent && !IDEMPOTENT_METHODS.has(method)) {
    throw new AppError(
      'internal',
      `Refusing to retry non-idempotent ${method} (${params.target}); pass idempotent: true only when the request carries an idempotency key`,
      { expose: false },
    );
  }

  // Un body a stream si consuma al primo tentativo: il retry invierebbe un corpo vuoto.
  if (isStreamBody(params.init.body)) {
    throw new AppError('internal', `Cannot retry ${params.target}: request body is a stream`, {
      expose: false,
    });
  }
}

function combineSignals(timeoutSignal: AbortSignal, callerSignal: AbortSignal | null): AbortSignal {
  if (callerSignal === null) {
    return timeoutSignal;
  }

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([callerSignal, timeoutSignal]);
  }

  // Fallback per runtime senza AbortSignal.any (Node < 20.3).
  const controller = new AbortController();

  for (const source of [callerSignal, timeoutSignal]) {
    if (source.aborted) {
      controller.abort(source.reason);
      return controller.signal;
    }

    source.addEventListener('abort', () => controller.abort(source.reason), { once: true });
  }

  return controller.signal;
}

function resolveMethod(input: string | URL | Request, init: RequestInit): string {
  if (typeof init.method === 'string') {
    return init.method.toUpperCase();
  }

  if (isRequest(input)) {
    return input.method.toUpperCase();
  }

  return 'GET';
}

function describeTarget(input: string | URL | Request, init: RequestInit): string {
  return `${resolveMethod(input, init)} ${redactUrl(resolveUrl(input))}`;
}

function resolveUrl(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input;
  }

  return isRequest(input) ? input.url : input.href;
}

/** La query string può contenere token OAuth: nei log e nei messaggi resta solo origin + path. */
function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);

    return `${url.origin}${url.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

function isRequest(input: string | URL | Request): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}

function isStreamBody(body: RequestInit['body']): boolean {
  return typeof ReadableStream !== 'undefined' && body instanceof ReadableStream;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
