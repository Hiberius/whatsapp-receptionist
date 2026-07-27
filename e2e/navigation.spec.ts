import { expect, test } from '@playwright/test';

import { gotoOk } from './helpers/page-signals';

/**
 * Flusso 1: la landing risponde e la navigazione principale funziona.
 *
 * Le asserzioni evitano di ricalcare le copy della landing (cambiano spesso):
 * verificano struttura e destinazione, non testo di marketing.
 */
test.describe('Landing e navigazione principale', () => {
  test('la landing risponde 200 con una sola intestazione di primo livello', async ({ page }) => {
    await gotoOk(page, '/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible();
  });

  test('il menu principale raggiunge le pagine dichiarate', async ({ page }) => {
    await gotoOk(page, '/');

    const mainNav = page.getByRole('navigation', { name: 'Navigazione principale' });

    await mainNav.getByRole('link', { name: 'Piani' }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goBack();
    await mainNav.getByRole('link', { name: 'Verticali' }).click();
    await expect(page).toHaveURL(/\/verticali$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goBack();
    await mainNav.getByRole('link', { name: 'Blog' }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('le azioni di intestazione portano a registrazione e accesso', async ({ page }) => {
    await gotoOk(page, '/');
    const header = page.getByRole('banner');

    await header.getByRole('link', { name: 'Prova gratis' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('button', { name: 'Crea account' })).toBeVisible();

    await gotoOk(page, '/');
    await header.getByRole('link', { name: 'Accedi' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Invia link di accesso' })).toBeVisible();
  });

  test('il logo riporta alla home da una pagina interna', async ({ page }) => {
    await gotoOk(page, '/pricing');

    await page
      .getByRole('banner')
      .getByRole('link', { name: /Ambrogio\.ai/ })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible();
  });
});
