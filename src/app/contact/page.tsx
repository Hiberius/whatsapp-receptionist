import type { Metadata } from 'next';

import { buildBreadcrumbSchema, JsonLd, organizationSchema } from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';
import { ContactForm } from '@/components/forms/ContactForm';

export const metadata: Metadata = {
  title: 'Contatti · Parla con il team Ambrogio.ai',
  description:
    'Contatta il team Ambrogio.ai per supporto tecnico, vendite, partnership o richieste stampa. Risposta entro 4 ore lavorative.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contatti · Ambrogio.ai',
    description:
      'Parla con il team. Vendite, supporto, partnership o stampa. Risposta entro 4 ore lavorative.',
    url: '/contact',
    type: 'website',
    locale: 'it_IT',
  },
};

export default function ContactPage() {
  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Contatti', url: '/contact' },
        ])}
      />
      <SiteHeader />
      <main id="main">
        <section className="section">
          <div className="container">
            <div
              style={{
                display: 'grid',
                gap: 'var(--space-12)',
                gridTemplateColumns: '1fr',
                maxWidth: '960px',
                margin: '0 auto',
              }}
            >
              <div className="stack stack-4 text-center">
                <span className="badge">Contatti</span>
                <h1 className="display text-balance">Parliamone.</h1>
                <p className="lead text-pretty" style={{ margin: '0 auto' }}>
                  Compila il form qui sotto. Per casi urgenti scrivi diretto:{' '}
                  <a href="mailto:hello@ambrogio.ai" className="btn-link">
                    hello@ambrogio.ai
                  </a>
                  .
                </p>
              </div>

              <ContactForm />

              <address
                className="card stack stack-3"
                style={{
                  fontStyle: 'normal',
                  background: 'var(--color-surface-sunken)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <strong style={{ color: 'var(--color-text)' }}>Ambrogio.ai · Roma, Italia</strong>
                <p>
                  <strong>Sales &amp; partnership:</strong>{' '}
                  <a href="mailto:hello@ambrogio.ai" className="btn-link">
                    hello@ambrogio.ai
                  </a>
                </p>
                <p>
                  <strong>Supporto tecnico:</strong>{' '}
                  <a href="mailto:support@ambrogio.ai" className="btn-link">
                    support@ambrogio.ai
                  </a>
                </p>
                <p>
                  <strong>Data Protection Officer:</strong>{' '}
                  <a href="mailto:dpo@ambrogio.ai" className="btn-link">
                    dpo@ambrogio.ai
                  </a>
                </p>
              </address>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
