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
  title: 'Documentazione tecnica',
  description:
    'Guide tecniche, integrazioni, webhook e API reference per Ambrogio.ai. Tutto per sviluppatori e agenzie.',
  alternates: { canonical: '/docs' },
  openGraph: {
    title: 'Documentazione Ambrogio.ai',
    description: 'Guide tecniche, integrazioni e API reference per sviluppatori.',
    url: '/docs',
    type: 'website',
    locale: 'it_IT',
  },
};

interface DocItem {
  label: string;
  href: string;
}

interface DocSection {
  title: string;
  items: ReadonlyArray<DocItem>;
}

const SECTIONS: ReadonlyArray<DocSection> = [
  {
    title: 'Guide rapide',
    items: [
      {
        label: 'Setup numero WhatsApp Business',
        href: '/help/articles/come-collegare-il-numero-whatsapp-business',
      },
      {
        label: 'Connessione Google Calendar',
        href: '/help/articles/come-autorizzare-google-calendar',
      },
      { label: 'Caricamento listino servizi', href: '/help/articles/caricare-il-listino-servizi' },
      { label: 'Configurazione orari', href: '/help/articles/configurare-gli-orari-di-apertura' },
    ],
  },
  {
    title: 'AI e booking',
    items: [
      { label: 'Filtro AI e classificazione', href: '/help/articles/come-funziona-il-filtro-ai' },
      { label: 'Quando interviene un umano', href: '/help/articles/quando-interviene-un-umano' },
      {
        label: 'Prenotazione appuntamenti',
        href: '/help/articles/come-ambrogio-prenota-appuntamenti',
      },
      { label: 'Reminder automatici', href: '/help/articles/reminder-automatici' },
    ],
  },
  {
    title: 'Account e GDPR',
    items: [
      { label: 'Cambio piano', href: '/help/articles/cambiare-piano' },
      { label: 'Fatturazione SDI', href: '/help/articles/scaricare-fatture-elettroniche-sdi' },
      { label: 'Esportazione dati GDPR', href: '/help/articles/esportare-i-miei-dati-gdpr' },
      { label: 'Cancellazione account', href: '/help/articles/cancellare-account' },
    ],
  },
];

export default function DocsPage() {
  const allItems = SECTIONS.flatMap((s) => s.items);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Documentazione', url: '/docs' },
        ])}
      />
      <JsonLd
        data={buildCollectionPageSchema({
          name: 'Documentazione Ambrogio.ai',
          description: 'Guide tecniche, integrazioni e API reference.',
          url: '/docs',
          hasPart: allItems.map((it) => ({ name: it.label, url: it.href })),
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
              <span className="badge">Documentazione</span>
              <h1 className="display text-balance">
                Tutto quello che serve per integrare Ambrogio.
              </h1>
              <p className="lead text-pretty">
                Guide pratiche, esempi di codice e best practice. Per studi che vogliono capire come
                funziona Ambrogio sotto il cofano.
              </p>
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
            >
              {SECTIONS.map((section) => (
                <article key={section.title} className="card card-padded stack stack-4">
                  <h2 style={{ fontSize: 'var(--text-xl)' }}>{section.title}</h2>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                    }}
                  >
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="btn-link"
                          style={{ fontSize: 'var(--text-sm)' }}
                        >
                          → {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
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
              <h3>API Reference (in arrivo)</h3>
              <p className="muted" style={{ maxWidth: '50ch' }}>
                La documentazione API completa con webhook, SDK e esempi sarà disponibile per i
                clienti Professional e Agency entro Q3 2026.
              </p>
              <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Link href="/help" className="btn btn-secondary">
                  Centro assistenza
                </Link>
                <Link href="/contact?topic=docs" className="btn btn-primary">
                  Richiedi accesso anticipato
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
