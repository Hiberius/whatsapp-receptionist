import type { Metadata } from 'next';

import { buildBreadcrumbSchema, JsonLd, organizationSchema } from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

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

              <form action="/api/contact" method="POST" className="card card-padded stack stack-5">
                <div
                  role="status"
                  aria-live="polite"
                  id="contact-form-errors"
                  className="sr-only"
                />

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--space-4)',
                  }}
                >
                  <div className="field">
                    <label htmlFor="name" className="label">
                      Nome
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      autoComplete="name"
                      className="input"
                      placeholder="Mario Rossi"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="email" className="label">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      className="input"
                      placeholder="mario@studio.it"
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="company" className="label">
                    Studio o azienda
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    autoComplete="organization"
                    className="input"
                  />
                </div>

                <div className="field">
                  <label htmlFor="topic" className="label">
                    Di cosa vuoi parlare?
                  </label>
                  <select id="topic" name="topic" className="select" defaultValue="">
                    <option value="" disabled>
                      Seleziona
                    </option>
                    <option value="sales">Voglio provare Ambrogio</option>
                    <option value="support">Ho bisogno di supporto</option>
                    <option value="agency">Sono un&apos;agenzia / partner</option>
                    <option value="press">Stampa / media</option>
                    <option value="other">Altro</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="message" className="label">
                    Messaggio
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={6}
                    className="textarea"
                    placeholder="Raccontaci."
                  />
                </div>

                <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                  <input id="consent" name="consent" type="checkbox" required />
                  <label
                    htmlFor="consent"
                    className="muted"
                    style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}
                  >
                    Acconsento al trattamento dei dati per finalità di contatto come descritto nella{' '}
                    <a href="/legal/privacy" className="btn-link">
                      privacy policy
                    </a>
                    .
                  </label>
                </div>

                <button type="submit" className="btn btn-primary btn-lg">
                  Invia messaggio
                </button>
              </form>

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
