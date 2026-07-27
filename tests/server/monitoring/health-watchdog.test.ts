import { describe, expect, it } from 'vitest';

import {
  HealthWatchdogService,
  type WatchdogQueueStats,
  type WatchdogRepository,
} from '@/server/monitoring/health-watchdog';
import type { EmailMessage, EmailSender, EmailSendResult } from '@/server/notifications/mailer';

const NOW = new Date('2026-07-27T12:00:00.000Z');

function repositoryReturning(stats: Partial<WatchdogQueueStats>): WatchdogRepository {
  return {
    async readQueueStats() {
      return {
        pendingJobs: 0,
        staleJobs: 0,
        deadLetterJobs: 0,
        oldestPendingAt: null,
        ...stats,
      };
    },
  };
}

function recordingSender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message: EmailMessage): Promise<EmailSendResult> {
      sent.push(message);
      return { delivered: true, provider: 'resend', providerMessageId: 'msg_1' };
    },
  };
}

/**
 * `alertEmail: null` significa "nessun destinatario configurato".
 * Non si usa `undefined`: passarlo esplicitamente attiverebbe il valore di
 * default del parametro, e il test verificherebbe il contrario di ciò che
 * dichiara.
 */
function makeService(
  repository: WatchdogRepository,
  sender: EmailSender,
  alertEmail: string | null = 'ops@example.com',
): HealthWatchdogService {
  return new HealthWatchdogService(repository, sender, {
    now: () => NOW,
    ...(alertEmail !== null ? { alertEmail } : {}),
  });
}

describe('HealthWatchdogService', () => {
  it('riporta stato ok e non avvisa quando la coda è vuota', async () => {
    const sender = recordingSender();
    const report = await makeService(repositoryReturning({}), sender).check();

    expect(report.status).toBe('ok');
    expect(report.notified).toBe(false);
    expect(sender.sent).toEqual([]);
  });

  it('è critico quando esistono job pronti e fermi da troppo tempo', async () => {
    // È esattamente il guasto già accaduto: i cron non partivano, quindi
    // c'erano messaggi pronti che nessun worker prendeva in carico.
    const sender = recordingSender();
    const report = await makeService(
      repositoryReturning({
        pendingJobs: 12,
        staleJobs: 12,
        oldestPendingAt: '2026-07-27T10:00:00.000Z',
      }),
      sender,
    ).check();

    expect(report.status).toBe('critical');
    expect(report.oldestPendingMinutes).toBe(120);
    expect(report.notified).toBe(true);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.subject).toContain('non stanno uscendo');
  });

  it('segnala la coda in accumulo anche senza job fermi', async () => {
    const sender = recordingSender();
    const report = await makeService(repositoryReturning({ pendingJobs: 500 }), sender).check();

    expect(report.status).toBe('warning');
    expect(report.reasons.join(' ')).toContain('500');
    expect(sender.sent).toHaveLength(1);
  });

  it('segnala i messaggi che non verranno più ritentati', async () => {
    const sender = recordingSender();
    const report = await makeService(repositoryReturning({ deadLetterJobs: 3 }), sender).check();

    expect(report.status).toBe('warning');
    expect(report.deadLetterJobs).toBe(3);
    expect(report.reasons.join(' ')).toContain('esaurito i tentativi');
  });

  it('la condizione critica prevale su quella di avviso', async () => {
    const sender = recordingSender();
    const report = await makeService(
      repositoryReturning({ pendingJobs: 500, staleJobs: 1, deadLetterJobs: 9 }),
      sender,
    ).check();

    expect(report.status).toBe('critical');
    expect(report.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it('osserva senza avvisare quando non è configurato un destinatario', async () => {
    const sender = recordingSender();
    const report = await makeService(repositoryReturning({ staleJobs: 4 }), sender, null).check();

    expect(report.status).toBe('critical');
    expect(report.notified).toBe(false);
    expect(sender.sent).toEqual([]);
  });

  it('non fallisce il controllo se la notifica non parte', async () => {
    // Un watchdog che va in errore mentre segnala un guasto lascia il sistema
    // senza sorveglianza proprio quando serve.
    const failingSender: EmailSender = {
      async send() {
        throw new Error('SMTP down');
      },
    };

    const report = await makeService(repositoryReturning({ staleJobs: 7 }), failingSender).check();

    expect(report.status).toBe('critical');
    expect(report.notified).toBe(false);
  });

  it('usa la soglia di staleness configurata per calcolare il taglio', async () => {
    let received: Date | null = null;
    const repository: WatchdogRepository = {
      async readQueueStats(input) {
        received = input.staleBefore;
        return { pendingJobs: 0, staleJobs: 0, deadLetterJobs: 0, oldestPendingAt: null };
      },
    };

    await new HealthWatchdogService(repository, recordingSender(), {
      now: () => NOW,
      staleAfterMinutes: 30,
    }).check();

    expect(received).not.toBeNull();
    expect((received as unknown as Date).toISOString()).toBe('2026-07-27T11:30:00.000Z');
  });
});
