import { expect, test, type Page } from '@playwright/test';

import {
  captureApiCall,
  errorEnvelope,
  extractErrorCode,
  successEnvelope,
} from './helpers/api-capture';
import { gotoOk } from './helpers/page-signals';

/**
 * Flusso 5: il form di contatto si comporta come quello di registrazione —
 * POST JSON, nessuna navigazione, feedback nella pagina.
 *
 * Qui la forma del body è più insidiosa di quanto sembri: `consent` è una
 * checkbox, che un form nativo invierebbe come stringa `"on"`, mentre lo schema
 * pretende `z.literal(true)`; `company` vuoto va inviato come `null`, non come
 * stringa vuota. Le asserzioni confrontano il body intero, quindi qualunque
 * ritorno a una serializzazione ingenua fa fallire il test.
 */

const CONTACT_ROUTE = '**/api/contact';
const FEEDBACK = '#contact-form-errors';

interface ContactInput {
  readonly email: string;
  readonly company: string | null;
}

async function fillContactForm(page: Page, input: ContactInput): Promise<void> {
  await page.getByLabel('Nome', { exact: true }).fill('Mario Rossi');
  await page.getByLabel('Email', { exact: true }).fill(input.email);
  if (input.company !== null) {
    await page.getByLabel('Studio o azienda', { exact: true }).fill(input.company);
  }
  await page.getByLabel('Di cosa vuoi parlare?', { exact: true }).selectOption('sales');
  await page
    .getByLabel('Messaggio', { exact: true })
    .fill('Vorrei provare Ambrogio nel mio studio.');
  await page.getByLabel(/Acconsento al trattamento dei dati/).check();
}

test.describe('Form di contatto', () => {
  test('normalizza i campi nel body JSON atteso dallo schema', async ({ page }) => {
    const capture = await captureApiCall(page, CONTACT_ROUTE, {
      status: 200,
      body: successEnvelope({ submissionId: 'e2e-submission' }),
    });

    await gotoOk(page, '/contact');
    const feedback = page.locator(FEEDBACK);
    await expect(feedback).toHaveText('');

    await fillContactForm(page, { email: 'e2e-contact@example.com', company: null });
    await page.getByRole('button', { name: 'Invia messaggio' }).click();

    await expect(feedback).toContainText('Messaggio inviato');
    await expect(feedback).not.toHaveClass(/sr-only/);
    await expect(page).toHaveURL(/\/contact$/);

    expect(capture.count()).toBe(1);
    const request = capture.first();
    expect(request.resourceType, 'il form deve usare fetch, non una navigazione').toBe('fetch');
    expect(request.method).toBe('POST');
    expect(request.contentType).toContain('application/json');
    expect(request.jsonBody).toEqual({
      name: 'Mario Rossi',
      email: 'e2e-contact@example.com',
      // Campo lasciato vuoto: lo schema accetta `null`, non la stringa vuota.
      company: null,
      topic: 'sales',
      message: 'Vorrei provare Ambrogio nel mio studio.',
      // Checkbox: booleano `true`, non la stringa "on" di un form nativo.
      consent: true,
    });
  });

  test('invia la ragione sociale quando è compilata', async ({ page }) => {
    const capture = await captureApiCall(page, CONTACT_ROUTE, {
      status: 200,
      body: successEnvelope({ submissionId: 'e2e-submission' }),
    });

    await gotoOk(page, '/contact');
    await fillContactForm(page, { email: 'e2e-company@example.com', company: 'Studio Rossi' });
    await page.getByRole('button', { name: 'Invia messaggio' }).click();

    await expect(page.locator(FEEDBACK)).toContainText('Messaggio inviato');
    expect(capture.first().jsonBody).toMatchObject({ company: 'Studio Rossi' });
  });

  test("mostra l'errore dell'API nella pagina e lo annuncia come alert", async ({ page }) => {
    await captureApiCall(page, CONTACT_ROUTE, {
      status: 500,
      body: errorEnvelope('internal_error', 'Internal server error'),
    });

    await gotoOk(page, '/contact');
    await fillContactForm(page, { email: 'e2e-fail@example.com', company: null });
    await page.getByRole('button', { name: 'Invia messaggio' }).click();

    const feedback = page.locator(FEEDBACK);
    await expect(feedback).toContainText('Il servizio non è raggiungibile');
    await expect(feedback).toHaveAttribute('role', 'alert');
    await expect(page).toHaveURL(/\/contact$/);
  });

  test('la route reale accetta il body prodotto dal form', async ({ page }) => {
    /**
     * Unico test che raggiunge davvero `/api/contact`. Con le env segnaposto la
     * persistenza non è disponibile e la route risponde 502 `upstream_error`:
     * è la prova che rate limit e schema Zod sono stati superati. Il test vieta
     * `bad_request`, che è invece la firma del body nel formato sbagliato.
     */
    await gotoOk(page, '/contact');

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/contact') && response.request().method() === 'POST',
    );

    await fillContactForm(page, { email: 'e2e-real@example.com', company: null });
    await page.getByRole('button', { name: 'Invia messaggio' }).click();

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

    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.locator(FEEDBACK)).not.toHaveText('');
  });
});
