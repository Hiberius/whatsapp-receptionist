import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Calendario · Ambrogio.ai',
};

const TODAY_APPOINTMENTS = [
  {
    time: '09:00',
    customer: 'Marco Bianchi',
    service: 'Igiene dentale',
    operator: 'Dott.ssa Rossi',
    status: 'confirmed',
  },
  {
    time: '10:30',
    customer: 'Anna Verdi',
    service: 'Controllo annuale',
    operator: 'Dott.ssa Rossi',
    status: 'confirmed',
  },
  {
    time: '11:30',
    customer: 'Luigi Neri',
    service: 'Otturazione',
    operator: 'Dott. Bianchi',
    status: 'pending',
  },
  {
    time: '14:00',
    customer: 'Paola Bruni',
    service: 'Igiene dentale',
    operator: 'Dott.ssa Rossi',
    status: 'confirmed',
  },
  {
    time: '15:30',
    customer: 'Anna Rossi',
    service: 'Igiene dentale',
    operator: 'Dott.ssa Rossi',
    status: 'confirmed',
  },
  {
    time: '17:00',
    customer: '+39 333 1234567',
    service: 'Prima visita',
    operator: 'Dott. Bianchi',
    status: 'pending',
  },
] as const;

const STATUS_CONFIG = {
  confirmed: { label: 'Confermato', badge: 'badge-success' },
  pending: { label: 'In attesa', badge: 'badge-warm' },
  cancelled: { label: 'Cancellato', badge: 'badge-danger' },
} as const;

export default function CalendarPage() {
  return (
    <>
      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">Calendario</span>
          <h1>Oggi · 8 maggio 2026</h1>
          <p className="muted">6 appuntamenti programmati. 2 in attesa di conferma.</p>
        </div>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <button type="button" className="btn btn-ghost">
            ← Ieri
          </button>
          <button type="button" className="btn btn-secondary">
            Oggi
          </button>
          <button type="button" className="btn btn-ghost">
            Domani →
          </button>
        </div>
      </div>

      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
      >
        <article className="kpi">
          <span className="kpi-label">Confermati</span>
          <span className="kpi-value">4</span>
        </article>
        <article className="kpi">
          <span className="kpi-label">In attesa</span>
          <span className="kpi-value">2</span>
        </article>
        <article className="kpi">
          <span className="kpi-label">Slot liberi</span>
          <span className="kpi-value">3</span>
        </article>
        <article className="kpi">
          <span className="kpi-label">Tasso riempimento</span>
          <span className="kpi-value">66%</span>
        </article>
      </div>

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <header
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--color-surface-sunken)',
          }}
        >
          <h2 style={{ fontSize: 'var(--text-lg)' }}>Agenda di oggi</h2>
          <span className="badge badge-success">Sync con Google Calendar attivo</span>
        </header>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {TODAY_APPOINTMENTS.map((appt, index) => {
            const status = STATUS_CONFIG[appt.status];
            return (
              <li
                key={`${appt.time}-${appt.customer}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '88px 1fr auto auto',
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
                  {appt.time}
                </span>
                <div>
                  <p style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{appt.customer}</p>
                  <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: '2px' }}>
                    {appt.service} · {appt.operator}
                  </p>
                </div>
                <span className={`badge ${status.badge}`}>{status.label}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Dettagli appuntamento di ${appt.customer} alle ${appt.time}, ${appt.service}`}
                >
                  Dettagli
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
