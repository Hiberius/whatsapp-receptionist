import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Panoramica · Ambrogio.ai',
};

const KPIS = [
  { label: 'Conversazioni 24h', value: '47', trend: '+12', trendDir: 'up' },
  { label: 'Booking confermati', value: '18', trend: '+5', trendDir: 'up' },
  { label: 'Fatturato generato', value: '€1.240', trend: '+8.4%', trendDir: 'up' },
  { label: 'Passaggi a umano', value: '4.2%', trend: '-0.8%', trendDir: 'up' },
] as const;

const RECENT_ACTIVITY = [
  {
    time: '08:42',
    title: 'Booking confermato',
    detail: 'Anna R. — Igiene 14:00 lunedì',
    badge: 'success',
  },
  {
    time: '08:15',
    title: 'Conversazione conclusa',
    detail: 'Cliente ha richiesto info su prezzi pulizia',
    badge: 'neutral',
  },
  {
    time: '07:58',
    title: 'Vocale ricevuto',
    detail: 'Trascritto e gestito automaticamente',
    badge: 'neutral',
  },
  {
    time: '07:30',
    title: 'Reminder inviato',
    detail: '3 appuntamenti di oggi',
    badge: 'success',
  },
] as const;

export default function DashboardPage() {
  return (
    <>
      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">Panoramica</span>
          <h1>Buongiorno, Christian</h1>
          <p className="muted">
            Mentre dormivi Ambrogio ha gestito 12 conversazioni e prenotato 4 appuntamenti.
          </p>
        </div>
        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <Link href="/conversations" className="btn btn-secondary">
            Vedi conversazioni
          </Link>
          <Link href="/calendar" className="btn btn-primary">
            Vai al calendario
          </Link>
        </div>
      </div>

      <div className="kpi-grid">
        {KPIS.map((kpi) => (
          <article key={kpi.label} className="kpi">
            <span className="kpi-label">{kpi.label}</span>
            <span className="kpi-value">{kpi.value}</span>
            <span
              className={`kpi-trend ${kpi.trendDir === 'up' ? 'kpi-trend-up' : 'kpi-trend-down'}`}
            >
              <span aria-hidden="true">{kpi.trendDir === 'up' ? '↑' : '↓'}</span>
              {kpi.trend} vs ieri
            </span>
          </article>
        ))}
      </div>

      <div className="dashboard-content-grid">
        <section className="card stack stack-4">
          <div className="row-between">
            <h2 style={{ fontSize: 'var(--text-xl)' }}>Attività di oggi</h2>
            <Link href="/conversations" className="btn-link">
              Tutte →
            </Link>
          </div>
          <ul style={{ listStyle: 'none', padding: 0 }} className="stack stack-3">
            {RECENT_ACTIVITY.map((item) => (
              <li key={`${item.time}-${item.title}`} className="activity-row">
                <span className="mono muted activity-row-time">{item.time}</span>
                <div>
                  <p className="activity-row-title">{item.title}</p>
                  <p className="muted activity-row-detail">{item.detail}</p>
                </div>
                <span
                  className={`badge ${
                    item.badge === 'success' ? 'badge-success' : 'badge-neutral'
                  }`}
                >
                  {item.badge === 'success' ? 'OK' : '·'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="stack stack-4">
          <div className="card stack stack-3">
            <span className="eyebrow">Stato bot</span>
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--color-success)',
                }}
              />
              <span style={{ fontWeight: 600 }}>Operativo</span>
            </div>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              Tutti i canali connessi: WhatsApp, Google Calendar, voice.
            </p>
          </div>

          <div className="card stack stack-3">
            <span className="eyebrow">Usage</span>
            <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
              347
              <span className="muted" style={{ fontSize: 'var(--text-base)' }}>
                /2.500
              </span>
            </p>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              Conversazioni AI questo mese (piano Professional).
            </p>
            <div
              style={{
                height: 6,
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-surface-sunken)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '13.9%',
                  height: '100%',
                  background: 'var(--color-accent)',
                }}
              />
            </div>
          </div>

          <div className="card stack stack-3" style={{ background: 'var(--color-accent-soft)' }}>
            <span className="eyebrow">Suggerimento</span>
            <p style={{ fontSize: 'var(--text-sm)' }}>
              3 clienti aspettano un follow-up. Vuoi che Ambrogio mandi un reminder personalizzato?
            </p>
            <button type="button" className="btn btn-primary btn-sm">
              Invia reminder
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
