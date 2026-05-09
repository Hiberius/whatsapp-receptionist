import type { Metadata } from 'next';

import {
  buildBreadcrumbSchema,
  buildEventSchema,
  buildWebPageSchema,
  JsonLd,
} from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

export const metadata: Metadata = {
  title: 'Changelog · Aggiornamenti Ambrogio.ai',
  description:
    'Segui in tempo reale gli aggiornamenti di Ambrogio.ai: nuove funzionalità, miglioramenti, fix di sicurezza e feed RSS.',
  alternates: {
    canonical: '/changelog',
    types: { 'application/rss+xml': '/changelog/feed.xml' },
  },
};

interface ChangelogEntry {
  date: string;
  version: string;
  category: 'feature' | 'improvement' | 'fix' | 'security';
  title: string;
  body: string;
}

const ENTRIES: ChangelogEntry[] = [
  {
    date: '8 maggio 2026',
    version: 'v0.1.0',
    category: 'feature',
    title: 'Lancio beta privata · v0.1.0',
    body: 'Ambrogio.ai entra in beta privata. Includono: WhatsApp + voice + Google Calendar + Stripe billing + fatturazione SDI elettronica.',
  },
  {
    date: '5 maggio 2026',
    version: '—',
    category: 'security',
    title: 'CSP nonce-based + GDPR Art.15/17',
    body: 'Hardening completo: CSP per-request nonce, COEP/COOP/CORP, endpoint export e delete dati GDPR, rate limiting Upstash su tutti gli endpoint sensibili.',
  },
  {
    date: '2 maggio 2026',
    version: '—',
    category: 'improvement',
    title: 'TypeScript strict + exactOptionalPropertyTypes',
    body: 'Tooling DX: ESLint 9 + Prettier + Husky pre-commit, Stripe webhook con discriminant guards type-safe.',
  },
  {
    date: '27 aprile 2026',
    version: '—',
    category: 'feature',
    title: 'AI booking extractor v1',
    body: 'Estrazione strutturata di intent, servizio, data/ora, urgenza dalle conversazioni WhatsApp. Eval set deterministico.',
  },
  {
    date: '24 aprile 2026',
    version: '—',
    category: 'feature',
    title: 'Backend MVP scaffolding',
    body: 'Setup iniziale Next 15 + Supabase con RLS, auth multi-tenant, webhook Stripe e WhatsApp con signature verification.',
  },
];

const CATEGORY_BADGE = {
  feature: { label: 'Nuovo', class: 'badge' },
  improvement: { label: 'Miglioria', class: 'badge-warm' },
  fix: { label: 'Fix', class: 'badge-success' },
  security: { label: 'Sicurezza', class: 'badge-danger' },
} as const;

export default async function ChangelogPage() {
  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Changelog', url: '/changelog' },
        ])}
      />
      <JsonLd
        data={buildWebPageSchema({
          type: 'CollectionPage',
          name: 'Changelog · Ambrogio.ai',
          description: 'Aggiornamenti, nuove funzionalità e fix di Ambrogio.ai.',
          url: '/changelog',
        })}
      />
      <JsonLd
        data={buildEventSchema({
          name: 'Lancio beta privata Ambrogio.ai',
          description:
            'Ambrogio.ai entra in beta privata con il primo cliente pilota. Include: WhatsApp + voice + Google Calendar + Stripe billing + fatturazione SDI elettronica.',
          startDate: '2026-05-08',
          url: '/changelog',
          eventStatus: 'EventScheduled',
          eventAttendanceMode: 'OnlineEventAttendanceMode',
        })}
      />
      <SiteHeader />
      <main id="main">
        <section className="section">
          <div className="container-narrow">
            <div className="stack stack-4" style={{ marginBottom: 'var(--space-12)' }}>
              <span className="eyebrow">Changelog</span>
              <h1 className="display text-balance">Cosa è cambiato</h1>
              <p className="lead text-pretty">
                Aggiornamenti, miglioramenti e correzioni. Aggiornato in tempo reale dal team
                tecnico.
              </p>
            </div>

            <ol style={{ listStyle: 'none', padding: 0 }} className="stack stack-8">
              {ENTRIES.map((entry) => {
                const badge = CATEGORY_BADGE[entry.category];
                return (
                  <li
                    key={`${entry.date}-${entry.title}`}
                    style={{
                      borderLeft: '2px solid var(--color-border)',
                      paddingLeft: 'var(--space-6)',
                      position: 'relative',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: '-8px',
                        top: '6px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: 'var(--color-accent)',
                        border: '3px solid var(--color-bg)',
                      }}
                    />
                    <div
                      className="row"
                      style={{ gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}
                    >
                      <span className="muted mono" style={{ fontSize: 'var(--text-xs)' }}>
                        {entry.date}
                      </span>
                      {entry.version !== '—' ? (
                        <span className="badge badge-neutral">{entry.version}</span>
                      ) : null}
                      <span className={`badge ${badge.class}`}>{badge.label}</span>
                    </div>
                    <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>
                      {entry.title}
                    </h2>
                    <p style={{ color: 'var(--color-text-secondary)' }}>{entry.body}</p>
                  </li>
                );
              })}
            </ol>

            <div
              className="card text-center"
              style={{
                marginTop: 'var(--space-12)',
                background: 'var(--color-accent-soft)',
                borderColor: 'oklch(85% 0.05 175)',
              }}
            >
              <p style={{ fontSize: 'var(--text-sm)' }}>
                <strong>Iscriviti al feed RSS</strong> per ricevere aggiornamenti automatici:{' '}
                <a href="/changelog/feed.xml" className="btn-link">
                  /changelog/feed.xml
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
