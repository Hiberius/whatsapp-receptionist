import type { Metadata } from 'next';
import Link from 'next/link';

import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildProductOffersSchema,
  buildSpeakableSchema,
  JsonLd,
} from '@/components/marketing/JsonLd';
import { PricingTeaser } from '@/components/marketing/PricingTeaser';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

export const metadata: Metadata = {
  title: 'Prezzi Reception AI Italia',
  description:
    'Tre piani trasparenti per ogni grandezza di studio. Trial 14 giorni senza carta. Fatturazione elettronica SDI inclusa.',
  openGraph: {
    title: 'Prezzi Reception AI Italia · Ambrogio.ai',
    description: 'Starter €97, Professional €297, Agency €897. Trial 14 giorni senza carta.',
    url: '/pricing',
    locale: 'it_IT',
    type: 'website',
  },
  alternates: {
    canonical: '/pricing',
  },
};

const FAQ = [
  {
    q: 'Posso provare gratis?',
    a: 'Sì. 14 giorni di trial completo senza carta di credito. Cancelli con un click se non ti convince.',
  },
  {
    q: 'Cosa succede se supero il limite di conversazioni?',
    a: 'Ti avvisiamo quando arrivi al 80%. Puoi attivare il top-up automatico oppure passare al piano superiore — la transizione è istantanea, niente nuovo onboarding.',
  },
  {
    q: 'Le fatture sono elettroniche SDI?',
    a: 'Sì, fatturazione elettronica B2B inclusa in tutti i piani. Ti basterà inserire il tuo Codice Destinatario o PEC durante l’onboarding.',
  },
  {
    q: 'I dati dove sono ospitati?',
    a: 'Tutto in EU (Supabase Frankfurt + Vercel EU). Niente trasferimenti extra-UE per dati di chat e clienti.',
  },
  {
    q: 'Posso cambiare piano in corsa?',
    a: 'Quando vuoi. L’upgrade è immediato, il downgrade decorre dal ciclo successivo.',
  },
  {
    q: 'Cosa significa Agency white-label?',
    a: 'Brand tuo, dominio tuo, logo tuo. I tuoi clienti vedono solo te. Tu gestisci tutto da un’unica console multi-tenant.',
  },
  {
    q: 'E se Ambrogio sbaglia? Sono coperto?',
    a: 'Tutte le risposte AI sono tracciate e revisionabili. Sotto soglia di confidenza Ambrogio fa escalation umana automaticamente. SLA con responsabilità definita nei termini di servizio.',
  },
  {
    q: 'I miei clienti capiscono che è un bot?',
    a: 'Personalizzi tu il tono. Puoi essere trasparente ("Sono Ambrogio, l\'assistente AI") oppure lasciare il nome del tuo studio. La voce ElevenLabs è realistica.',
  },
] as const;

const PLAN_OFFERS = [
  {
    name: 'Starter',
    price: '97',
    description: 'Un solo numero WhatsApp, 1 calendario, 500 conversazioni AI/mese.',
    url: '/register?plan=starter',
  },
  {
    name: 'Professional',
    price: '297',
    description: 'Multi-operatore, voce in uscita, integrazioni avanzate, supporto prioritario.',
    url: '/register?plan=professional',
  },
  {
    name: 'Agency',
    price: '897',
    description: 'Per agenzie e consulenti che gestiscono più clienti finali. White-label.',
    url: '/contact?plan=agency',
  },
] as const;

const VERTICAL_LINKS = [
  { slug: 'dental', label: 'Reception AI per studi dentistici' },
  { slug: 'beauty', label: 'Reception AI per centri estetici' },
  { slug: 'fitness', label: 'Reception AI per palestre e PT' },
  { slug: 'professional', label: 'Reception AI per studi professionali' },
] as const;

export default async function PricingPage() {
  return (
    <>
      <JsonLd data={buildFaqSchema(FAQ)} />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Piani e prezzi', url: '/pricing' },
        ])}
      />
      <JsonLd data={buildProductOffersSchema(PLAN_OFFERS)} />
      <JsonLd
        data={buildSpeakableSchema({
          url: '/pricing',
          cssSelector: ['#faq-heading', '[data-speakable="faq"]'],
        })}
      />
      <SiteHeader />
      <main id="main">
        <section
          className="section"
          style={{
            paddingTop: 'clamp(3rem, 4vw + 1rem, 5rem)',
            paddingBottom: 'clamp(2rem, 2vw, 3rem)',
          }}
        >
          <div
            className="container stack stack-6 text-center"
            style={{ maxWidth: '720px', margin: '0 auto' }}
          >
            <span className="badge">Trasparenza totale</span>
            <h1 className="display text-balance">
              Prezzi pensati per studi reali, non per startup VC.
            </h1>
            <p className="lead text-pretty" style={{ margin: '0 auto' }}>
              Nessun moltiplicatore sui token. Nessun upsell aggressivo. Sai esattamente cosa paghi
              e quanto guadagni in più ogni mese.
            </p>
          </div>
        </section>

        <PricingTeaser />

        <section className="section section-divider" aria-labelledby="faq-heading">
          <div className="container stack stack-12">
            <div className="stack stack-3" style={{ maxWidth: '52ch' }}>
              <span className="eyebrow">Domande frequenti</span>
              <h2 id="faq-heading">Le risposte alle domande più comuni</h2>
            </div>

            <div
              className="grid"
              data-speakable="faq"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
            >
              {FAQ.map((item) => (
                <article key={item.q} className="card stack stack-3">
                  <h3 style={{ fontSize: 'var(--text-lg)' }}>{item.q}</h3>
                  <p style={{ color: 'var(--color-text-secondary)' }}>{item.a}</p>
                </article>
              ))}
            </div>

            <div className="card stack stack-3" style={{ background: 'var(--color-surface)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)' }}>
                Vuoi vedere come funziona nel tuo settore?
              </h3>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Ogni piano include il modello pre-addestrato sul tuo verticale. Vedi i casi
                d&apos;uso completi:
              </p>
              <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                {VERTICAL_LINKS.map((v) => (
                  <Link key={v.slug} href={`/verticali/${v.slug}`} className="btn-link">
                    {v.label} →
                  </Link>
                ))}
              </div>
            </div>

            <div
              className="card card-padded stack stack-4 text-center"
              style={{
                background: 'var(--color-surface-sunken)',
                borderColor: 'var(--color-border)',
                alignItems: 'center',
              }}
            >
              <h3>Hai bisogno di un piano custom?</h3>
              <p className="muted" style={{ maxWidth: '50ch' }}>
                Studi grandi, catene, gruppi medico-sanitari, agenzie con più di 10 clienti.
                Costruiamo insieme un&apos;offerta dedicata.
              </p>
              <Link href="/contact?plan=enterprise" className="btn btn-primary">
                Parla con noi
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
