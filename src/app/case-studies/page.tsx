import type { Metadata } from 'next';
import Link from 'next/link';

import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  JsonLd,
} from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

export const metadata: Metadata = {
  title: 'Case study · Risultati reali di studi italiani',
  description:
    'Studi reali, numeri reali. ROI misurato di chi ha smesso di perdere chiamate dopo aver attivato Ambrogio.ai.',
  alternates: { canonical: '/case-studies' },
  openGraph: {
    title: 'Case study Ambrogio.ai · Risultati reali di studi italiani',
    description: 'ROI misurato e numeri verificati dei primi pilot Ambrogio.ai.',
    url: '/case-studies',
    type: 'website',
    locale: 'it_IT',
  },
};

const CASES = [
  {
    slug: 'come-uno-studio-dentistico-recupera-12k-anno',
    industry: 'Studi dentistici',
    label: 'Case study #01',
    title: 'Studio Dentistico Rossi · Milano',
    metric: '+€12.400',
    metricLabel: 'fatturato recuperato in 90 giorni',
    body: '8 chiamate fuori orario al giorno trasformate in conversazioni WhatsApp. 73% conversion in booking confermato sul calendario.',
  },
] as const;

export default function CaseStudiesPage() {
  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Case study', url: '/case-studies' },
        ])}
      />
      <JsonLd
        data={buildCollectionPageSchema({
          name: 'Case study Ambrogio.ai',
          description: 'Risultati reali di studi italiani che hanno attivato Ambrogio.ai.',
          url: '/case-studies',
          hasPart: CASES.map((c) => ({
            name: c.title,
            url: `/blog/${c.slug}`,
          })),
        })}
      />
      <SiteHeader />
      <main id="main">
        <section className="section">
          <div className="container">
            <div
              className="stack stack-4"
              style={{ maxWidth: '720px', marginBottom: 'var(--space-12)' }}
            >
              <span className="badge">Case study</span>
              <h1 className="display text-balance">Numeri reali, non promesse marketing.</h1>
              <p className="lead text-pretty">
                Ogni case study è validato dal cliente, con metriche verificate prima e dopo
                l&apos;attivazione di Ambrogio.ai.
              </p>
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
            >
              {CASES.map((caseStudy) => (
                <Link
                  key={caseStudy.slug}
                  href={`/blog/${caseStudy.slug}`}
                  className="card card-padded card-interactive stack stack-4"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <span className="eyebrow">{caseStudy.label}</span>
                  <h2 style={{ fontSize: 'var(--text-xl)' }}>{caseStudy.title}</h2>
                  <div className="stack stack-1">
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'var(--text-3xl)',
                        fontWeight: 700,
                        color: 'var(--color-accent)',
                      }}
                    >
                      {caseStudy.metric}
                    </span>
                    <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                      {caseStudy.metricLabel}
                    </span>
                  </div>
                  <p style={{ color: 'var(--color-text-secondary)' }}>{caseStudy.body}</p>
                  <span
                    className="row"
                    style={{
                      gap: 'var(--space-2)',
                      color: 'var(--color-accent)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      marginTop: 'auto',
                    }}
                  >
                    Leggi case study completo <span aria-hidden="true">→</span>
                  </span>
                </Link>
              ))}
            </div>

            <div
              className="card card-padded stack stack-4 text-center"
              style={{
                marginTop: 'var(--space-12)',
                background: 'var(--color-surface-sunken)',
                alignItems: 'center',
              }}
            >
              <h3>Vuoi essere il prossimo case study?</h3>
              <p className="muted" style={{ maxWidth: '50ch' }}>
                I primi 50 studi pilota ricevono onboarding co-gestito gratuito (€500 di valore) e
                prezzo beta congelato per 12 mesi.
              </p>
              <Link href="/register" className="btn btn-primary">
                Inizia la prova
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
