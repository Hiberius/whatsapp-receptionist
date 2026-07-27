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

const weekdayNames = 'domenica lunedi martedi mercoledi giovedi venerdi sabato'.split(' ');

const monthLabels =
  'gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre'.split(
    ' ',
  );

const monthAbbreviations = 'gen feb mar apr mag giu lug ago set ott nov dic'.split(' ');

const monthByName: Record<string, number> = Object.fromEntries<number>([
  ...monthLabels.map((name, index): [string, number] => [name, index + 1]),
  ...monthAbbreviations.map((name, index): [string, number] => [name, index + 1]),
  ['sett', 9],
]);

const hourWords = 'una due tre quattro cinque sei sette otto nove dieci undici dodici'.split(' ');

const hourByWord: Record<string, number> = Object.fromEntries<number>([
  ...hourWords.map((word, index): [string, number] => [word, index + 1]),
  ["un'", 1],
  ['uno', 1],
  ['mezzogiorno', 12],
  ['mezzanotte', 0],
]);

const minuteByWord: Record<string, number> = {
  mezza: 30,
  mezzo: 30,
  trenta: 30,
  'un quarto': 15,
  quindici: 15,
  'tre quarti': 45,
  quarantacinque: 45,
  quaranta: 40,
  venti: 20,
  dieci: 10,
  cinque: 5,
};

const countByWord: Record<string, number> = { ...hourByWord, un: 1, quindici: 15 };

const blockedCustomerNames = new Set(
  'appuntamento, prenotazione, visita, prima visita, controllo, igiene, pulizia, consulenza, trattamento, seduta, lezione, pilates, oggi, domani, dopodomani, mattina, mattino, pomeriggio, sera, lunedi, martedi, mercoledi, giovedi, venerdi, sabato, domenica'.split(
    ', ',
  ),
);

// Gli articoli sono indispensabili: senza, "per il 15 maggio" produceva il finto nome "il".
const customerNameStopTokens = new Set(
  'a, ad, al, alle, allo, alla, per, di, del, della, delle, il, lo, la, le, i, gli, un, uno, una, oggi, domani, dopodomani, mattina, mattino, pomeriggio, sera, stamattina, stasera, lunedi, martedi, mercoledi, giovedi, venerdi, sabato, domenica'.split(
    ', ',
  ),
);

type DayPartMarker = 'morning' | 'afternoon' | 'evening';

type LocalClock = {
  hour: number;
  minute: number;
};

type LocalDate = {
  year: number;
  month: number;
  day: number;
};

const hourPattern = String.raw`(?<hour>\d{1,2}|mezzogiorno|mezzanotte|undici|dodici|quattro|cinque|dieci|sette|nove|otto|due|tre|sei|una|un'|uno)`;

const minutePattern = String.raw`(?:\s*[:.](?<minutes>\d{2})|\s+e\s+(?<minuteWord>mezza|mezzo|tre quarti|un quarto|quarantacinque|quaranta|quindici|trenta|venti|dieci|cinque|\d{1,2})|\s+meno\s+(?<lessWord>un quarto|quindici|dieci|cinque|\d{1,2}))?`;

const afterHourRegex = new RegExp(
  String.raw`\b(?:a partire dalle|a partire dall'|da dopo le|dopo le|dopo|dalle|dall')\s*` +
    hourPattern +
    minutePattern,
);

const beforeHourRegex = new RegExp(
  String.raw`\b(?:prima|entro)\s+(?:delle|dell'|le|l')\s*` + hourPattern + minutePattern,
);

const exactHourRegex = new RegExp(
  String.raw`\b(?:intorno alle|verso le|verso l'|verso|per le|sulle|sull'|alle|all'|allo|delle|dell'|ore|le|l')\s*` +
    hourPattern +
    minutePattern,
);

const bareNoonRegex = /\b(?<hour>mezzogiorno|mezzanotte)\b/;

const morningMarkerRegex =
  /\b(stamattina|stamane|mattinata|mattina|mattino|matina|mattutin[aeio])\b/;
const afternoonMarkerRegex = /\b(pomeriggio|pomerigio|pomeriggo|pomeridian[aeio])\b/;
const eveningMarkerRegex = /\b(stasera|stanotte|serata|serale|sera|nottata|notte)\b/;

const todayRegex = /\b(oggi|stamattina|stamane|stasera|stanotte|in giornata)\b/;
const tomorrowRegex = /\b(domani|dimani)\b/;
const afterTomorrowRegex = /\b(dopodomani|dopo domani|dopo-domani)\b/;
const nextWeekRegex = /\b(settimana prossima|prossima settimana|settimana che viene)\b/;
const relativeDaysRegex =
  /\b(?:tra|fra)\s+(\d{1,2}|un|una|due|tre|quattro|cinque|sei|sette|dieci|quindici)\s+(giorni|giorno|settimane|settimana)\b/;

const monthNameDateRegex = new RegExp(
  String.raw`\b(\d{1,2})\s*(?:°)?\s*(?:di\s+)?(` +
    Object.keys(monthByName)
      .sort((left, right) => right.length - left.length)
      .join('|') +
    String.raw`)\b(?:\s+(?:del\s+)?(\d{4}))?`,
);

const numericDateRegex = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/;

const dayOfMonthRegex = /\b(?:il|l')\s*(\d{1,2})\b(?![:.\d/-])/;

export class RuleBasedBookingRequestExtractor implements BookingRequestExtractor {
  async extract(input: BookingExtractionInput): Promise<StructuredBookingRequest> {
    const timezone = input.timezone || defaultTimezone;
    const normalized = normalizeForMatching(input.text);
    const signals: string[] = [];
    const timePreference = extractTimePreference(normalized, signals);
    const datePreference = extractDatePreference({
      normalized,
      now: input.now,
      timezone,
      timePreference,
      signals,
    });
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
  timePreference: BookingTimePreference;
  signals: string[];
}): BookingDatePreference | null {
  const today = localDateParts(input.now, input.timezone);
  const windowFor = (localDate: LocalDate, label: string): BookingDatePreference =>
    dateWindowForLocalDate({
      localDate,
      label,
      timePreference: input.timePreference,
      timezone: input.timezone,
    });

  if (todayRegex.test(input.normalized)) {
    input.signals.push('date_today');
    return windowFor(today, 'oggi');
  }

  // "dopo domani" contiene "domani": va valutato prima, altrimenti scivola su domani.
  if (afterTomorrowRegex.test(input.normalized)) {
    input.signals.push('date_after_tomorrow');
    return windowFor(addLocalDays(today, 2), 'dopodomani');
  }

  if (tomorrowRegex.test(input.normalized)) {
    input.signals.push('date_tomorrow');
    return windowFor(addLocalDays(today, 1), 'domani');
  }

  const relativeDays = matchRelativeDays(input.normalized);

  if (relativeDays !== null) {
    input.signals.push('date_in_days');
    return windowFor(addLocalDays(today, relativeDays.days), relativeDays.label);
  }

  if (nextWeekRegex.test(input.normalized)) {
    const start = addLocalDays(today, 7);
    input.signals.push('date_next_week');

    return {
      from: zonedLocalTimeToUtc(start, { hour: 0, minute: 0 }, input.timezone),
      to: zonedLocalTimeToUtc(addLocalDays(start, 7), { hour: 0, minute: 0 }, input.timezone),
      label: 'settimana prossima',
    };
  }

  const explicitDate = matchExplicitDate(input.normalized, today);

  if (explicitDate?.status === 'resolved') {
    input.signals.push(explicitDate.signal);
    return windowFor(explicitDate.localDate, explicitDate.label);
  }

  // "il 31 febbraio" e' una data scritta ma inesistente: meglio ammettere di non
  // aver capito che scivolare sulle euristiche successive e inventare un giorno.
  if (explicitDate?.status === 'invalid') {
    input.signals.push('date_invalid');
    return null;
  }

  for (const [weekday, weekdayName] of weekdayNames.entries()) {
    if (new RegExp(`\\b${weekdayName}\\b`).test(input.normalized)) {
      input.signals.push(`weekday_${weekdayName}`);

      return windowFor(nextWeekdayDate({ today, weekday }), weekdayName);
    }
  }

  const dayOfMonth = matchDayOfMonth(input.normalized, today);

  if (dayOfMonth) {
    input.signals.push('date_day_of_month');
    return windowFor(dayOfMonth, explicitDateLabel(dayOfMonth));
  }

  return null;
}

function extractTimePreference(normalized: string, signals: string[]): BookingTimePreference {
  // Il marcatore mattina/pomeriggio/sera va letto PRIMA dell'ora: e' cio' che
  // trasforma "alle 3 del pomeriggio" in 15:00 invece che in 03:00.
  const marker = detectDayPartMarker(normalized);

  const afterClock = clockFromRegex(afterHourRegex, normalized, marker);

  if (afterClock) {
    const startHour = decimalHour(afterClock);
    signals.push('time_after_hour');
    pushMarkerSignal(signals, marker);

    return {
      dayPart: 'after_hour',
      startHour,
      endHour: Math.max(startHour + 1, 21),
    };
  }

  const beforeClock = clockFromRegex(beforeHourRegex, normalized, marker);

  if (beforeClock) {
    const endHour = decimalHour(beforeClock);
    signals.push('time_before_hour');
    pushMarkerSignal(signals, marker);

    return {
      dayPart: 'before_hour',
      startHour: endHour > 8 ? 8 : 0,
      endHour,
    };
  }

  const exactClock =
    clockFromRegex(exactHourRegex, normalized, marker) ??
    clockFromRegex(bareNoonRegex, normalized, marker);

  if (exactClock) {
    const startHour = decimalHour(exactClock);
    signals.push('time_exact_hour');
    pushMarkerSignal(signals, marker);

    return {
      dayPart: 'exact_hour',
      startHour,
      endHour: Math.min(startHour + 1, 24),
    };
  }

  if (marker === 'morning') {
    signals.push('time_morning');

    return { dayPart: 'morning', startHour: 8, endHour: 13 };
  }

  if (marker === 'afternoon') {
    signals.push('time_afternoon');

    return { dayPart: 'afternoon', startHour: 13, endHour: 18 };
  }

  if (marker === 'evening') {
    signals.push('time_evening');

    return { dayPart: 'evening', startHour: 18, endHour: 21 };
  }

  return {
    dayPart: 'any',
    startHour: null,
    endHour: null,
  };
}

function detectDayPartMarker(normalized: string): DayPartMarker | null {
  if (morningMarkerRegex.test(normalized)) {
    return 'morning';
  }

  if (afternoonMarkerRegex.test(normalized)) {
    return 'afternoon';
  }

  if (eveningMarkerRegex.test(normalized)) {
    return 'evening';
  }

  return null;
}

function pushMarkerSignal(signals: string[], marker: DayPartMarker | null): void {
  if (marker) {
    signals.push(`time_daypart_${marker}`);
  }
}

function clockFromRegex(
  regex: RegExp,
  normalized: string,
  marker: DayPartMarker | null,
): LocalClock | null {
  const match = regex.exec(normalized);

  return match ? parseClock(match, marker) : null;
}

function parseClock(match: RegExpExecArray, marker: DayPartMarker | null): LocalClock | null {
  const groups = match.groups;
  const rawHour = groups?.hour;

  if (!rawHour) {
    return null;
  }

  const spokenHour = /^\d{1,2}$/.test(rawHour) ? Number(rawHour) : hourByWord[rawHour];

  if (spokenHour === undefined || spokenHour > 23) {
    return null;
  }

  const rawMinutes = groups?.minutes;
  const rawMinuteWord = groups?.minuteWord;
  let minute = 0;

  if (rawMinutes !== undefined) {
    minute = Number(rawMinutes);
  } else if (rawMinuteWord !== undefined) {
    const parsed = minuteValue(rawMinuteWord);

    if (parsed === null) {
      return null;
    }

    minute = parsed;
  }

  if (minute > 59) {
    return null;
  }

  // "mezzogiorno" e "mezzanotte" sono gia' su base 24h: non vanno riconvertiti.
  const isAbsolute = rawHour === 'mezzogiorno' || rawHour === 'mezzanotte';
  let hour = isAbsolute ? spokenHour : resolveHour24(spokenHour, marker);

  const rawLessWord = groups?.lessWord;

  if (rawLessWord !== undefined) {
    const offset = minuteValue(rawLessWord);

    if (offset === null || offset === 0) {
      return null;
    }

    hour = (hour + 23) % 24;
    minute = 60 - offset;
  }

  return { hour, minute };
}

function resolveHour24(spokenHour: number, marker: DayPartMarker | null): number {
  if (marker === 'morning') {
    return spokenHour;
  }

  if (marker === 'afternoon' || marker === 'evening') {
    return spokenHour < 12 ? spokenHour + 12 : spokenHour;
  }

  // Senza marcatore esplicito, "alle 4" in una richiesta di appuntamento vuol dire
  // le 16: nessuno di questi esercizi riceve clienti fra l'una e le sei del mattino.
  return spokenHour >= 1 && spokenHour <= 6 ? spokenHour + 12 : spokenHour;
}

function minuteValue(token: string): number | null {
  if (/^\d{1,2}$/.test(token)) {
    const value = Number(token);

    return value <= 59 ? value : null;
  }

  return minuteByWord[token] ?? null;
}

function decimalHour(clock: LocalClock): number {
  return clock.hour + clock.minute / 60;
}

function matchRelativeDays(normalized: string): { days: number; label: string } | null {
  const match = relativeDaysRegex.exec(normalized);
  const rawCount = match?.[1];
  const unit = match?.[2];

  if (!rawCount || !unit) {
    return null;
  }

  const count = /^\d{1,2}$/.test(rawCount) ? Number(rawCount) : countByWord[rawCount];

  if (count === undefined || count < 1) {
    return null;
  }

  const days = unit.startsWith('settiman') ? count * 7 : count;

  return { days, label: `tra ${count} ${unit}` };
}

type ExplicitDateMatch =
  | { status: 'resolved'; localDate: LocalDate; label: string; signal: string }
  | { status: 'invalid' };

function matchExplicitDate(normalized: string, today: LocalDate): ExplicitDateMatch | null {
  const byName = monthNameDateRegex.exec(normalized);
  const monthName = byName?.[2];

  if (byName?.[1] && monthName) {
    const month = monthByName[monthName];
    const rawYear = byName[3];
    const localDate =
      month === undefined
        ? null
        : resolveExplicitDate({
            day: Number(byName[1]),
            month,
            year: rawYear === undefined ? null : Number(rawYear),
            today,
          });

    return localDate
      ? {
          status: 'resolved',
          localDate,
          label: explicitDateLabel(localDate),
          signal: 'date_explicit_month',
        }
      : { status: 'invalid' };
  }

  // La forma numerica resta permissiva: "15/20 euro" o "3/4 sedute" non sono date
  // e devono poter ricadere sulle regole successive invece di bloccare tutto.
  const numeric = numericDateRegex.exec(normalized);

  if (numeric?.[1] && numeric[2]) {
    const rawYear = numeric[3];
    const localDate = resolveExplicitDate({
      day: Number(numeric[1]),
      month: Number(numeric[2]),
      year: rawYear === undefined ? null : normalizeYear(Number(rawYear)),
      today,
    });

    if (localDate) {
      return {
        status: 'resolved',
        localDate,
        label: explicitDateLabel(localDate),
        signal: 'date_explicit_numeric',
      };
    }
  }

  return null;
}

function resolveExplicitDate(input: {
  day: number;
  month: number;
  year: number | null;
  today: LocalDate;
}): LocalDate | null {
  if (input.month < 1 || input.month > 12 || input.day < 1 || input.day > 31) {
    return null;
  }

  if (input.year !== null) {
    return isValidCalendarDate(input.year, input.month, input.day)
      ? { year: input.year, month: input.month, day: input.day }
      : null;
  }

  // Anno implicito: una data gia' passata nell'anno corrente si riferisce all'anno prossimo.
  const sameYear = { year: input.today.year, month: input.month, day: input.day };

  if (
    isValidCalendarDate(sameYear.year, sameYear.month, sameYear.day) &&
    compareLocalDates(sameYear, input.today) >= 0
  ) {
    return sameYear;
  }

  const nextYear = { year: input.today.year + 1, month: input.month, day: input.day };

  return isValidCalendarDate(nextYear.year, nextYear.month, nextYear.day) ? nextYear : null;
}

function matchDayOfMonth(normalized: string, today: LocalDate): LocalDate | null {
  const match = dayOfMonthRegex.exec(normalized);
  const rawDay = match?.[1];

  if (!rawDay) {
    return null;
  }

  const day = Number(rawDay);

  if (day < 1 || day > 31) {
    return null;
  }

  for (let offset = 0; offset < 13; offset += 1) {
    const base = addLocalMonths(today, offset);

    if (!isValidCalendarDate(base.year, base.month, day)) {
      continue;
    }

    const candidate = { year: base.year, month: base.month, day };

    if (compareLocalDates(candidate, today) >= 0) {
      return candidate;
    }
  }

  return null;
}

function explicitDateLabel(localDate: LocalDate): string {
  return `${localDate.day} ${monthLabels[localDate.month - 1] ?? ''}`.trim();
}

function normalizeYear(value: number): number {
  return value < 100 ? 2000 + value : value;
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
  const candidate = trimServiceCandidate(serviceMatch?.[1]?.trim() ?? '');

  if (candidate.length >= 4) {
    signals.push('service_phrase');
    return candidate;
  }

  return null;
}

// "prenotare per il 15/05" non chiede il servizio "15/05": la coda della frase che
// contiene la data non deve finire nel serviceQuery.
function trimServiceCandidate(candidate: string): string {
  const tokens = candidate.split(/\s+/);
  const kept: string[] = [];

  for (const token of tokens) {
    if (/\d/.test(token) || monthByName[token] !== undefined) {
      break;
    }

    kept.push(token);
  }

  return removeBookingStopwords(kept.join(' '));
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
  const rollsOverMidnight = endHour >= 24;

  return {
    from: zonedLocalTimeToUtc(input.localDate, clockFromDecimalHour(startHour), input.timezone),
    to: zonedLocalTimeToUtc(
      rollsOverMidnight ? addLocalDays(input.localDate, 1) : input.localDate,
      clockFromDecimalHour(rollsOverMidnight ? 0 : endHour),
      input.timezone,
    ),
    label: input.label,
  };
}

function clockFromDecimalHour(value: number): LocalClock {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(value, 24)) : 0;
  const totalMinutes = Math.round(safe * 60);

  return {
    hour: Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
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

function zonedLocalTimeToUtc(localDate: LocalDate, time: LocalClock, timezone: string): Date {
  const utcWallTime = Date.UTC(
    localDate.year,
    localDate.month - 1,
    localDate.day,
    time.hour,
    time.minute,
    0,
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

function nextWeekdayDate(input: { today: LocalDate; weekday: number }): LocalDate {
  const todayWeekday = new Date(
    Date.UTC(input.today.year, input.today.month - 1, input.today.day),
  ).getUTCDay();
  const delta = (input.weekday - todayWeekday + 7) % 7 || 7;

  return addLocalDays(input.today, delta);
}

function addLocalDays(date: LocalDate, days: number): LocalDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function addLocalMonths(date: LocalDate, months: number): LocalDate {
  const total = date.year * 12 + (date.month - 1) + months;

  return {
    year: Math.floor(total / 12),
    month: (total % 12) + 1,
    day: 1,
  };
}

function compareLocalDates(left: LocalDate, right: LocalDate): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  if (left.month !== right.month) {
    return left.month - right.month;
  }

  return left.day - right.day;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function numberPart(map: Map<string, string>, key: string): number {
  const value = map.get(key);
  const parsed = value ? Number(value) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new Error(`Could not format timezone part ${key}`);
  }

  return parsed;
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

  return !blockedCustomerNames.has(normalized);
}

function isCustomerNameStopToken(value: string): boolean {
  const normalized = normalizeForMatching(value);

  return customerNameStopTokens.has(normalized) || /^\d{1,2}$/.test(normalized);
}

function normalizeForMatching(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
