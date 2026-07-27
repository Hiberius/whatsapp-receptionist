import { expect, type Page, type Response } from '@playwright/test';

/**
 * Naviga e pretende un 200. `page.goto` può restituire `null` (es. navigazione
 * verso lo stesso anchor): qui è sempre un errore, perché stiamo verificando
 * che una pagina *risponda*.
 */
export async function gotoOk(page: Page, path: string): Promise<Response> {
  const response = await page.goto(path);

  expect(response, `nessuna risposta HTTP per ${path}`).not.toBeNull();
  // `response` è tipizzato come possibilmente null: l'asserzione sopra è la
  // verifica, questo è il narrowing.
  if (response === null) {
    throw new Error(`nessuna risposta HTTP per ${path}`);
  }

  expect(response.status(), `${path} non risponde 200`).toBe(200);
  return response;
}

export interface ConsoleWatcher {
  /** Errori raccolti finora, in ordine di arrivo. */
  readonly errors: () => readonly string[];
}

/**
 * Chromium riporta come `console.error` anche il fallimento del recupero della
 * favicon, che il browser chiede da solo e che non dipende dal nostro codice.
 * È l'unica eccezione ammessa: qualunque altro errore va corretto, non filtrato.
 */
const BROWSER_INITIATED_NOISE = /favicon/i;

/**
 * Raccoglie gli errori osservabili da una pagina: eccezioni JavaScript non
 * gestite (`pageerror`) e messaggi `console.error`.
 *
 * Va installato prima della `page.goto`, altrimenti gli errori emessi durante
 * il caricamento iniziale non vengono visti.
 */
export function watchPageErrors(page: Page): ConsoleWatcher {
  const collected: string[] = [];

  page.on('pageerror', (error) => {
    collected.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }
    const text = message.text();
    if (BROWSER_INITIATED_NOISE.test(text)) {
      return;
    }
    collected.push(`console.error: ${text}`);
  });

  return { errors: () => [...collected] };
}
