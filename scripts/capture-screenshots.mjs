/**
 * Cattura screenshot reali delle pagine pubbliche.
 *
 * Sostituisce le illustrazioni SVG disegnate a mano che il repository usava
 * prima: mostravano un'interfaccia con dati inventati (nomi di studi, numeri di
 * conversazioni, variazioni "+12% vs ieri") che il prodotto non produce e, nel
 * caso dei trend, nemmeno è in grado di calcolare. Uno screenshot che mostra
 * qualcosa che il software non fa è una promessa, non una documentazione.
 *
 * Cattura solo pagine pubbliche: le schermate autenticate richiederebbero dati
 * di un tenant reale, e riempirle di dati finti riporterebbe il problema.
 *
 * Uso:
 *   node scripts/capture-screenshots.mjs [baseUrl]
 * Richiede un'istanza già in esecuzione (npm run dev oppure npm start).
 */

import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const baseUrl = process.argv[2] ?? 'http://localhost:3000';
const outputDir = 'docs/screenshots';

const TARGETS = [
  { path: '/', name: 'landing-1280', width: 1280, height: 900 },
  { path: '/', name: 'landing-mobile', width: 390, height: 844 },
  { path: '/pricing', name: 'pricing-1280', width: 1280, height: 900 },
  { path: '/verticali/dental', name: 'dental-1280', width: 1280, height: 900 },
  { path: '/status', name: 'status-1280', width: 1280, height: 900 },
];

mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch();
let failures = 0;

for (const target of TARGETS) {
  const context = await browser.newContext({
    viewport: { width: target.width, height: target.height },
    deviceScaleFactor: 2,
    // Le animazioni d'ingresso lascerebbero elementi a metà transizione.
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(`${baseUrl}${target.path}`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    if (!response || !response.ok()) {
      console.error(`✗ ${target.path} → HTTP ${response?.status() ?? 'nessuna risposta'}`);
      failures += 1;
      continue;
    }

    await page.screenshot({ path: `${outputDir}/${target.name}.png` });
    console.log(`✓ ${target.path} → ${outputDir}/${target.name}.png`);
  } catch (error) {
    console.error(`✗ ${target.path} → ${error.message}`);
    failures += 1;
  } finally {
    await context.close();
  }
}

await browser.close();

if (failures > 0) {
  console.error(`\n${failures} pagine non catturate.`);
  process.exit(1);
}
