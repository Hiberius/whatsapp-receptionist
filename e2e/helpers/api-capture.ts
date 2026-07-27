import { type Page, type Request } from '@playwright/test';

/**
 * Registratore delle richieste che il browser invia a una route API.
 *
 * Serve a testare il *contratto* del form, non il mock: la richiesta viene
 * catturata così com'è partita dal browser (metodo, tipo di risorsa, header,
 * body grezzo) e le spec asseriscono su quei valori. Se qualcuno rimuove la
 * serializzazione JSON, o riporta il form a un `<form method="POST">` nativo,
 * i valori registrati cambiano e il test fallisce.
 */
export interface CapturedRequest {
  readonly method: string;
  /**
   * `fetch`/`xhr` per una chiamata programmatica, `document` per una
   * navigazione del browser: è la differenza fra "il form invia in JSON" e
   * "il browser naviga sulla risposta grezza dell'API".
   */
  readonly resourceType: string;
  readonly contentType: string | null;
  readonly rawBody: string | null;
  /** Body interpretato come JSON, oppure `null` se non era JSON valido. */
  readonly jsonBody: unknown;
}

export interface StubbedResponse {
  readonly status: number;
  /** Envelope restituito al posto della route reale. */
  readonly body: unknown;
}

export interface ApiCapture {
  readonly count: () => number;
  readonly all: () => readonly CapturedRequest[];
  /** Prima richiesta catturata. Lancia se non ne è arrivata nessuna. */
  readonly first: () => CapturedRequest;
}

function describeRequest(request: Request): CapturedRequest {
  const rawBody = request.postData();
  const headers = request.headers();

  let jsonBody: unknown = null;
  if (rawBody !== null) {
    try {
      jsonBody = JSON.parse(rawBody);
    } catch {
      jsonBody = null;
    }
  }

  return {
    method: request.method(),
    resourceType: request.resourceType(),
    contentType: headers['content-type'] ?? null,
    rawBody,
    jsonBody,
  };
}

/**
 * Intercetta le chiamate a `urlPattern`, ne registra la forma e risponde con
 * `stub` senza mai raggiungere il server.
 *
 * Va installato prima della `page.goto` che porta al form.
 */
export async function captureApiCall(
  page: Page,
  urlPattern: string,
  stub: StubbedResponse,
): Promise<ApiCapture> {
  const captured: CapturedRequest[] = [];

  await page.route(urlPattern, async (route, request) => {
    captured.push(describeRequest(request));
    await route.fulfill({
      status: stub.status,
      contentType: 'application/json',
      body: JSON.stringify(stub.body),
    });
  });

  return {
    count: () => captured.length,
    all: () => [...captured],
    first: () => {
      const request = captured[0];
      if (request === undefined) {
        throw new Error(`Nessuna richiesta catturata per il pattern "${urlPattern}"`);
      }
      return request;
    },
  };
}

/** Envelope di successo prodotto da `jsonHandler` (`src/lib/api/json.ts`). */
export function successEnvelope(data: unknown): unknown {
  return { ok: true, data };
}

/** Envelope di errore prodotto da `jsonHandler` (`src/lib/api/json.ts`). */
export function errorEnvelope(code: string, message: string): unknown {
  return { ok: false, error: { code, message } };
}

/**
 * Estrae `error.code` da un envelope `jsonHandler`, restituendo `null` quando
 * la risposta non ha quella forma. Narrowing esplicito, nessun cast a `any`.
 */
export function extractErrorCode(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) {
    return null;
  }

  const { error } = payload as { error: unknown };
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const { code } = error as { code: unknown };
  return typeof code === 'string' ? code : null;
}
