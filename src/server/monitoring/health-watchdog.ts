import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import { createEmailSender, type EmailSender } from '@/server/notifications/mailer';

/**
 * Sorveglianza dello stato operativo.
 *
 * Il difetto che questo modulo esiste per intercettare è già accaduto: i cron
 * non partivano e l'outbox non veniva mai drenato, quindi nessun messaggio
 * usciva — e non se ne è accorto nessuno finché non è stato letto il codice.
 * Un guasto di questo tipo è silenzioso per costruzione: il sistema risponde
 * 200 su ogni endpoint mentre non fa niente.
 *
 * Il segnale scelto è la coda: se esistono job pronti da inviare, più vecchi di
 * una soglia, significa che qualcosa fra scheduler e worker non sta girando,
 * qualunque sia la causa a monte.
 */

/** Un job pronto da più di questo tempo indica che il worker non sta girando. */
const DEFAULT_STALE_AFTER_MINUTES = 15;

/** Oltre questa soglia la coda è considerata in accumulo anche se recente. */
const DEFAULT_BACKLOG_THRESHOLD = 100;

export type WatchdogStatus = 'ok' | 'warning' | 'critical';

export interface WatchdogReport {
  readonly status: WatchdogStatus;
  readonly checkedAt: string;
  /** Job in attesa di invio (`pending` o `retry`). */
  readonly pendingJobs: number;
  /** Job pronti da più della soglia: il segnale di worker fermo. */
  readonly staleJobs: number;
  /** Job che hanno esaurito i tentativi. */
  readonly deadLetterJobs: number;
  readonly oldestPendingMinutes: number | null;
  readonly reasons: readonly string[];
  readonly notified: boolean;
}

export interface WatchdogQueueStats {
  pendingJobs: number;
  staleJobs: number;
  deadLetterJobs: number;
  oldestPendingAt: string | null;
}

export interface WatchdogRepository {
  readQueueStats(input: { staleBefore: Date }): Promise<WatchdogQueueStats>;
}

export interface WatchdogOptions {
  readonly staleAfterMinutes?: number;
  readonly backlogThreshold?: number;
  /** Indirizzo a cui inviare l'allarme. Senza, il watchdog osserva e basta. */
  readonly alertEmail?: string;
  readonly now?: () => Date;
}

export class HealthWatchdogService {
  constructor(
    private readonly repository: WatchdogRepository,
    private readonly emailSender: EmailSender,
    private readonly options: WatchdogOptions = {},
  ) {}

  async check(): Promise<WatchdogReport> {
    const now = this.options.now?.() ?? new Date();
    const staleAfterMinutes = this.options.staleAfterMinutes ?? DEFAULT_STALE_AFTER_MINUTES;
    const backlogThreshold = this.options.backlogThreshold ?? DEFAULT_BACKLOG_THRESHOLD;

    const staleBefore = new Date(now.getTime() - staleAfterMinutes * 60_000);
    const stats = await this.repository.readQueueStats({ staleBefore });

    const oldestPendingMinutes =
      stats.oldestPendingAt === null
        ? null
        : Math.max(0, Math.round((now.getTime() - Date.parse(stats.oldestPendingAt)) / 60_000));

    const reasons: string[] = [];
    let status: WatchdogStatus = 'ok';

    if (stats.staleJobs > 0) {
      // Il caso grave: ci sono messaggi pronti da inviare e nessuno li prende.
      status = 'critical';
      reasons.push(
        `${stats.staleJobs} messaggi in coda da oltre ${staleAfterMinutes} minuti: il worker dell'outbox non sta girando.`,
      );
    }

    if (stats.pendingJobs >= backlogThreshold) {
      status = status === 'critical' ? 'critical' : 'warning';
      reasons.push(
        `${stats.pendingJobs} messaggi in coda: la coda cresce più in fretta di quanto venga drenata.`,
      );
    }

    if (stats.deadLetterJobs > 0) {
      status = status === 'critical' ? 'critical' : 'warning';
      reasons.push(
        `${stats.deadLetterJobs} messaggi hanno esaurito i tentativi e non verranno più inviati.`,
      );
    }

    const report: WatchdogReport = {
      status,
      checkedAt: now.toISOString(),
      pendingJobs: stats.pendingJobs,
      staleJobs: stats.staleJobs,
      deadLetterJobs: stats.deadLetterJobs,
      oldestPendingMinutes,
      reasons,
      notified: false,
    };

    if (status === 'ok') {
      logger.info({ pendingJobs: stats.pendingJobs }, 'Watchdog: coda in salute');
      return report;
    }

    logger.error(
      {
        status,
        pendingJobs: stats.pendingJobs,
        staleJobs: stats.staleJobs,
        deadLetterJobs: stats.deadLetterJobs,
        oldestPendingMinutes,
      },
      'Watchdog: coda in stato anomalo',
    );

    const notified = await this.notify(report);

    return { ...report, notified };
  }

  /**
   * L'allarme non deve poter far fallire il controllo: un watchdog che va in
   * errore mentre segnala un guasto lascia il sistema senza sorveglianza
   * proprio nel momento in cui serve.
   */
  private async notify(report: WatchdogReport): Promise<boolean> {
    const recipient = this.options.alertEmail;
    if (!recipient) return false;

    const subject =
      report.status === 'critical'
        ? '[Ambrogio] I messaggi WhatsApp non stanno uscendo'
        : '[Ambrogio] La coda messaggi richiede attenzione';

    const body = [
      report.status === 'critical'
        ? 'Il sistema non sta consegnando messaggi WhatsApp.'
        : 'La coda dei messaggi WhatsApp mostra segnali di accumulo.',
      '',
      ...report.reasons.map((reason) => `- ${reason}`),
      '',
      `In coda: ${report.pendingJobs}`,
      `Fermi da troppo tempo: ${report.staleJobs}`,
      `Non più ritentabili: ${report.deadLetterJobs}`,
      report.oldestPendingMinutes === null
        ? ''
        : `Messaggio più vecchio in coda: ${report.oldestPendingMinutes} minuti fa`,
      '',
      `Rilevazione: ${report.checkedAt}`,
      '',
      'Prima cosa da verificare: che i cron della piattaforma stiano effettivamente',
      'invocando /api/internal/jobs/whatsapp-outbox e che rispondano 200.',
    ]
      .filter((line) => line !== '')
      .join('\n');

    try {
      await this.emailSender.send({
        to: recipient,
        subject,
        text: body,
        html: `<pre>${body.replace(/</g, '&lt;')}</pre>`,
      });
      return true;
    } catch (error) {
      logger.error({ err: error }, 'Watchdog: invio della notifica fallito');
      return false;
    }
  }
}

class SupabaseWatchdogRepository implements WatchdogRepository {
  private readonly supabase = createSupabaseAdminClient();

  async readQueueStats(input: { staleBefore: Date }): Promise<WatchdogQueueStats> {
    const waiting = ['pending', 'retry'];

    const [pending, stale, deadLetter, oldest] = await Promise.all([
      this.supabase
        .from('whatsapp_outbox_jobs')
        .select('id', { count: 'exact', head: true })
        .in('status', waiting),
      this.supabase
        .from('whatsapp_outbox_jobs')
        .select('id', { count: 'exact', head: true })
        .in('status', waiting)
        .lt('next_attempt_at', input.staleBefore.toISOString()),
      this.supabase
        .from('whatsapp_outbox_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'dead_letter'),
      this.supabase
        .from('whatsapp_outbox_jobs')
        .select('next_attempt_at')
        .in('status', waiting)
        .order('next_attempt_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const failure = pending.error ?? stale.error ?? deadLetter.error ?? oldest.error;
    if (failure) {
      throw new AppError('internal', 'Failed to read outbox queue stats', { cause: failure });
    }

    return {
      pendingJobs: pending.count ?? 0,
      staleJobs: stale.count ?? 0,
      deadLetterJobs: deadLetter.count ?? 0,
      oldestPendingAt:
        (oldest.data as { next_attempt_at?: string } | null)?.next_attempt_at ?? null,
    };
  }
}

export function createHealthWatchdogService(
  repository: WatchdogRepository = new SupabaseWatchdogRepository(),
  emailSender: EmailSender = createEmailSender(),
  options: WatchdogOptions = {},
): HealthWatchdogService {
  const alertEmail = options.alertEmail ?? env.OPS_ALERT_EMAIL;

  return new HealthWatchdogService(repository, emailSender, {
    ...options,
    ...(alertEmail ? { alertEmail } : {}),
  });
}
