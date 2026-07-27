import { expect, test, type Page } from '@playwright/test';

import {
  captureApiCall,
  errorEnvelope,
  extractErrorCode,
  successEnvelope,
} from './helpers/api-capture';
import { gotoOk } from './helpers/page-signals';

/**
 * Flusso 4: il form di registrazione invia in JSON e mostra il feedback nella
 * pagina.
 *
 * Il difetto originale era un `<form method="POST" action="/api/auth/sign-up">`
 * nativo: il browser inviava `application/x-www-form-urlencoded`, la route
 * rispondeva 400 `Invalid JSON body`, e la finestra navigava sulla risposta
 * grezza dell'API. Le asserzioni qui sotto colpiscono esattamente quel difetto:
 * tipo di risorsa, content-type, forma del body, URL invariato, feedback a
 * schermo.
 */

const SIGN_UP_ROUTE = '**/api/auth/sign-up';
const FEEDBACK = '#register-form-errors';

async function fillRegisterForm(page: Page, email: string): Promise<void> {
  await page.getByLabel('Nome studio o azienda', { exact: true }).fill('Studio E2E');
  await page.getByLabel('Email di lavoro', { exact: true }).fill(email);
  await page.getByLabel('Settore', { exact: true }).selectOption('dental');
}

test.describe('Registrazione', () => {
  test('invia un POST JSON con i campi del form, senza navigare', async ({ page }) => {
    const capture = await captureApiCall(page, SIGN_UP_ROUTE, {
      status: 200,
      body: successEnvelope({ tenantId: 'e2e-tenant' }),
    });

    await gotoOk(page, '/register');
    const feedback = page.locator(FEEDBACK);
    await expect(feedback).toHaveText('');

    await fillRegisterForm(page, 'e2e-success@example.com');
    await page.getByRole('button', { name: 'Crea account' }).click();

    await expect(feedback).toContainText('Account creato');
    // Il feedback esce dallo stato "solo per screen reader" e diventa visibile.
    await expect(feedback).not.toHaveClass(/sr-only/);
    // Nessuna navigazione: si resta sulla pagina che ha inviato il form.
    await expect(page).toHaveURL(/\/register$/);

    expect(capture.count()).toBe(1);
    const request = capture.first();
    // `document` significherebbe che è stato il browser a navigare sulla route:
    // è la firma della regressione al form nativo.
    expect(request.resourceType, 'il form deve usare fetch, non una navigazione').toBe('fetch');
    expect(request.method).toBe('POST');
    expect(request.contentType).toContain('application/json');
    expect(request.jsonBody).toEqual({
      business_name: 'Studio E2E',
      email: 'e2e-success@example.com',
      vertical: 'dental',
    });
  });

  test("mostra l'errore dell'API nella pagina e lo annuncia come alert", async ({ page }) => {
    const capture = await captureApiCall(page, SIGN_UP_ROUTE, {
      status: 429,
      body: errorEnvelope('rate_limited', 'Rate limit exceeded. Retry after 900s'),
    });

    await gotoOk(page, '/register');

    await fillRegisterForm(page, 'e2e-error@example.com');
    await page.getByRole('button', { name: 'Crea account' }).click();

    const feedback = page.locator(FEEDBACK);
    await expect(feedback).toContainText('Troppi tentativi ravvicinati');
    await expect(feedback).toHaveAttribute('role', 'alert');
    await expect(page).toHaveURL(/\/register$/);

    expect(capture.count()).toBe(1);
    expect(capture.first().jsonBody).toEqual({
      business_name: 'Studio E2E',
      email: 'e2e-error@example.com',
      vertical: 'dental',
    });
  });

  test('la route reale accetta il body prodotto dal form', async ({ page }) => {
    /**
     * Unico test che raggiunge davvero `/api/auth/sign-up`. Non serve alcun
     * segreto: con le env segnaposto Supabase non è raggiungibile e la route
     * risponde 502 `upstream_error`. Proprio per questo l'esito è informativo —
     * un 502 dimostra che rate limit e schema Zod sono stati superati e che solo
     * il servizio esterno è mancato.
     *
     * Ciò che il test vieta è il contrario: `bad_request` significa body non
     * JSON o campi non conformi allo schema, cioè la regressione di formato.
     * Una risposta HTML significherebbe route inesistente.
     */
    await gotoOk(page, '/register');

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/sign-up') && response.request().method() === 'POST',
    );

    await fillRegisterForm(page, 'e2e-real@example.com');
    await page.getByRole('button', { name: 'Crea account' }).click();

    const response = await responsePromise;
    expect(response.status(), 'la route deve esistere e accettare POST').not.toBe(404);
    expect(response.status()).not.toBe(405);
    expect(
      response.headers()['content-type'],
      'la route deve restituire un envelope JSON, non una pagina di errore',
    ).toContain('application/json');

    const payload: unknown = await response.json();
    expect(
      extractErrorCode(payload),
      'il body inviato dal form non è stato accettato dalla route',
    ).not.toBe('bad_request');

    // In ogni caso il browser resta sulla pagina e mostra un messaggio.
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator(FEEDBACK)).not.toHaveText('');
  });
});
