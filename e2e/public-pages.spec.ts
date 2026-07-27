import { expect, test } from '@playwright/test';

import { gotoOk, watchPageErrors } from './helpers/page-signals';

/**
 * Flusso 6: le pagine pubbliche chiave rispondono 200 e non espongono errori in
 * console.
 *
 * L'elenco è volutamente limitato alle superfici che non dipendono da servizi
 * esterni. `/status` è escluso di proposito: esegue gli health check delle
 * dipendenze reali, quindi in CI — dove Supabase, Stripe e WhatsApp sono
 * segnaposto — misurerebbe l'assenza di credenziali invece della salute della
 * pagina.
 */
const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/verticali',
  '/contact',
  '/blog',
  '/help',
  '/about',
  '/docs',
  '/case-studies',
  '/changelog',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookie',
  '/legal/dpa',
  '/legal/security',
  '/login',
  '/register',
] as const;

test.describe('Pagine pubbliche', () => {
  for (const path of PUBLIC_PATHS) {
    test(`${path} risponde 200 senza errori in console`, async ({ page }) => {
      // Installato prima della navigazione: gli errori emessi durante il
      // caricamento iniziale sono i più interessanti.
      const watcher = watchPageErrors(page);

      await gotoOk(page, path);

      // Un solo h1: struttura del documento, non copy. Le intestazioni cambiano,
      // la gerarchia no.
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Attende l'idratazione: la CSP di questo progetto usa `strict-dynamic`,
      // quindi uno script senza nonce verrebbe bloccato e comparirebbe qui.
      await page.waitForLoadState('networkidle');

      expect(watcher.errors(), `errori in console su ${path}`).toEqual([]);
    });
  }
});

test.describe('Superfici tecniche pubbliche', () => {
  test('robots.txt e sitemap.xml rispondono', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
  });

  test('un percorso inesistente restituisce 404', async ({ request }) => {
    const response = await request.get('/questa-pagina-non-esiste-e2e');
    expect(response.status()).toBe(404);
  });
});
