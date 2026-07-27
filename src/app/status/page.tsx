import type { Metadata } from 'next';

import { buildBreadcrumbSchema, JsonLd } from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { type HealthStatus, overallStatus, runHealthChecks } from '@/lib/health/checks';

export const metadata: Metadata = {
  title: 'Stato del servizio · Dipendenze in tempo reale',
  description:
    'Stato in tempo reale delle dipendenze Ambrogio.ai: database, rate limiting, motore AI e fatturazione. Misurato a ogni richiesta, non dichiarato.',
  alternates: { canonical: '/status' },
  openGraph: {
    title: 'Stato del servizio · Ambrogio.ai',
    description: 'Stato in tempo reale delle dipendenze di sistema.',
    url: '/status',
    type: 'website',
    locale: 'it_IT',
  },
};

/**
 * Rigenerata al massimo ogni 60s: la pagina dichiara questa frequenza
 * all'utente, quindi il valore deve restare allineato al testo mostrato.
 */
export const revalidate = 60;

const STATUS_PRESENTATION: Record<HealthStatus, { label: string; color: string }> = {
  ok: { label: 'Operativo', color: 'var(--color-success)' },
  degraded: { label: 'Performance ridotte', color: 'var(--color-warning)' },
  down: { label: 'Non raggiungibile', color: 'var(--color-danger)' },
};

const OVERALL_PRESENTATION: Record<
  HealthStatus,
  { label: string; background: string; color: string }
> = {
  ok: {
    label: 'Tutte le dipendenze rispondono',
    background: 'var(--color-success-soft)',
    color: 'var(--color-success)',
  },
  degraded: {
    label: 'Performance ridotte su alcune dipendenze',
    background: 'var(--color-warning-soft)',
    color: 'var(--color-warning)',
  },
  down: {
    label: 'Una o più dipendenze non rispondono',
    background: 'var(--color-danger-soft)',
    color: 'var(--color-danger)',
  },
};

export default async function StatusPage() {
  const checks = await runHealthChecks();
  const overall = OVERALL_PRESENTATION[overallStatus(checks)];

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
                  background: overall.background,
                  color: overall.color,
                  fontWeight: 600,
                  fontSize: 'var(--text-base)',
                  margin: '0 auto',
                  width: 'fit-content',
                }}
              >
                <span aria-hidden="true">●</span>
                {overall.label}
              </div>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Rilevazione:{' '}
                {new Date().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                {' · '}
                aggiornata al massimo ogni 60s
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
                <h2 style={{ fontSize: 'var(--text-lg)' }}>Dipendenze</h2>
              </header>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {checks.map((check, index) => {
                  const presentation = STATUS_PRESENTATION[check.status];
                  return (
                    <li
                      key={check.name}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto',
                        gap: 'var(--space-4)',
                        alignItems: 'center',
                        padding: 'var(--space-4) var(--space-6)',
                        borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{check.label}</span>
                      <span className="muted mono" style={{ fontSize: 'var(--text-xs)' }}>
                        {check.latencyMs === undefined ? '—' : `${check.latencyMs} ms`}
                      </span>
                      <span
                        style={{
                          color: presentation.color,
                          fontSize: 'var(--text-sm)',
                          fontWeight: 600,
                        }}
                      >
                        ● {presentation.label}
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
            <div className="stack stack-4" style={{ maxWidth: '720px', margin: '0 auto' }}>
              <h2>Come leggere questa pagina</h2>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Ogni riga è una probe reale eseguita al caricamento della pagina verso il provider
                indicato, con la latenza effettivamente misurata. Non pubblichiamo percentuali di
                uptime storico: non abbiamo ancora un sistema di monitoraggio continuo che le
                produca, e riportare numeri che non misuriamo sarebbe un&apos;affermazione priva di
                riscontro.
              </p>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Lo stesso dato è disponibile in formato macchina su{' '}
                <code className="mono">/api/health/deep</code>, utilizzabile come endpoint di
                monitoraggio esterno.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
