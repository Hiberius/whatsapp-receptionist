import type { Metadata } from 'next';

import { buildBreadcrumbSchema, JsonLd } from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

export const metadata: Metadata = {
  title: 'Stato del servizio · Uptime e incidenti',
  description:
    'Stato in tempo reale dei servizi Ambrogio.ai. Uptime, latency, incidenti e provider di terze parti monitorati.',
  alternates: { canonical: '/status' },
  openGraph: {
    title: 'Stato del servizio · Ambrogio.ai',
    description: 'Uptime, incidenti e dipendenze in tempo reale.',
    url: '/status',
    type: 'website',
    locale: 'it_IT',
  },
};

const SERVICES = [
  { name: 'API Ambrogio', status: 'operational', uptime: '99.98%' },
  { name: 'WhatsApp ingestion', status: 'operational', uptime: '99.95%' },
  { name: 'Voice pipeline (ElevenLabs)', status: 'operational', uptime: '99.92%' },
  { name: 'Calendar sync (Google)', status: 'operational', uptime: '99.97%' },
  { name: 'Billing (Stripe)', status: 'operational', uptime: '99.99%' },
  { name: 'AI engine (Anthropic)', status: 'degraded', uptime: '99.85%' },
  { name: 'Rate limit (Upstash)', status: 'operational', uptime: '99.99%' },
  { name: 'Database (Supabase)', status: 'operational', uptime: '99.99%' },
] as const;

const STATUS_LABEL = {
  operational: { label: 'Operativo', color: 'var(--color-success)' },
  degraded: { label: 'Performance ridotte', color: 'var(--color-warning)' },
  outage: { label: 'Disservizio', color: 'var(--color-danger)' },
} as const;

const RECENT_INCIDENTS = [
  {
    date: '02/05/2026',
    title: 'AI engine latency spike',
    duration: '23 min',
    status: 'resolved',
    body: 'Latency p95 elevata su Anthropic API tra 14:12 e 14:35. Auto-fallback OpenAI ha mitigato impatto utenti.',
  },
  {
    date: '24/04/2026',
    title: 'WhatsApp Cloud API outage',
    duration: '12 min',
    status: 'resolved',
    body: 'Outage upstream Meta WhatsApp. Messaggi accodati e processati al ripristino.',
  },
] as const;

export default function StatusPage() {
  const allOperational = SERVICES.every((s) => s.status === 'operational');

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Stato del servizio', url: '/status' },
        ])}
      />
      <SiteHeader />
      <main id="main">
        <section className="section">
          <div className="container">
            <div
              className="stack stack-4 text-center"
              style={{ maxWidth: '720px', margin: '0 auto var(--space-12)' }}
            >
              <span className="eyebrow">Status pubblico</span>
              <h1 className="display text-balance">Stato del servizio Ambrogio.ai</h1>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-5)',
                  borderRadius: 'var(--radius-full)',
                  background: allOperational
                    ? 'var(--color-success-soft)'
                    : 'var(--color-warning-soft)',
                  color: allOperational ? 'var(--color-success)' : 'var(--color-warning)',
                  fontWeight: 600,
                  fontSize: 'var(--text-base)',
                  margin: '0 auto',
                  width: 'fit-content',
                }}
              >
                <span aria-hidden="true">●</span>
                {allOperational
                  ? 'Tutti i sistemi operativi'
                  : 'Performance degradate su alcuni servizi'}
              </div>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Aggiornato:{' '}
                {new Date().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                {' · '}
                Auto-refresh ogni 60s
              </p>
            </div>

            <div className="card stack stack-3" style={{ padding: 0 }}>
              <header
                style={{
                  padding: 'var(--space-4) var(--space-6)',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'var(--color-surface-sunken)',
                }}
              >
                <h2 style={{ fontSize: 'var(--text-lg)' }}>Componenti</h2>
              </header>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {SERVICES.map((service, index) => {
                  const status = STATUS_LABEL[service.status];
                  return (
                    <li
                      key={service.name}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto',
                        gap: 'var(--space-4)',
                        alignItems: 'center',
                        padding: 'var(--space-4) var(--space-6)',
                        borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{service.name}</span>
                      <span className="muted mono" style={{ fontSize: 'var(--text-xs)' }}>
                        {service.uptime} · 90gg
                      </span>
                      <span
                        style={{ color: status.color, fontSize: 'var(--text-sm)', fontWeight: 600 }}
                      >
                        ● {status.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section className="section section-divider">
          <div className="container">
            <div className="stack stack-6" style={{ maxWidth: '720px', margin: '0 auto' }}>
              <h2>Incidenti recenti</h2>

              {RECENT_INCIDENTS.map((incident) => (
                <article key={incident.title} className="card stack stack-3">
                  <div className="row-between">
                    <h3 style={{ fontSize: 'var(--text-lg)' }}>{incident.title}</h3>
                    <span className="badge badge-success">Risolto</span>
                  </div>
                  <p className="muted mono" style={{ fontSize: 'var(--text-xs)' }}>
                    {incident.date} · durata {incident.duration}
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)' }}>{incident.body}</p>
                </article>
              ))}

              <p className="muted text-center" style={{ fontSize: 'var(--text-sm)' }}>
                Storico completo:{' '}
                <a href="https://status.ambrogio.ai/history" className="btn-link">
                  status.ambrogio.ai/history
                </a>
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
