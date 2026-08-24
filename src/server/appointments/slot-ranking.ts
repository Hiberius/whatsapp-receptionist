import type { StructuredBookingRequest } from '@/server/ai/booking-extractor';

/**
 * Versione dell'algoritmo di ranking. Va incrementata quando cambiano segnali,
 * pesi o tie-break: il decision ledger la persiste per ogni decisione, cosi'
 * una riga vecchia resta leggibile anche dopo un cambio di scoring.
 */
export const SLOT_RANKING_VERSION = 'slot-ranking-v1';

export type RankingSignal =
  | 'requested_date_match'
  | 'time_preference_match'
  | 'explicit_time_proximity'
  | 'earliest_availability';

export type RankingReason = {
  signal: RankingSignal;
  points: number;
  detail: string;
};

/**
 * Forma minima di slot che il ranker sa ordinare: e' un sottoinsieme
 * strutturale di `BookingSlot`, cosi' il ranker resta puro e non dipende
 * dal servizio di booking.
 */
export type RankableSlot = {
  serviceId: string;
  start: string;
  end: string;
  timezone: string;
};

export type RankedSlot<T extends RankableSlot = RankableSlot> = {
  slot: T;
  score: number;
  reasons: RankingReason[];
};

export type RankSlotsInput<T extends RankableSlot> = {
  slots: T[];
  request: StructuredBookingRequest;
  now: Date;
};

/**
 * Pesi interi espliciti. Nessun peso frazionario: il punteggio deve essere
 * riproducibile bit-per-bit e leggibile a occhio in un audit.
 */
const weights = {
  requestedDateMatch: 40,
  timePreferenceMatch: 30,
  explicitTimeProximityMax: 12,
  explicitTimeProximityDecayPerHour: 4,
  earliestAvailabilityBase: 24,
  earliestAvailabilityDecayPerDay: 8,
} as const;

const defaultTimezone = 'Europe/Rome';

const millisecondsPerDay = 24 * 60 * 60 * 1000;

/**
 * Ordina in modo deterministico gli slot gia' filtrati dal flusso esistente.
 *
 * Il ranker e' puro: nessun accesso a DB, rete o LLM, e nessuna lettura
 * dell'orologio di sistema (il tempo di riferimento arriva da `now`, sempre
 * iniettato dal chiamante). A parita' di
 * input l'output e' deep-equal, indipendentemente dall'ordine dell'array in
 * ingresso.
 *
 * @param input Slot candidati, richiesta strutturata e istante di riferimento.
 * @returns Tutti gli slot valutati, in ordine di ranking decrescente.
 */
export function rankSlots<T extends RankableSlot>(input: RankSlotsInput<T>): RankedSlot<T>[] {
  const scored = input.slots.map((slot) => {
    const reasons = [
      requestedDateReason(slot, input.request),
      timePreferenceReason(slot, input.request),
      explicitTimeProximityReason(slot, input.request),
      earliestAvailabilityReason(slot, input.now),
    ];

    return {
      slot,
      score: reasons.reduce((total, reason) => total + reason.points, 0),
      reasons,
    };
  });

  return [...scored].sort(compareRankedSlots);
}

/**
 * Identita' stabile di uno slot, derivata solo da campi gia' esistenti.
 *
 * Serve come ultimo tie-break: senza, due slot con stesso punteggio e stesso
 * inizio resterebbero ordinati dall'array in ingresso, e il ranking smetterebbe
 * di essere deterministico rispetto all'ordine di generazione dei candidati.
 *
 * @param slot Slot da identificare.
 * @returns Chiave stabile e univoca dello slot.
 */
export function slotIdentity(slot: RankableSlot): string {
  return `${slot.start}|${slot.end}|${slot.serviceId}`;
}

/**
 * Costruisce una spiegazione testuale deterministica del ranking.
 *
 * Nessun LLM: e' un template. Serve a rendere leggibile una riga del ledger
 * senza dover reinterpretare i punteggi a mano.
 *
 * @param ranked Slot gia' ordinati da `rankSlots`.
 * @returns Testo della spiegazione, o `null` se non ci sono slot.
 */
export function buildRankingExplanation(ranked: RankedSlot[]): string | null {
  const best = ranked[0];

  if (!best) {
    return null;
  }

  const positiveReasons = best.reasons.filter((reason) => reason.points > 0);
  const detail =
    positiveReasons.length > 0
      ? positiveReasons.map((reason) => `${reason.signal} (+${reason.points})`).join(', ')
      : 'nessun segnale positivo: ordinato per orario piu vicino';

  return `${ranked.length} slot valutati con ${SLOT_RANKING_VERSION}. Primo: ${best.slot.start} con punteggio ${best.score} — ${detail}.`;
}

function compareRankedSlots(left: RankedSlot, right: RankedSlot): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  const leftStart = Date.parse(left.slot.start);
  const rightStart = Date.parse(right.slot.start);

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return slotIdentity(left.slot).localeCompare(slotIdentity(right.slot), 'en');
}

function requestedDateReason(slot: RankableSlot, request: StructuredBookingRequest): RankingReason {
  const preference = request.datePreference;

  if (!preference) {
    return {
      signal: 'requested_date_match',
      points: 0,
      detail: 'Nessuna data richiesta nel messaggio.',
    };
  }

  const start = Date.parse(slot.start);
  const matches = start >= preference.from.getTime() && start < preference.to.getTime();

  return {
    signal: 'requested_date_match',
    points: matches ? weights.requestedDateMatch : 0,
    detail: matches
      ? `Cade nella finestra richiesta "${preference.label}".`
      : `Fuori dalla finestra richiesta "${preference.label}".`,
  };
}

function timePreferenceReason(
  slot: RankableSlot,
  request: StructuredBookingRequest,
): RankingReason {
  const preference = request.timePreference;

  if (preference.dayPart === 'any') {
    return {
      signal: 'time_preference_match',
      points: 0,
      detail: 'Nessuna preferenza oraria espressa.',
    };
  }

  const localHour = localDecimalHour(slot);
  const startHour = preference.startHour ?? 0;
  const endHour = preference.endHour ?? 24;
  const matches = localHour >= startHour && localHour < endHour;

  return {
    signal: 'time_preference_match',
    points: matches ? weights.timePreferenceMatch : 0,
    detail: matches
      ? `Dentro la fascia richiesta ${preference.dayPart} (${startHour}-${endHour}).`
      : `Fuori dalla fascia richiesta ${preference.dayPart} (${startHour}-${endHour}).`,
  };
}

function explicitTimeProximityReason(
  slot: RankableSlot,
  request: StructuredBookingRequest,
): RankingReason {
  const anchor = explicitHourAnchor(request);

  if (anchor === null) {
    return {
      signal: 'explicit_time_proximity',
      points: 0,
      detail: 'Nessun orario esplicito da cui misurare la distanza.',
    };
  }

  const localHour = localDecimalHour(slot);
  const distanceHours = Math.floor(Math.abs(localHour - anchor));
  const points = Math.max(
    0,
    weights.explicitTimeProximityMax - weights.explicitTimeProximityDecayPerHour * distanceHours,
  );

  return {
    signal: 'explicit_time_proximity',
    points,
    detail: `A ${distanceHours}h dall'orario richiesto (${anchor}).`,
  };
}

function earliestAvailabilityReason(slot: RankableSlot, now: Date): RankingReason {
  const dayOffset = localDayOffset(now, slot);
  const points = Math.max(
    0,
    weights.earliestAvailabilityBase - weights.earliestAvailabilityDecayPerDay * dayOffset,
  );

  return {
    signal: 'earliest_availability',
    points,
    detail:
      dayOffset === 0
        ? 'Disponibile oggi stesso.'
        : `Disponibile fra ${dayOffset} giorni rispetto a oggi.`,
  };
}

/**
 * Ancora oraria usata dal segnale di prossimita'.
 *
 * Solo `exact_hour` e `after_hour` hanno un orario-obiettivo reale. Per
 * `before_hour` l'utente ha espresso un limite superiore, non un desiderio di
 * stare vicino a quel limite: usarlo come ancora premierebbe l'orario piu'
 * tardi possibile, in contrasto con il segnale di disponibilita' anticipata.
 */
function explicitHourAnchor(request: StructuredBookingRequest): number | null {
  const preference = request.timePreference;

  if (preference.dayPart !== 'exact_hour' && preference.dayPart !== 'after_hour') {
    return null;
  }

  return preference.startHour;
}

function localDayOffset(now: Date, slot: RankableSlot): number {
  const timezone = slot.timezone || defaultTimezone;
  const today = localMidnightUtcMillis(now, timezone);
  const slotDay = localMidnightUtcMillis(new Date(slot.start), timezone);

  return Math.max(0, Math.round((slotDay - today) / millisecondsPerDay));
}

function localMidnightUtcMillis(date: Date, timezone: string): number {
  const parts = zonedParts(date, timezone);

  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function localDecimalHour(slot: RankableSlot): number {
  const parts = zonedParts(new Date(slot.start), slot.timezone || defaultTimezone);

  return parts.hour + parts.minute / 60;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function zonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
}
