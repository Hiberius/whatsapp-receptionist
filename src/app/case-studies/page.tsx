import type { Metadata } from 'next';
import Link from 'next/link';

import { buildBreadcrumbSchema, JsonLd } from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

export const metadata: Metadata = {
  title: 'Case study · Programma pilota',
  description:
    'Nessun case study pubblicato: Ambrogio.ai è in beta. Pubblicheremo risultati solo quando saranno misurati e validati dal cliente.',
  alternates: { canonical: '/case-studies' },
  openGraph: {
    title: 'Case study Ambrogio.ai · Programma pilota',
    description: 'Risultati pubblicati solo quando misurati e validati dal cliente.',
    url: '/case-studies',
    type: 'website',
    locale: 'it_IT',
  },
};

/*
 * Questa pagina non espone `CollectionPage` con `hasPart`: non esistono ancora
 * case study da elencare, e dichiarare a Google elementi inesistenti è una
 * violazione delle policy sui dati strutturati.
 */

const COMMITMENTS = [
  {
    title: 'Metriche misurate, non stimate',
    body: 'Confronto tra i 90 giorni precedenti e i 90 successivi all’attivazione, sui dati del gestionale del cliente, non su nostre proiezioni.',
  },
  {
    title: 'Validazione firmata dal cliente',
    body: 'Nessun numero viene pubblicato senza approvazione esplicita e scritta di chi lo ha generato, con nome e ruolo verificabili.',
  },
  {
    title: 'Metodo dichiarato per intero',
    body: 'Pubblichiamo periodo, dimensione del campione e cosa non è attribuibile ad Ambrogio. Un numero senza metodo non è una prova.',
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
      <SiteHeader />
      <main id="main">
        <section className="section">
          <div className="container">
            <div
              className="stack stack-4"
              style={{ maxWidth: '720px', marginBottom: 'var(--space-12)' }}
            >
              <span className="badge">Case study</span>
              <h1 className="display text-balance">Nessun case study pubblicato. Non ancora.</h1>
              <p className="lead text-pretty">
                Ambrogio.ai è in beta con i primi studi pilota. Non abbiamo ancora risultati
                misurati su un periodo abbastanza lungo da poter essere pubblicati come prova, e
                preferiamo dirlo invece di riempire questa pagina di numeri plausibili.
              </p>
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
            >
              {COMMITMENTS.map((commitment) => (
                <article key={commitment.title} className="card card-padded stack stack-3">
                  <h2 style={{ fontSize: 'var(--text-lg)' }}>{commitment.title}</h2>
                  <p style={{ color: 'var(--color-text-secondary)' }}>{commitment.body}</p>
                </article>
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
              <h3>Nel frattempo, puoi verificare il prodotto da solo</h3>
              <p className="muted" style={{ maxWidth: '56ch' }}>
                Il codice è pubblico con licenza MIT: puoi leggerlo, installarlo e provarlo senza
                chiedere il permesso a nessuno. È la forma di prova che possiamo offrire oggi.
              </p>
              <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <a
                  href="https://github.com/Hiberius/whatsapp-receptionist"
                  className="btn btn-primary"
                  rel="noreferrer"
                >
                  Vedi il codice su GitHub
                </a>
                <Link href="/contact" className="btn btn-secondary">
                  Partecipa al programma pilota
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
