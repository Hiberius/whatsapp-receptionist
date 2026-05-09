export type BookingDayPart =
  | 'any'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'after_hour'
  | 'before_hour'
  | 'exact_hour';

export type BookingUrgency = 'normal' | 'urgent';

export type BookingTimePreference = {
  dayPart: BookingDayPart;
  startHour: number | null;
  endHour: number | null;
};

export type BookingDatePreference = {
  from: Date;
  to: Date;
  label: string;
};

export type StructuredBookingRequest = {
  serviceQuery: string | null;
  datePreference: BookingDatePreference | null;
  timePreference: BookingTimePreference;
  urgency: BookingUrgency;
  customerName: string | null;
  customerPhone: string | null;
  confidence: number;
  signals: string[];
};

export type BookingExtractionInput = {
  text: string;
  now: Date;
  timezone?: string;
};

export interface BookingRequestExtractor {
  extract(input: BookingExtractionInput): Promise<StructuredBookingRequest>;
}

const defaultTimezone = 'Europe/Rome';

const weekdayByName: Record<string, number> = {
  domenica: 0,
  lunedi: 1,
  martedi: 2,
  mercoledi: 3,
  giovedi: 4,
  venerdi: 5,
  sabato: 6,
};

export class RuleBasedBookingRequestExtractor implements BookingRequestExtractor {
  async extract(input: BookingExtractionInput): Promise<StructuredBookingRequest> {
    const timezone = input.timezone || defaultTimezone;
    const normalized = normalizeForMatching(input.text);
    const signals: string[] = [];
    const datePreference = extractDatePreference({
      normalized,
      now: input.now,
      timezone,
      signals,
    });
    const timePreference = extractTimePreference(normalized, signals);
    const serviceQuery = extractServiceQuery(normalized, signals);
    const customerPhone = extractPhone(input.text, signals);
    const customerName = extractCustomerName(input.text, signals);
    const urgency = /\b(urgente|prima possibile|appena possibile|oggi|subito)\b/.test(normalized)
      ? 'urgent'
      : 'normal';

    if (urgency === 'urgent') {
      signals.push('urgency');
    }

    return {
      serviceQuery,
      datePreference,
      timePreference,
      urgency,
      customerName,
      customerPhone,
      confidence: confidenceForExtraction({
        serviceQuery,
        datePreference,
        timePreference,
        signals,
      }),
      signals,
    };
  }
}

export function filterSlotsByBookingRequest<T extends { start: string; timezone: string }>(
  slots: T[],
  request: StructuredBookingRequest,
): T[] {
  if (request.timePreference.dayPart === 'any') {
    return slots;
  }

  return slots.filter((slot) =>
    slotMatchesTimePreference(slot.start, slot.timezone, request.timePreference),
  );
}

function extractDatePreference(input: {
  normalized: string;
  now: Date;
  timezone: string;
  signals: string[];
}): BookingDatePreference | null {
  if (/\boggi\b/.test(input.normalized)) {
    input.signals.push('date_today');
    return dateWindowForLocalDate({
      localDate: localDateParts(input.now, input.timezone),
      label: 'oggi',
      timePreference: extractTimePreference(input.normalized, []),
      timezone: input.timezone,
    });
  }

  if (/\bdomani\b/.test(input.normalized)) {
    input.signals.push('date_tomorrow');
    return dateWindowForLocalDate({
      localDate: addLocalDays(localDateParts(input.now, input.timezone), 1),
      label: 'domani',
      timePreference: extractTimePreference(input.normalized, []),
      timezone: input.timezone,
    });
  }

  if (/\bdopodomani\b/.test(input.normalized)) {
    input.signals.push('date_after_tomorrow');
    return dateWindowForLocalDate({
      localDate: addLocalDays(localDateParts(input.now, input.timezone), 2),
      label: 'dopodomani',
      timePreference: extractTimePreference(input.normalized, []),
      timezone: input.timezone,
    });
  }

  if (/\b(settimana prossima|prossima settimana)\b/.test(input.normalized)) {
    const start = addLocalDays(localDateParts(input.now, input.timezone), 7);
    input.signals.push('date_next_week');

    return {
      from: zonedLocalTimeToUtc(start, { hour: 0, minute: 0, second: 0 }, input.timezone),
      to: zonedLocalTimeToUtc(
        addLocalDays(start, 7),
        { hour: 0, minute: 0, second: 0 },
        input.timezone,
      ),
      label: 'settimana prossima',
    };
  }

  for (const [weekdayName, weekday] of Object.entries(weekdayByName)) {
    if (new RegExp(`\\b${weekdayName}\\b`).test(input.normalized)) {
      const localDate = nextWeekdayDate({
        now: input.now,
        timezone: input.timezone,
        weekday,
      });
      input.signals.push(`weekday_${weekdayName}`);

      return dateWindowForLocalDate({
        localDate,
        label: weekdayName,
        timePreference: extractTimePreference(input.normalized, []),
        timezone: input.timezone,
      });
    }
  }

  return null;
}

function extractTimePreference(normalized: string, signals: string[]): BookingTimePreference {
  const afterHour = normalized.match(/\b(?:dopo|dalle|da dopo)\s+le\s+(\d{1,2})\b/);

  if (afterHour?.[1]) {
    const hour = clampHour(Number(afterHour[1]));
    signals.push('time_after_hour');

    return {
      dayPart: 'after_hour',
      startHour: hour,
      endHour: Math.max(hour + 1, 21),
    };
  }

  const beforeHour = normalized.match(/\b(?:prima|entro)\s+(?:le|delle)\s+(\d{1,2})\b/);

  if (beforeHour?.[1]) {
    const hour = clampHour(Number(beforeHour[1]));
    signals.push('time_before_hour');

    return {
      dayPart: 'before_hour',
      startHour: 8,
      endHour: hour,
    };
  }

  const exactHour = normalized.match(/\b(?:alle|ore|delle)\s+(\d{1,2})(?::(\d{2}))?\b/);

  if (exactHour?.[1]) {
    const hour = clampHour(Number(exactHour[1]));
    signals.push('time_exact_hour');

    return {
      dayPart: 'exact_hour',
      startHour: hour,
      endHour: Math.min(hour + 1, 24),
    };
  }

  if (/\b(mattina|mattino)\b/.test(normalized)) {
    signals.push('time_morning');

    return {
      dayPart: 'morning',
      startHour: 8,
      endHour: 13,
    };
  }

  if (/\b(pomeriggio|primo pomeriggio|tardo pomeriggio)\b/.test(normalized)) {
    signals.push('time_afternoon');

    return {
      dayPart: 'afternoon',
      startHour: 13,
      endHour: 18,
    };
  }

  if (/\b(sera|serale|tardi)\b/.test(normalized)) {
    signals.push('time_evening');

    return {
      dayPart: 'evening',
      startHour: 18,
      endHour: 21,
    };
  }

  return {
    dayPart: 'any',
    startHour: null,
    endHour: null,
  };
}

function extractServiceQuery(normalized: string, signals: string[]): string | null {
  const knownServiceSignals = [
    'prima visita',
    'visita',
    'controllo',
    'igiene',
    'pulizia',
    'consulenza',
    'trattamento',
    'seduta',
    'pilates',
    'lezione',
  ];

  for (const signal of knownServiceSignals) {
    if (normalized.includes(signal)) {
      signals.push('service_keyword');
      return signal;
    }
  }

  const serviceMatch = normalized.match(
    /\b(?:per|prenotare|fissare)\s+(.+?)(?:\s+(?:oggi|domani|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|mattina|pomeriggio|sera|alle|dopo|prima)\b|$)/,
  );
  const candidate = serviceMatch?.[1]?.trim();

  if (candidate && candidate.length >= 4) {
    signals.push('service_phrase');
    return removeBookingStopwords(candidate);
  }

  return null;
}

function extractPhone(text: string, signals: string[]): string | null {
  const match = text.match(/(?:\+39\s*)?(3\d{2}[\s.-]?\d{3}[\s.-]?\d{3,4})/);

  if (!match?.[1]) {
    return null;
  }

  signals.push('customer_phone');
  return match[1].replace(/\D/g, '');
}

function extractCustomerName(text: string, signals: string[]): string | null {
  const match = text.match(/\b(?:sono|mi chiamo|nome)\s+([\p{L}]+(?:\s+[\p{L}]+)?)/iu);

  if (match?.[1]) {
    signals.push('customer_name');
    return match[1].trim();
  }

  const ownerName = extractOwnerCustomerName(text);

  if (!ownerName || !isLikelyCustomerName(ownerName)) {
    return null;
  }

  signals.push('customer_name');
  return ownerName;
}

function extractOwnerCustomerName(text: string): string | null {
  const ownerMatch = text.match(/\b(?:di|per)\s+([\p{L}]+(?:\s+[\p{L}]+){0,3})/iu);
  const rawCandidate = ownerMatch?.[1]?.trim();

  if (!rawCandidate) {
    return null;
  }

  const nameTokens: string[] = [];

  for (const token of rawCandidate.split(/\s+/)) {
    if (isCustomerNameStopToken(token)) {
      break;
    }

    nameTokens.push(token);

    if (nameTokens.length === 2) {
      break;
    }
  }

  return nameTokens.length > 0 ? nameTokens.join(' ') : null;
}

function confidenceForExtraction(input: {
  serviceQuery: string | null;
  datePreference: BookingDatePreference | null;
  timePreference: BookingTimePreference;
  signals: string[];
}): number {
  let confidence = 0.45;

  if (input.serviceQuery) {
    confidence += 0.18;
  }

  if (input.datePreference) {
    confidence += 0.18;
  }

  if (input.timePreference.dayPart !== 'any') {
    confidence += 0.12;
  }

  confidence += Math.min(0.12, input.signals.length * 0.02);

  return Math.round(Math.min(confidence, 0.94) * 100) / 100;
}

function dateWindowForLocalDate(input: {
  localDate: LocalDate;
  label: string;
  timePreference: BookingTimePreference;
  timezone: string;
}): BookingDatePreference {
  const startHour = input.timePreference.startHour ?? 0;
  const endHour = input.timePreference.endHour ?? 24;

  return {
    from: zonedLocalTimeToUtc(
      input.localDate,
      { hour: startHour, minute: 0, second: 0 },
      input.timezone,
    ),
    to: zonedLocalTimeToUtc(
      endHour >= 24 ? addLocalDays(input.localDate, 1) : input.localDate,
      { hour: endHour >= 24 ? 0 : endHour, minute: 0, second: 0 },
      input.timezone,
    ),
    label: input.label,
  };
}

function slotMatchesTimePreference(
  isoStart: string,
  timezone: string,
  preference: BookingTimePreference,
): boolean {
  if (preference.dayPart === 'any') {
    return true;
  }

  const parts = zonedParts(new Date(isoStart), timezone || defaultTimezone);
  const localHour = parts.hour + parts.minute / 60;
  const startHour = preference.startHour ?? 0;
  const endHour = preference.endHour ?? 24;

  return localHour >= startHour && localHour < endHour;
}

type LocalDate = {
  year: number;
  month: number;
  day: number;
};

function localDateParts(date: Date, timezone: string): LocalDate {
  const parts = zonedParts(date, timezone);

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

function zonedParts(
  date: Date,
  timezone: string,
): LocalDate & { hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map = new Map(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    year: numberPart(map, 'year'),
    month: numberPart(map, 'month'),
    day: numberPart(map, 'day'),
    hour: numberPart(map, 'hour'),
    minute: numberPart(map, 'minute'),
    second: numberPart(map, 'second'),
  };
}

function zonedLocalTimeToUtc(
  localDate: LocalDate,
  time: { hour: number; minute: number; second: number },
  timezone: string,
): Date {
  const utcWallTime = Date.UTC(
    localDate.year,
    localDate.month - 1,
    localDate.day,
    time.hour,
    time.minute,
    time.second,
  );
  let candidate = new Date(utcWallTime);

  for (let index = 0; index < 3; index += 1) {
    const offset = timezoneOffsetMs(candidate, timezone);
    const next = new Date(utcWallTime - offset);

    if (Math.abs(next.getTime() - candidate.getTime()) < 1000) {
      return next;
    }

    candidate = next;
  }

  return candidate;
}

function timezoneOffsetMs(date: Date, timezone: string): number {
  const parts = zonedParts(date, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

function nextWeekdayDate(input: { now: Date; timezone: string; weekday: number }): LocalDate {
  const today = localDateParts(input.now, input.timezone);
  const todayWeekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const delta = (input.weekday - todayWeekday + 7) % 7 || 7;

  return addLocalDays(today, delta);
}

function addLocalDays(date: LocalDate, days: number): LocalDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function numberPart(map: Map<string, string>, key: string): number {
  const value = map.get(key);
  const parsed = value ? Number(value) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new Error(`Could not format timezone part ${key}`);
  }

  return parsed;
}

function clampHour(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.trunc(value), 23));
}

function removeBookingStopwords(value: string): string {
  return value
    .replace(/\b(un|una|il|la|lo|per|appuntamento|prenotazione|vorrei)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyCustomerName(value: string): boolean {
  const normalized = normalizeForMatching(value);

  if (normalized.length < 2) {
    return false;
  }

  const blocked = new Set([
    'appuntamento',
    'prenotazione',
    'visita',
    'prima visita',
    'controllo',
    'igiene',
    'pulizia',
    'consulenza',
    'trattamento',
    'seduta',
    'lezione',
    'oggi',
    'domani',
    'dopodomani',
    'mattina',
    'mattino',
    'pomeriggio',
    'sera',
    'lunedi',
    'martedi',
    'mercoledi',
    'giovedi',
    'venerdi',
    'sabato',
    'domenica',
  ]);

  return !blocked.has(normalized);
}

function isCustomerNameStopToken(value: string): boolean {
  const normalized = normalizeForMatching(value);
  const blocked = new Set([
    'a',
    'ad',
    'al',
    'alle',
    'allo',
    'alla',
    'per',
    'di',
    'del',
    'della',
    'delle',
    'oggi',
    'domani',
    'dopodomani',
    'mattina',
    'mattino',
    'pomeriggio',
    'sera',
    'lunedi',
    'martedi',
    'mercoledi',
    'giovedi',
    'venerdi',
    'sabato',
    'domenica',
  ]);

  return blocked.has(normalized) || /^\d{1,2}$/.test(normalized);
}

function normalizeForMatching(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
