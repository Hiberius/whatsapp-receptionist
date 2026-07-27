import { z } from 'zod';

import { apiFetch } from '@/lib/api-client';

import { runRequest, type ApiResult } from './settings-api';

export const BUSINESS_HOURS_ENDPOINT = '/api/settings/business-hours';

/**
 * Proiezione client di `BusinessHourSettings`.
 *
 * Non è importata da `@/server/settings/tenant-settings` perché quel modulo
 * istanzia il client Supabase con la service role key: anche un import di solo
 * tipo lo trascinerebbe nel grafo del bundle client.
 */
export const BusinessHourSchema = z.object({
  id: z.string(),
  weekday: z.number().int().min(0).max(6),
  opensAt: z.string(),
  closesAt: z.string(),
  active: z.boolean(),
});

export type BusinessHourView = z.output<typeof BusinessHourSchema>;

export interface DayDraft {
  readonly weekday: number;
  readonly open: boolean;
  /** `HH:mm`, stringa vuota quando non è mai stato impostato. */
  readonly opensAt: string;
  readonly closesAt: string;
}

export interface DayIssue {
  readonly weekday: number;
  readonly message: string;
}

/** `0` è domenica: stessa convenzione di `Date#getUTCDay`, usata dal booking. */
const WEEKDAY_LABELS = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
] as const;

/** Ordine di lettura italiano: la settimana inizia da lunedì. */
export const WEEKDAY_DISPLAY_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? `Giorno ${weekday}`;
}

/**
 * Costruisce le sette righe editabili a partire dagli orari salvati.
 *
 * Se un giorno ha solo fasce disattivate, le sue ore restano visibili con il
 * giorno marcato chiuso: sono dati reali, non un default inventato, e servono
 * a chi vuole riaprire il giorno senza riscriverli.
 */
export function toDayDrafts(hours: readonly BusinessHourView[]): readonly DayDraft[] {
  return WEEKDAY_DISPLAY_ORDER.map((weekday) => {
    const dayHours = [...hours]
      .filter((hour) => hour.weekday === weekday)
      .sort((left, right) => compareTime(left.opensAt, right.opensAt));
    const source = dayHours.find((hour) => hour.active) ?? dayHours[0];

    if (source === undefined) {
      return { weekday, open: false, opensAt: '', closesAt: '' };
    }

    return {
      weekday,
      open: source.active,
      opensAt: source.opensAt,
      closesAt: source.closesAt,
    };
  });
}

/**
 * Fasce che l'editor non mostra.
 *
 * Il modello dati ammette più fasce per giorno (es. pausa pranzo), questa
 * schermata ne gestisce una sola. Salvare cancellerebbe le altre senza che
 * l'utente lo sappia: il conteggio serve ad avvisarlo prima.
 */
export function countHiddenRanges(hours: readonly BusinessHourView[]): number {
  const seen = new Set<number>();
  let hidden = 0;

  for (const hour of hours) {
    if (seen.has(hour.weekday)) {
      hidden += 1;
      continue;
    }

    seen.add(hour.weekday);
  }

  return hidden;
}

export function validateDayDrafts(drafts: readonly DayDraft[]): readonly DayIssue[] {
  return drafts.filter((draft) => draft.open).flatMap(issuesForDraft);
}

/**
 * Body del PUT.
 *
 * I giorni chiusi vengono omessi invece di essere inviati con `active: false`:
 * l'API valida comunque `opensAt < closesAt` su ogni riga, quindi tenerli
 * significherebbe inventare un orario per un giorno in cui lo studio è chiuso.
 * Assenza di fasce e fascia disattivata producono la stessa disponibilità.
 */
export function buildBusinessHoursPayload(drafts: readonly DayDraft[]): {
  readonly hours: readonly {
    readonly weekday: number;
    readonly opensAt: string;
    readonly closesAt: string;
    readonly active: true;
  }[];
} {
  const hours = drafts
    .filter((draft) => draft.open)
    .map((draft) => ({
      weekday: draft.weekday,
      opensAt: draft.opensAt,
      closesAt: draft.closesAt,
      active: true as const,
    }))
    .sort((left, right) => left.weekday - right.weekday);

  return { hours };
}

export async function saveBusinessHours(input: {
  readonly drafts: readonly DayDraft[];
}): Promise<ApiResult<BusinessHourView[]>> {
  return runRequest(
    () =>
      apiFetch(BUSINESS_HOURS_ENDPOINT, {
        schema: z.array(BusinessHourSchema),
        method: 'PUT',
        body: buildBusinessHoursPayload(input.drafts),
      }),
    'Non siamo riusciti a salvare gli orari. Riprova tra poco.',
  );
}

function issuesForDraft(draft: DayDraft): readonly DayIssue[] {
  if (!TIME_PATTERN.test(draft.opensAt) || !TIME_PATTERN.test(draft.closesAt)) {
    return [
      {
        weekday: draft.weekday,
        message: `${weekdayLabel(draft.weekday)}: indica sia l’orario di apertura sia quello di chiusura, oppure marca il giorno come chiuso.`,
      },
    ];
  }

  if (compareTime(draft.opensAt, draft.closesAt) >= 0) {
    return [
      {
        weekday: draft.weekday,
        message: `${weekdayLabel(draft.weekday)}: l’apertura deve precedere la chiusura.`,
      },
    ];
  }

  return [];
}

function compareTime(left: string, right: string): number {
  return timeToMinutes(left) - timeToMinutes(right);
}

function timeToMinutes(value: string): number {
  const match = TIME_PATTERN.exec(value);

  if (match === null) {
    return Number.NaN;
  }

  const [hours, minutes] = value.split(':');

  return Number(hours) * 60 + Number(minutes);
}
