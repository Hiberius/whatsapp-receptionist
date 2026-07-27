import type { Metadata } from 'next';
import Link from 'next/link';

import {
  buildBreadcrumbSchema,
  buildPersonSchema,
  buildWebPageSchema,
  JsonLd,
  organizationSchema,
} from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://ambrogio.ai';

export const metadata: Metadata = {
  title: 'Chi siamo · Storia, missione e team',
  description:
    'Ambrogio.ai è costruito da operatori di studi reali. Missione, valori, team e perché esistiamo: ridare il telefono alla vita.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'Chi siamo · Ambrogio.ai',
    description:
      'Ambrogio.ai è costruito da operatori di studi reali. Missione, valori, team italiano.',
    url: '/about',
    type: 'profile',
    locale: 'it_IT',
  },
};

const FOUNDERS = [
  {
    name: 'Christian Calabrò',
    jobTitle: 'Founder & CEO',
    description:
      'Performance marketer e dev. 12 anni di esperienza tra cliniche, palestre e studi professionali. Ha gestito reception reali prima di scrivere una sola riga di codice.',
    sameAs: ['https://twitter.com/ambrogio_ai', 'https://linkedin.com/in/christian-calabro'],
  },
] as const;

const VALUES = [
  {
    title: 'Privacy non negoziabile',
    body: 'Server EU, redact PII automatico, DPA pronto. La conformità non è un add-on: è il primo commit.',
  },
  {
    title: 'AI utile, non spettacolare',
    body: 'Niente prompt magici, niente chatbot finti. Modelli che capiscono il tuo settore e si fanno aiutare quando serve.',
  },
  {
    title: 'Prezzi trasparenti',
    body: 'Niente moltiplicatori sui token, niente upsell. Sai cosa paghi e quanto guadagni in più ogni mese.',
  },
  {
    title: 'Costruito sul campo',
    body: 'Ogni feature nasce da un cliente che ce l’ha chiesta. Niente roadmap a tavolino.',
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Chi siamo', url: '/about' },
        ])}
      />
      {FOUNDERS.map((person) => (
        <JsonLd
          key={person.name}
          data={buildPersonSchema({
            name: person.name,
            jobTitle: person.jobTitle,
            description: person.description,
            sameAs: person.sameAs,
            url: `${SITE_URL}/about`,
          })}
        />
      ))}
      <JsonLd
        data={buildWebPageSchema({
          type: 'AboutPage',
          name: 'Chi siamo · Ambrogio.ai',
          description:
            'Ambrogio.ai è costruito da operatori di studi reali. Missione, valori, team italiano.',
          url: '/about',
          speakableSelectors: ['h1', '.lead', '#story-heading + p'],
        })}
      />
      {/*
        Nessuno schema `Review` pubblicato: le recensioni vanno esposte come dati
        strutturati solo quando sono reali, firmate dal cliente e verificabili.
      */}
      <SiteHeader />
      <main id="main">
        <section className="section">
          <div className="container-narrow stack stack-12">
            <header className="stack stack-4">
              <span className="badge">Chi siamo</span>
              <h1 className="display text-balance">
                Costruito da chi ha gestito reception vere, non da chi le ha studiate.
              </h1>
              <p className="lead text-pretty">
                Ambrogio.ai nasce nel 2026 con una missione semplice: ridare il telefono alla vita.
                Le cliniche, le palestre, gli studi professionali italiani non hanno bisogno di un
                altro chatbot. Hanno bisogno di un assistente che capisce, prende appuntamenti veri
                e libera tempo umano per quello che conta.
              </p>
            </header>

            <section className="stack stack-6" aria-labelledby="story-heading">
              <h2 id="story-heading">La nostra storia</h2>
              <p>
                Il punto di partenza è un problema che chiunque abbia gestito uno studio conosce: le
                chiamate che arrivano quando non c&apos;è nessuno a rispondere. Fuori orario, in
                pausa pranzo, mentre si è con un cliente. Chi chiama raramente richiama: cerca
                altrove. Il centralino tradizionale non risolve, perché registra un messaggio invece
                di prendere un appuntamento.
              </p>
              <p>
                Ambrogio nasce per chiudere quel divario: un assistente che conversa su WhatsApp
                nella lingua in cui scrivono i clienti, consulta la disponibilità reale
                sull&apos;agenda e fissa l&apos;appuntamento. Abbiamo scelto di svilupparlo in open
                source con licenza MIT perché le PMI italiane meritano AI di qualità, in italiano e
                conforme al GDPR, senza dipendere da una scatola chiusa di cui non possono
                verificare il funzionamento.
              </p>
              <p>
                Oggi Ambrogio.ai è in beta privata con i primi 50 studi pilota selezionati. Vogliamo
                crescere lentamente per restare onesti.
              </p>
            </section>

            <section className="stack stack-6" aria-labelledby="values-heading">
              <h2 id="values-heading">I nostri valori</h2>
              <div
                className="grid"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
              >
                {VALUES.map((value) => (
                  <article key={value.title} className="card stack stack-3">
                    <h3 style={{ fontSize: 'var(--text-lg)' }}>{value.title}</h3>
                    <p style={{ color: 'var(--color-text-secondary)' }}>{value.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="stack stack-6" aria-labelledby="team-heading">
              <h2 id="team-heading">Il team</h2>
              <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
                {FOUNDERS.map((person) => (
                  <article key={person.name} className="card card-padded stack stack-3">
                    <span className="eyebrow">{person.jobTitle}</span>
                    <h3 style={{ fontSize: 'var(--text-2xl)' }}>{person.name}</h3>
                    <p style={{ color: 'var(--color-text-secondary)' }}>{person.description}</p>
                    <div className="row" style={{ gap: 'var(--space-3)' }}>
                      {person.sameAs.map((url) => (
                        <a
                          key={url}
                          href={url}
                          rel="noopener noreferrer me"
                          target="_blank"
                          className="btn-link"
                          style={{ fontSize: 'var(--text-sm)' }}
                        >
                          {url.includes('linkedin') ? 'LinkedIn' : 'Twitter / X'}
                        </a>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="stack stack-4" aria-labelledby="contact-heading">
              <h2 id="contact-heading">Vuoi parlare con noi?</h2>
              <address
                className="card stack stack-2"
                style={{
                  fontStyle: 'normal',
                  background: 'var(--color-surface-sunken)',
                }}
              >
                <p>
                  <strong>Ambrogio.ai</strong>
                  <br />
                  Roma, Italia
                  <br />
                  <a href="mailto:hello@ambrogio.ai" className="btn-link">
                    hello@ambrogio.ai
                  </a>{' '}
                  · Sales &amp; partnership
                </p>
                <p>
                  <a href="mailto:support@ambrogio.ai" className="btn-link">
                    support@ambrogio.ai
                  </a>{' '}
                  · Supporto tecnico
                </p>
                <p>
                  <a href="mailto:dpo@ambrogio.ai" className="btn-link">
                    dpo@ambrogio.ai
                  </a>{' '}
                  · Data Protection Officer
                </p>
              </address>
              <div className="row" style={{ gap: 'var(--space-3)' }}>
                <Link href="/contact" className="btn btn-primary">
                  Contattaci
                </Link>
                <Link href="/legal/privacy" className="btn btn-secondary">
                  Privacy policy
                </Link>
              </div>
            </section>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
