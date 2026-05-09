import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  JsonLd,
} from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

export const metadata: Metadata = {
  title: 'Verticali · Settori coperti da Ambrogio.ai',
  description:
    'Studi dentistici, centri estetici, palestre, studi professionali. Una reception AI tarata sul tuo settore con prompt e flussi dedicati.',
  alternates: { canonical: '/verticali' },
  openGraph: {
    title: 'Verticali coperti da Ambrogio.ai',
    description: 'Quattro settori, una piattaforma. Reception AI tarata sul tuo mestiere.',
    url: '/verticali',
    type: 'website',
    locale: 'it_IT',
  },
};

const VERTICALS = [
  {
    slug: 'dental',
    title: 'Studi dentistici',
    body: 'Igiene, urgenze, controlli, ortodonzia. Ambrogio capisce la differenza tra mal di denti e una richiesta di preventivo.',
    icon: '/assets/site-images/ambrogio/svg/06-vertical-dental.svg',
    benefits: ['Filtra le urgenze vere', 'Richiami semestrali automatici', 'Pre-anamnesi via chat'],
  },
  {
    slug: 'beauty',
    title: 'Centri estetici e SPA',
    body: 'Trattamenti, pacchetti, gift card. Ogni servizio ha il suo tempo, il suo costo, il suo materiale.',
    icon: '/assets/site-images/ambrogio/svg/07-vertical-beauty.svg',
    benefits: ['Listino dinamico', 'Promozioni stagionali', 'Gift card e abbonamenti'],
  },
  {
    slug: 'fitness',
    title: 'Palestre e personal trainer',
    body: 'Lezioni di gruppo, slot PT, abbonamenti, corsi a numero chiuso. Riduce gli abbandoni con reminder umani.',
    icon: '/assets/site-images/ambrogio/svg/08-vertical-fitness.svg',
    benefits: ['Calendario lezioni', 'Lista d’attesa intelligente', 'Reminder pre-lezione'],
  },
  {
    slug: 'professional',
    title: 'Studi professionali',
    body: 'Avvocati, commercialisti, consulenti. Filtra le richieste, qualifica i lead, fissa solo gli incontri che valgono.',
    icon: '/assets/site-images/ambrogio/svg/09-vertical-professional-office.svg',
    benefits: ['Qualifica lead', 'Pre-briefing automatico', 'Confidentiality first'],
  },
] as const;

export default async function VerticalsIndexPage() {
  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Verticali', url: '/verticali' },
        ])}
      />
      <JsonLd
        data={buildCollectionPageSchema({
          name: 'Verticali coperti da Ambrogio.ai',
          description: 'Quattro settori, prompt e flussi dedicati per ognuno.',
          url: '/verticali',
          hasPart: VERTICALS.map((v) => ({ name: v.title, url: `/verticali/${v.slug}` })),
        })}
      />
      <SiteHeader />
      <main id="main">
        <section
          className="section"
          style={{
            paddingTop: 'clamp(3rem, 4vw + 1rem, 5rem)',
            paddingBottom: 'var(--space-section)',
          }}
        >
          <div className="container">
            <div
              className="stack stack-4 text-center"
              style={{ maxWidth: '720px', margin: '0 auto var(--space-12)' }}
            >
              <span className="badge">4 verticali, 1 piattaforma</span>
              <h1 className="display text-balance">
                Ogni settore parla la sua lingua. Ambrogio la conosce.
              </h1>
              <p className="lead text-pretty" style={{ margin: '0 auto' }}>
                Niente AI generica. Modelli, prompt e flussi tarati su come si parla davvero in ogni
                mestiere.
              </p>
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
            >
              {VERTICALS.map((v) => (
                <Link
                  key={v.slug}
                  href={`/verticali/${v.slug}`}
                  className="card card-padded card-interactive stack stack-4"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="feature-icon-tile" aria-hidden="true">
                    <Image src={v.icon} alt="" width={40} height={40} />
                  </div>
                  <h2 style={{ fontSize: 'var(--text-2xl)' }}>{v.title}</h2>
                  <p style={{ color: 'var(--color-text-secondary)' }}>{v.body}</p>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                    }}
                  >
                    {v.benefits.map((b) => (
                      <li
                        key={b}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <span
                    className="row plan-card-actions"
                    style={{
                      gap: 'var(--space-2)',
                      color: 'var(--color-accent)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                    }}
                  >
                    Vedi caso d&apos;uso completo <span aria-hidden="true">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
