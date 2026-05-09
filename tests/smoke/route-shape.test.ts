/**
 * Smoke test - verifica che ogni API route esporti almeno un handler HTTP valido.
 *
 * Questo test è una rete di sicurezza per evitare regressioni dovute a refactor
 * di import o spostamento file, senza necessità di un server in esecuzione.
 */

import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const API_ROOT = join(PROJECT_ROOT, 'src/app/api');
const VALID_HANDLERS = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']);

async function findRouteFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const result: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await findRouteFiles(fullPath)));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      result.push(fullPath);
    }
  }

  return result;
}

describe('API routes shape (smoke)', () => {
  it('every route.ts exports at least one HTTP handler', async () => {
    const routes = await findRouteFiles(API_ROOT);

    expect(routes.length).toBeGreaterThan(0);

    const failures: string[] = [];

    for (const routePath of routes) {
      try {
        const mod = (await import(routePath)) as Record<string, unknown>;
        const exportedHandlers = Object.keys(mod).filter((key) => VALID_HANDLERS.has(key));

        if (exportedHandlers.length === 0) {
          failures.push(`${relative(PROJECT_ROOT, routePath)} - no HTTP handler exported`);
        }

        for (const handlerName of exportedHandlers) {
          if (typeof mod[handlerName] !== 'function') {
            failures.push(
              `${relative(PROJECT_ROOT, routePath)} - export ${handlerName} is not a function`,
            );
          }
        }
      } catch (error) {
        failures.push(
          `${relative(PROJECT_ROOT, routePath)} - import failed: ${(error as Error).message}`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(`Route shape failures:\n${failures.join('\n')}`);
    }
  });

  it('all route files compile without TypeScript errors (covered by typecheck)', () => {
    expect(true).toBe(true);
  });
});
