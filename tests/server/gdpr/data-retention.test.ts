import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DataRetentionService,
  RETENTION_POLICY,
  type RetentionRepository,
} from '@/server/gdpr/data-retention';

const NOW = new Date('2026-07-27T12:00:00.000Z');
const PROJECT_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

interface Call {
  table: string;
  column: string;
  cutoff: Date;
  limit: number;
  dryRun: boolean;
}

function recordingRepository(deleted = 0): RetentionRepository & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async deleteOlderThan(input) {
      calls.push(input);
      return deleted;
    },
  };
}

function makeService(repository: RetentionRepository): DataRetentionService {
  return new DataRetentionService(repository, () => NOW);
}

describe('DataRetentionService', () => {
  it('cancella i messaggi prima delle conversazioni', async () => {
    // La cascata sulle conversazioni porterebbe via messaggi non ancora
    // contati, e il totale riportato dal job sarebbe falso.
    const repository = recordingRepository();
    await makeService(repository).sweep();

    const tables = repository.calls.map((call) => call.table);
    expect(tables.indexOf('messages')).toBeLessThan(tables.indexOf('conversations'));
  });

  it('applica 24 mesi alle conversazioni, come dichiarato nella privacy policy', async () => {
    const repository = recordingRepository();
    await makeService(repository).sweep();

    const conversations = repository.calls.find((call) => call.table === 'conversations');
    expect(conversations?.cutoff.toISOString()).toBe('2024-07-27T12:00:00.000Z');
  });

  it('applica 90 giorni ai dati vocali', async () => {
    const repository = recordingRepository();
    await makeService(repository).sweep();

    const voice = repository.calls.find((call) => call.table === 'whatsapp_voice_jobs');
    expect(voice?.cutoff.toISOString()).toBe('2026-04-28T12:00:00.000Z');
  });

  it('applica 12 mesi ai log tecnici', async () => {
    const repository = recordingRepository();
    await makeService(repository).sweep();

    const webhooks = repository.calls.find((call) => call.table === 'webhook_events');
    expect(webhooks?.cutoff.toISOString()).toBe('2025-07-27T12:00:00.000Z');
  });

  it('in simulazione non chiede alcuna cancellazione reale', async () => {
    const repository = recordingRepository();
    const result = await makeService(repository).sweep({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(repository.calls.every((call) => call.dryRun)).toBe(true);
  });

  it('riporta il conteggio per tabella', async () => {
    const repository = recordingRepository(7);
    const result = await makeService(repository).sweep();

    expect(result.deleted).toEqual({
      messages: 7,
      conversations: 7,
      voiceJobs: 7,
      voiceEvents: 7,
      webhookEvents: 7,
    });
  });

  it('propaga il limite di batch a ogni tabella', async () => {
    const repository = recordingRepository();
    await makeService(repository).sweep({ limit: 250 });

    expect(repository.calls.every((call) => call.limit === 250)).toBe(true);
  });

  /**
   * Questo test non verifica il codice: verifica che il codice e la promessa
   * pubblica non divergano. Se qualcuno cambia la privacy policy senza toccare
   * il job — o viceversa — la retention smette di corrispondere a ciò che i
   * clienti hanno letto, ed è un problema di conformità, non di software.
   */
  it('le soglie corrispondono a quelle dichiarate nella privacy policy pubblica', async () => {
    const policyPage = await readFile(join(PROJECT_ROOT, 'src/app/legal/privacy/page.tsx'), 'utf8');

    expect(policyPage).toContain(`Conversazioni: ${RETENTION_POLICY.conversationsMonths} mesi`);
    expect(policyPage).toContain(`Vocali audio: ${RETENTION_POLICY.voiceDays} giorni`);
    expect(policyPage).toContain(`Log tecnici: ${RETENTION_POLICY.technicalLogsMonths} mesi`);
  });
});
