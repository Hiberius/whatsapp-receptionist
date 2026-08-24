import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors/app-error';
import type { RankedSlot, RankingReason } from '@/server/appointments/slot-ranking';

export type SchedulingDecisionCandidate = {
  start: string;
  end: string;
  score: number;
  reasons: RankingReason[];
};

export type SchedulingDecisionInput = {
  tenantId: string;
  conversationId: string | null;
  request: Record<string, unknown>;
  rankingVersion: string;
  candidates: SchedulingDecisionCandidate[];
  explanation: string | null;
};

export interface SchedulingDecisionLedger {
  record(input: SchedulingDecisionInput): Promise<void>;
}

/**
 * Proietta gli slot valutati nella forma persistita dal ledger.
 *
 * Conserva l'ordine di ranking: `candidates[0..2]` sono esattamente i tre slot
 * proposti in conversazione, quindi non serve (ne' va aggiunta) una colonna
 * "selected" separata.
 *
 * @param ranked Slot ordinati da `rankSlots`.
 * @returns Candidati serializzabili in JSONB.
 */
export function toDecisionCandidates(ranked: RankedSlot[]): SchedulingDecisionCandidate[] {
  return ranked.map((entry) => ({
    start: entry.slot.start,
    end: entry.slot.end,
    score: entry.score,
    reasons: entry.reasons,
  }));
}

/**
 * Ledger no-op: usato quando il ranking e' disattivato o in test che non
 * vogliono toccare Supabase.
 */
export class NoopSchedulingDecisionLedger implements SchedulingDecisionLedger {
  async record(_input: SchedulingDecisionInput): Promise<void> {
    return;
  }
}

export class SupabaseSchedulingDecisionLedger implements SchedulingDecisionLedger {
  private readonly supabase = createSupabaseAdminClient();

  async record(input: SchedulingDecisionInput): Promise<void> {
    const { error } = await this.supabase.from('scheduling_decisions').insert({
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      request: input.request,
      ranking_version: input.rankingVersion,
      candidates: input.candidates,
      explanation: input.explanation,
    });

    if (error) {
      throw new AppError('internal', 'Failed to persist scheduling decision', {
        expose: false,
        cause: error,
      });
    }
  }
}

/**
 * Factory del ledger di produzione.
 *
 * Istanzia il client Supabase solo alla prima chiamata: il bridge di booking
 * viene costruito anche in ambienti senza credenziali admin, e un throw in
 * costruzione romperebbe conversazioni che con il ranking non c'entrano nulla.
 *
 * @returns Ledger che scrive su `scheduling_decisions`.
 */
export function createSchedulingDecisionLedger(): SchedulingDecisionLedger {
  let delegate: SchedulingDecisionLedger | null = null;

  return {
    async record(input: SchedulingDecisionInput): Promise<void> {
      delegate = delegate ?? new SupabaseSchedulingDecisionLedger();

      await delegate.record(input);
    },
  };
}
