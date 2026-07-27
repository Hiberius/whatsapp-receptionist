import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';

/**
 * Applicazione della retention dichiarata nella privacy policy.
 *
 * Le soglie qui sotto non sono scelte in questo file: sono trascritte da
 * `/legal/privacy`, sezione "Conservazione". Finché questo job non è esistito,
 * la policy pubblica prometteva una cancellazione che non avveniva mai e i dati
 * delle conversazioni crescevano senza limite — una promessa GDPR non
 * mantenuta, oltre che un costo di archiviazione.
 *
 * Se una soglia cambia nella policy, va cambiata anche qui. Il test
 * corrispondente esiste per rendere visibile la divergenza.
 */
export const RETENTION_POLICY = {
  /** "Conversazioni: 24 mesi rolling, salvo richieste legali." */
  conversationsMonths: 24,
  /** "Vocali audio: 90 giorni dalla trascrizione." */
  voiceDays: 90,
  /** "Log tecnici: 12 mesi." */
  technicalLogsMonths: 12,
} as const;

/**
 * Limite di righe per esecuzione.
 *
 * La cancellazione è idempotente e il job gira ogni giorno: meglio più
 * esecuzioni brevi che una singola cancellazione capace di tenere occupate a
 * lungo le tabelle in scrittura del percorso di ingresso messaggi.
 */
const DEFAULT_BATCH_LIMIT = 5_000;

export interface RetentionSweepResult {
  readonly executedAt: string;
  readonly dryRun: boolean;
  readonly deleted: {
    readonly messages: number;
    readonly conversations: number;
    readonly voiceJobs: number;
    readonly voiceEvents: number;
    readonly webhookEvents: number;
  };
  readonly cutoffs: {
    readonly conversations: string;
    readonly voice: string;
    readonly technicalLogs: string;
  };
}

export interface RetentionRepository {
  /** Ritorna il numero di righe eliminate (o eliminabili, se `dryRun`). */
  deleteOlderThan(input: {
    table: string;
    column: string;
    cutoff: Date;
    limit: number;
    dryRun: boolean;
  }): Promise<number>;
}

export class DataRetentionService {
  constructor(
    private readonly repository: RetentionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async sweep(options: { dryRun?: boolean; limit?: number } = {}): Promise<RetentionSweepResult> {
    const dryRun = options.dryRun ?? false;
    const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
    const now = this.now();

    const conversationsCutoff = monthsBefore(now, RETENTION_POLICY.conversationsMonths);
    const voiceCutoff = daysBefore(now, RETENTION_POLICY.voiceDays);
    const technicalCutoff = monthsBefore(now, RETENTION_POLICY.technicalLogsMonths);

    // Ordine non arbitrario: i messaggi prima delle conversazioni, altrimenti la
    // cancellazione delle conversazioni porterebbe via in cascata messaggi che
    // non abbiamo ancora contato, e il totale riportato sarebbe falso.
    const messages = await this.repository.deleteOlderThan({
      table: 'messages',
      column: 'created_at',
      cutoff: conversationsCutoff,
      limit,
      dryRun,
    });

    const conversations = await this.repository.deleteOlderThan({
      table: 'conversations',
      column: 'last_message_at',
      cutoff: conversationsCutoff,
      limit,
      dryRun,
    });

    const voiceJobs = await this.repository.deleteOlderThan({
      table: 'whatsapp_voice_jobs',
      column: 'created_at',
      cutoff: voiceCutoff,
      limit,
      dryRun,
    });

    const voiceEvents = await this.repository.deleteOlderThan({
      table: 'voice_events',
      column: 'created_at',
      cutoff: voiceCutoff,
      limit,
      dryRun,
    });

    const webhookEvents = await this.repository.deleteOlderThan({
      table: 'webhook_events',
      column: 'created_at',
      cutoff: technicalCutoff,
      limit,
      dryRun,
    });

    const result: RetentionSweepResult = {
      executedAt: now.toISOString(),
      dryRun,
      deleted: { messages, conversations, voiceJobs, voiceEvents, webhookEvents },
      cutoffs: {
        conversations: conversationsCutoff.toISOString(),
        voice: voiceCutoff.toISOString(),
        technicalLogs: technicalCutoff.toISOString(),
      },
    };

    logger.info(
      { dryRun, deleted: result.deleted },
      dryRun ? 'Retention: simulazione completata' : 'Retention: cancellazione completata',
    );

    return result;
  }
}

/**
 * Sottrae mesi mantenendo il comportamento di `Date`: il 31 marzo meno un mese
 * diventa il 3 marzo, non il 28 febbraio. È accettabile per una soglia di
 * retention, dove uno scarto di giorni non cambia la conformità, e preferibile
 * a un calcolo calendariale fatto a mano che sbaglierebbe in modo meno
 * prevedibile.
 */
function monthsBefore(reference: Date, months: number): Date {
  const cutoff = new Date(reference);
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff;
}

function daysBefore(reference: Date, days: number): Date {
  return new Date(reference.getTime() - days * 24 * 60 * 60 * 1000);
}

class SupabaseRetentionRepository implements RetentionRepository {
  private readonly supabase = createSupabaseAdminClient();

  async deleteOlderThan(input: {
    table: string;
    column: string;
    cutoff: Date;
    limit: number;
    dryRun: boolean;
  }): Promise<number> {
    const cutoffIso = input.cutoff.toISOString();

    // In simulazione contiamo soltanto: serve a poter osservare l'impatto di
    // una soglia prima di applicarla su dati di clienti reali.
    if (input.dryRun) {
      const { count, error } = await this.supabase
        .from(input.table)
        .select('id', { count: 'exact', head: true })
        .lt(input.column, cutoffIso);

      if (error) {
        throw new AppError('internal', `Failed to count expired rows in ${input.table}`, {
          cause: error,
        });
      }

      return Math.min(count ?? 0, input.limit);
    }

    const { data, error } = await this.supabase
      .from(input.table)
      .delete()
      .lt(input.column, cutoffIso)
      .select('id')
      .limit(input.limit);

    if (error) {
      throw new AppError('internal', `Failed to delete expired rows from ${input.table}`, {
        cause: error,
      });
    }

    return (data as Array<{ id: string }> | null)?.length ?? 0;
  }
}

export function createDataRetentionService(
  repository: RetentionRepository = new SupabaseRetentionRepository(),
  now: () => Date = () => new Date(),
): DataRetentionService {
  return new DataRetentionService(repository, now);
}
