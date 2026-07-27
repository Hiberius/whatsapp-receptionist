import { expect, test } from '@playwright/test';

/**
 * Flussi 2 e 3: nessuna pagina dell'area riservata è raggiungibile senza
 * sessione.
 *
 * Era la falla più grave del progetto: le pagine rendevano il proprio contenuto
 * anche senza login. Il controllo vive nei layout di gruppo
 * (`src/app/(dashboard)/layout.tsx`, `src/app/(admin)/layout.tsx`), quindi ogni
 * percorso qui elencato deve finire su `/login`.
 *
 * Nessuna sessione viene creata: il contesto Playwright parte senza cookie, che
 * è esattamente lo stato da verificare. Nessun segreto richiesto.
 */

const TENANT_PATHS = [
  '/dashboard',
  '/conversations',
  '/calendar',
  '/knowledge',
  '/settings',
  '/settings/whatsapp',
  '/billing',
] as const;

const ADMIN_PATHS = [
  '/admin',
  '/admin/tenants',
  '/admin/users',
  '/admin/billing',
  '/admin/audit',
  '/admin/system',
] as const;

/**
 * Stringhe che compaiono solo quando il guscio autenticato viene renderizzato:
 * l'etichetta della sidebar tenant e il pulsante di uscita del pannello admin.
 * Sono sottostringhe semplici, quindi vengono trovate sia nel markup HTML sia
 * nel payload RSC serializzato.
 */
const DASHBOARD_SHELL_MARKER = 'Navigazione dashboard';
const ADMIN_SHELL_MARKER = 'Esci da admin';

const LOGIN_URL = /\/login(\?.*)?$/;

test.describe('Area tenant protetta', () => {
  for (const path of TENANT_PATHS) {
    test(`${path} senza sessione porta al login`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(LOGIN_URL);
      await expect(page.getByRole('button', { name: 'Invia link di accesso' })).toBeVisible();
      await expect(page.getByLabel(DASHBOARD_SHELL_MARKER)).toHaveCount(0);
    });
  }
});

test.describe('Pannello admin protetto', () => {
  for (const path of ADMIN_PATHS) {
    test(`${path} senza sessione porta al login`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(LOGIN_URL);
      await expect(page.getByRole('button', { name: 'Invia link di accesso' })).toBeVisible();
      await expect(page.getByRole('link', { name: new RegExp(ADMIN_SHELL_MARKER) })).toHaveCount(0);
    });
  }
});

test.describe('Contenuto riservato assente nella risposta HTTP', () => {
  /**
   * Il redirect dei guard scatta a rendering già avviato: Next risponde 200 e
   * incapsula la direttiva `NEXT_REDIRECT` nel payload RSC, che il client
   * esegue subito dopo l'idratazione — i test qui sopra lo verificano nel
   * browser, dove l'utente finisce davvero su `/login`.
   *
   * Questo blocco lavora invece sulla risposta HTTP grezza, senza JavaScript, e
   * fissa la proprietà che vale in ogni caso: il markup dell'area riservata non
   * arriva mai a un client non autenticato.
   *
   * Limite noto: un client senza JavaScript resta su un guscio vuoto anziché
   * essere reindirizzato. Il rimedio sarebbe portare il controllo di sessione
   * nel middleware, che oggi si occupa solo di CSP. Finché non accade, questi
   * test impediscono almeno la fuga di contenuto.
   */
  for (const path of [...TENANT_PATHS, ...ADMIN_PATHS]) {
    test(`${path} non serve markup riservato`, async ({ request }) => {
      const response = await request.get(path);
      const html = await response.text();

      expect(html, `${path} espone il guscio della dashboard`).not.toContain(
        DASHBOARD_SHELL_MARKER,
      );
      expect(html, `${path} espone il guscio admin`).not.toContain(ADMIN_SHELL_MARKER);
    });
  }
});
