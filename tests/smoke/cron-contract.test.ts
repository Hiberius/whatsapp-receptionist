/**
 * Contratto fra `vercel.json` e le route dei job interni.
 *
 * Regressione che questo test blocca: i 5 cron erano dichiarati in
 * `vercel.json` mentre le route esportavano solo `POST`. Vercel Cron invoca in
 * `GET`, quindi ogni esecuzione riceveva 405 e nessun job girava mai in
 * produzione — con l'outbox WhatsApp che non veniva drenato e il prodotto
 * silenziosamente muto. Il typecheck non poteva accorgersene: la
 * corrispondenza fra path schedulato e handler esportato non è espressa nei
 * tipi.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

interface VercelConfig {
  crons?: Array<{ path: string; schedule: string }>;
}

let crons: Array<{ path: string; schedule: string }>;

beforeAll(async () => {
  const raw = await readFile(join(PROJECT_ROOT, 'vercel.json'), 'utf8');
  crons = (JSON.parse(raw) as VercelConfig).crons ?? [];
});

/** Traduce un path di cron nel file route corrispondente. */
function routeFileFor(cronPath: string): string {
  return join(PROJECT_ROOT, 'src/app', `${cronPath}/route.ts`);
}

describe('contratto cron Vercel', () => {
  it('dichiara almeno un cron', () => {
    expect(crons.length).toBeGreaterThan(0);
  });

  it('ogni path schedulato corrisponde a una route esistente che esporta GET', async () => {
    const failures: string[] = [];

    for (const cron of crons) {
      const routeFile = routeFileFor(cron.path);

      let mod: Record<string, unknown>;
      try {
        mod = (await import(routeFile)) as Record<string, unknown>;
      } catch (error) {
        failures.push(`${cron.path} → route non importabile: ${(error as Error).message}`);
        continue;
      }

      // Vercel Cron invia esclusivamente GET: un handler solo-POST non viene
      // mai eseguito, e il fallimento è silenzioso.
      if (typeof mod['GET'] !== 'function') {
        failures.push(`${cron.path} → nessun handler GET esportato (Vercel Cron invoca in GET)`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('ogni cron dichiara uno schedule non vuoto', () => {
    for (const cron of crons) {
      expect(cron.schedule.trim().length).toBeGreaterThan(0);
    }
  });
});
