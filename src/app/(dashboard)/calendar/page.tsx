import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession, type AuthSession } from '@/lib/auth/session';
import { toAppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AppointmentStatus, BookingSource } from '@/server/appointments/booking';
import { createTenantSettingsService } from '@/server/settings/tenant-settings';

export const metadata: Metadata = {
  title: 'Calendario · Ambrogio.ai',
};

/**
 * Quanti giorni in avanti mostra l'agenda. Nessuna data e' scritta a mano:
 * la finestra parte sempre dall'istante della richiesta e viene ricalcolata
 * nel fuso orario del tenant.
 */
const DAYS_AHEAD = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_LIMIT = 300;
const DEFAULT_TIMEZONE = 'Europe/Rome';

const STATUS_CONFIG: Record<AppointmentStatus, { readonly label: string; readonly badge: string }> =
  {
    confirmed: { label: 'Confermato', badge: 'badge-success' },
    cancelled: { label: 'Cancellato', badge: 'badge-danger' },
    completed: { label: 'Concluso', badge: 'badge-neutral' },
    no_show: { label: 'Non presentato', badge: 'badge-warm' },
  };

const SOURCE_LABEL: Record<BookingSource, string> = {
  manual: 'Inserito a mano',
  whatsapp_ai: 'Prenotato da Ambrogio su WhatsApp',
  dashboard: 'Creato dalla dashboard',
  api: 'Creato via API',
};

type CalendarAppointment = {
  readonly id: string;
  readonly dayKey: string;
  readonly scheduledAt: Date;
  readonly durationMinutes: number | null;
  readonly customerName: string;
  readonly serviceName: string | null;
  readonly status: AppointmentStatus;
  readonly bookingSource: BookingSource;
};

type CalendarDay = {
  readonly key: string;
  readonly label: string;
  readonly appointments: readonly CalendarAppointment[];
};

type CalendarData = {
  readonly timezone: string;
  readonly rangeLabel: string;
  readonly days: readonly CalendarDay[];
  readonly todayCount: number;
  readonly weekCount: number;
  readonly confirmedCount: number;
  readonly aiBookedCount: number;
};

type CalendarResult = { readonly ok: true; readonly data: CalendarData } | { readonly ok: false };

export default async function CalendarPage() {
  const session = await requireSession();
  const result = await loadCalendar(session);

  if (!result.ok) {
    return (
      <>
        <CalendarHeader subtitle="Agenda non disponibile in questo momento." />
        <section className="card card-padded stack stack-3">
          <h2 style={{ fontSize: 'var(--text-lg)' }}>Non riesco a leggere gli appuntamenti</h2>
          <p className="muted">
            La lettura dell&apos;agenda è fallita. Ricarica la pagina fra qualche istante: se il
            problema resta, controlla lo stato dei servizi.
          </p>
          <Link href="/status" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
            Stato del servizio
          </Link>
        </section>
      </>
    );
  }

  const { data } = result;

  return (
    <>
      <CalendarHeader subtitle={`${data.rangeLabel} · fuso orario ${data.timezone}`} />

      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
      >
        <article className="kpi">
          <span className="kpi-label">Oggi</span>
          <span className="kpi-value">{data.todayCount}</span>
        </article>
        <article className="kpi">
          <span className="kpi-label">Prossimi 7 giorni</span>
          <span className="kpi-value">{data.weekCount}</span>
        </article>
        <article className="kpi">
          <span className="kpi-label">Confermati</span>
          <span className="kpi-value">{data.confirmedCount}</span>
        </article>
        <article className="kpi">
          <span className="kpi-label">Prenotati da Ambrogio</span>
          <span className="kpi-value">{data.aiBookedCount}</span>
        </article>
      </div>

      {data.days.length === 0 ? (
        <section className="card">
          <div className="empty-state">
            <p className="empty-state-title">Nessun appuntamento in agenda</p>
            <p className="empty-state-text">
              Ambrogio prenota da solo quando servizi e orari di apertura sono configurati. Se
              l&apos;agenda resta vuota, parti da lì.
            </p>
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <Link href="/settings" className="btn btn-primary">
                Configura servizi e orari
              </Link>
              <Link href="/conversations" className="btn btn-ghost">
                Vedi le conversazioni
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <div className="stack stack-6">
          {data.days.map((day) => (
            <section key={day.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <header
                style={{
                  padding: 'var(--space-4) var(--space-6)',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  background: 'var(--color-surface-sunken)',
                }}
              >
                <h2 style={{ fontSize: 'var(--text-lg)' }}>{day.label}</h2>
                <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                  {day.appointments.length === 1
                    ? '1 appuntamento'
                    : `${day.appointments.length} appuntamenti`}
                </span>
              </header>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {day.appointments.map((appointment, index) => (
                  <li
                    key={appointment.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '96px 1fr auto',
                      gap: 'var(--space-4)',
                      alignItems: 'center',
                      padding: 'var(--space-4) var(--space-6)',
                      borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 700,
                        color: 'var(--color-accent)',
                      }}
                    >
                      {formatTime(appointment.scheduledAt, data.timezone)}
                    </span>
                    <div>
                      <p style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
                        {appointment.customerName}
                      </p>
                      <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: '2px' }}>
                        {describeAppointment(appointment)}
                      </p>
                    </div>
                    <span className={`badge ${STATUS_CONFIG[appointment.status].badge}`}>
                      {STATUS_CONFIG[appointment.status].label}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function CalendarHeader({ subtitle }: { readonly subtitle: string }) {
  return (
    <div className="dashboard-header">
      <div className="stack stack-2">
        <span className="eyebrow">Calendario</span>
        <h1>Agenda</h1>
        <p className="muted">{subtitle}</p>
      </div>
    </div>
  );
}

async function loadCalendar(session: AuthSession): Promise<CalendarResult> {
  const timezone = await loadTimezone(session);
  const now = new Date();
  const dayKeys = buildDayKeys(now, timezone);
  const todayKey = dayKeys[0] ?? formatDayKey(now, timezone);
  const weekKeys = new Set(dayKeys.slice(0, 7));
  const windowKeys = new Set(dayKeys);

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('appointments')
      .select(
        'id, customer_name, customer_identifier, scheduled_at, duration_minutes, service_type, status, booking_source',
      )
      .eq('tenant_id', session.tenantId)
      .gte('scheduled_at', new Date(now.getTime() - 2 * DAY_MS).toISOString())
      .lte('scheduled_at', new Date(now.getTime() + (DAYS_AHEAD + 2) * DAY_MS).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(FETCH_LIMIT);

    if (error) {
      throw error;
    }

    const rows: unknown[] = Array.isArray(data) ? data : [];
    const appointments = rows
      .map((row) => toCalendarAppointment(row, timezone))
      .filter((appointment): appointment is CalendarAppointment => appointment !== null)
      .filter((appointment) => windowKeys.has(appointment.dayKey));

    const days = dayKeys
      .map((key): CalendarDay | null => {
        const dayAppointments = appointments.filter((appointment) => appointment.dayKey === key);

        const first = dayAppointments[0];

        if (!first) {
          return null;
        }

        return {
          key,
          label: buildDayLabel(first.scheduledAt, key, dayKeys, timezone),
          appointments: dayAppointments,
        };
      })
      .filter((day): day is CalendarDay => day !== null);

    const active = appointments.filter((appointment) => appointment.status !== 'cancelled');

    return {
      ok: true,
      data: {
        timezone,
        rangeLabel: buildRangeLabel(dayKeys, timezone),
        days,
        todayCount: active.filter((appointment) => appointment.dayKey === todayKey).length,
        weekCount: active.filter((appointment) => weekKeys.has(appointment.dayKey)).length,
        confirmedCount: appointments.filter((appointment) => appointment.status === 'confirmed')
          .length,
        aiBookedCount: appointments.filter(
          (appointment) => appointment.bookingSource === 'whatsapp_ai',
        ).length,
      },
    };
  } catch (error) {
    const appError = toAppError(error);

    logger.error(
      { tenantId: session.tenantId, code: appError.code, cause: appError.cause },
      'Failed to load dashboard calendar',
    );

    return { ok: false };
  }
}

/**
 * Il fuso orario e' un dato del tenant, non una costante: se le impostazioni
 * non sono leggibili si ricade sul default usato anche dalle notifiche, senza
 * far fallire tutta la pagina.
 */
async function loadTimezone(session: AuthSession): Promise<string> {
  try {
    const snapshot = await createTenantSettingsService().getSnapshot({ session });

    return snapshot.tenant.timezone.trim() || DEFAULT_TIMEZONE;
  } catch (error) {
    logger.warn(
      { tenantId: session.tenantId, code: toAppError(error).code },
      'Failed to read tenant timezone for calendar',
    );

    return DEFAULT_TIMEZONE;
  }
}

function buildDayKeys(now: Date, timezone: string): string[] {
  const todayKey = formatDayKey(now, timezone);
  const anchor = new Date(`${todayKey}T12:00:00Z`);
  const keys = new Set<string>([todayKey]);

  for (let offset = 0; offset <= DAYS_AHEAD; offset += 1) {
    keys.add(formatDayKey(new Date(anchor.getTime() + offset * DAY_MS), timezone));
  }

  return [...keys].sort().slice(0, DAYS_AHEAD + 1);
}

function buildDayLabel(
  date: Date,
  key: string,
  dayKeys: readonly string[],
  timezone: string,
): string {
  const formatted = new Intl.DateTimeFormat('it-IT', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

  if (key === dayKeys[0]) {
    return `Oggi · ${formatted}`;
  }

  if (key === dayKeys[1]) {
    return `Domani · ${formatted}`;
  }

  return formatted;
}

function buildRangeLabel(dayKeys: readonly string[], timezone: string): string {
  const first = dayKeys[0];
  const last = dayKeys[dayKeys.length - 1];

  if (!first || !last) {
    return 'Prossimi giorni';
  }

  const formatter = new Intl.DateTimeFormat('it-IT', {
    timeZone: timezone,
    day: 'numeric',
    month: 'long',
  });

  return `Dal ${formatter.format(new Date(`${first}T12:00:00Z`))} al ${formatter.format(
    new Date(`${last}T12:00:00Z`),
  )}`;
}

function describeAppointment(appointment: CalendarAppointment): string {
  const parts = [
    appointment.serviceName ?? 'Servizio non indicato',
    appointment.durationMinutes !== null ? `${appointment.durationMinutes} min` : null,
    SOURCE_LABEL[appointment.bookingSource],
  ].filter((part): part is string => part !== null);

  return parts.join(' · ');
}

function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Chiave giorno `YYYY-MM-DD` nel fuso del tenant, ordinabile come stringa. */
function formatDayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function toCalendarAppointment(row: unknown, timezone: string): CalendarAppointment | null {
  if (typeof row !== 'object' || row === null) {
    return null;
  }

  const record = row as Record<string, unknown>;
  const id = readString(record['id']);
  const scheduledAtRaw = readString(record['scheduled_at']);
  const status = record['status'];
  const bookingSource = record['booking_source'];

  if (!id || !scheduledAtRaw || !isAppointmentStatus(status) || !isBookingSource(bookingSource)) {
    return null;
  }

  const scheduledAt = new Date(scheduledAtRaw);

  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  const durationMinutes = record['duration_minutes'];

  return {
    id,
    dayKey: formatDayKey(scheduledAt, timezone),
    scheduledAt,
    durationMinutes: typeof durationMinutes === 'number' ? durationMinutes : null,
    customerName:
      readString(record['customer_name']) ??
      readString(record['customer_identifier']) ??
      'Contatto senza nome',
    serviceName: readString(record['service_type']),
    status,
    bookingSource,
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return (
    value === 'confirmed' || value === 'cancelled' || value === 'completed' || value === 'no_show'
  );
}

function isBookingSource(value: unknown): value is BookingSource {
  return value === 'manual' || value === 'whatsapp_ai' || value === 'dashboard' || value === 'api';
}
