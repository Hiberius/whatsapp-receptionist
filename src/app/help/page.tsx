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
  title: 'Centro assistenza',
  description:
    'Trova guide passo-passo, FAQ e contatti diretti per setup WhatsApp, Google Calendar, fatturazione SDI e GDPR della tua reception AI Italia.',
  alternates: { canonical: '/help' },
  openGraph: {
    title: 'Centro assistenza Ambrogio.ai',
    description: 'Guide pratiche, FAQ e contatti diretti per la tua reception AI Italia.',
    url: '/help',
    type: 'website',
    locale: 'it_IT',
  },
};

interface HelpItem {
  label: string;
  slug: string;
}

interface HelpTopic {
  title: string;
  items: ReadonlyArray<HelpItem>;
}

const TOPICS: ReadonlyArray<HelpTopic> = [
  {
    title: 'Setup e onboarding',
    items: [
      {
        label: 'Come collegare il numero WhatsApp Business',
        slug: 'come-collegare-il-numero-whatsapp-business',
      },
      { label: 'Come autorizzare Google Calendar', slug: 'come-autorizzare-google-calendar' },
      { label: 'Caricare il listino servizi', slug: 'caricare-il-listino-servizi' },
      { label: 'Configurare gli orari di apertura', slug: 'configurare-gli-orari-di-apertura' },
    ],
  },
  {
    title: 'Conversazioni',
    items: [
      { label: 'Come funziona il filtro AI', slug: 'come-funziona-il-filtro-ai' },
      { label: 'Quando interviene un umano', slug: 'quando-interviene-un-umano' },
      { label: 'Gestire vocali e media', slug: 'gestire-vocali-e-media' },
      { label: 'Risposte rapide preconfezionate', slug: 'risposte-rapide-preconfezionate' },
    ],
  },
  {
    title: 'Calendario e booking',
    items: [
      { label: 'Come Ambrogio prenota appuntamenti', slug: 'come-ambrogio-prenota-appuntamenti' },
      { label: 'Gestire conflitti calendario', slug: 'gestire-conflitti-calendario' },
      { label: 'Reminder automatici', slug: 'reminder-automatici' },
      { label: 'Gestire le disdette', slug: 'gestire-le-disdette' },
    ],
  },
  {
    title: 'Account e fatturazione',
    items: [
      { label: 'Cambiare piano', slug: 'cambiare-piano' },
      { label: 'Scaricare fatture elettroniche SDI', slug: 'scaricare-fatture-elettroniche-sdi' },
      { label: 'Aggiornare dati P.IVA', slug: 'aggiornare-dati-piva' },
      { label: 'Esportare i miei dati (GDPR)', slug: 'esportare-i-miei-dati-gdpr' },
      { label: 'Cancellare account', slug: 'cancellare-account' },
    ],
  },
] as const;

export default async function HelpPage() {
  const allItems = TOPICS.flatMap((topic) => topic.items);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Centro assistenza', url: '/help' },
        ])}
      />
      <JsonLd
        data={buildCollectionPageSchema({
          name: 'Centro assistenza Ambrogio.ai',
          description: 'Guide pratiche, FAQ e tutorial per usare Ambrogio.',
          url: '/help',
          hasPart: allItems.map((it) => ({
            name: it.label,
            url: `/help/articles/${it.slug}`,
          })),
        })}
      />
      <SiteHeader />
      <main id="main">
        <section className="section">
          <div className="container">
            <div
              className="stack stack-4 text-center"
              style={{ maxWidth: '720px', margin: '0 auto var(--space-12)' }}
            >
              <span className="badge">Centro assistenza</span>
              <h1 className="display text-balance">Come possiamo aiutarti?</h1>
              <p className="lead text-pretty" style={{ margin: '0 auto' }}>
                Guide, FAQ e canali diretti. Risposta entro 4 ore lavorative per Starter, 1 ora per
                Professional, immediata per Agency.
              </p>
              <div className="row" style={{ justifyContent: 'center', gap: 'var(--space-3)' }}>
                <label htmlFor="help-search" className="sr-only">
                  Cerca nel centro assistenza
                </label>
                <input
                  id="help-search"
                  type="search"
                  placeholder="Cerca una guida o domanda"
                  className="input"
                  style={{ maxWidth: '420px' }}
                />
                <button type="button" className="btn btn-primary">
                  Cerca
                </button>
              </div>
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
            >
              {TOPICS.map((topic) => (
                <article key={topic.title} className="card stack stack-4">
                  <h2 style={{ fontSize: 'var(--text-xl)' }}>{topic.title}</h2>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-2)',
                    }}
                  >
                    {topic.items.map((item) => (
                      <li key={item.slug}>
                        <Link
                          href={`/help/articles/${item.slug}`}
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
          </div>
        </section>

        <section
          className="section section-divider"
          style={{ background: 'var(--color-surface-sunken)' }}
        >
          <div className="container">
            <div
              className="stack stack-6 text-center"
              style={{ maxWidth: '640px', margin: '0 auto' }}
            >
              <h2>Non hai trovato quello che cercavi?</h2>
              <p className="muted text-pretty">
                Contattaci direttamente. Rispondiamo entro 4 ore lavorative.
              </p>
              <div className="row" style={{ justifyContent: 'center', gap: 'var(--space-3)' }}>
                <Link href="/contact" className="btn btn-primary btn-lg">
                  Apri un ticket
                </Link>
                <Link href="/status" className="btn btn-secondary btn-lg">
                  Status del servizio
                </Link>
              </div>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Email diretta:{' '}
                <a href="mailto:support@ambrogio.ai" className="btn-link">
                  support@ambrogio.ai
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
