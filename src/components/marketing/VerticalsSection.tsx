import Image from 'next/image';
import Link from 'next/link';

const VERTICALS = [
  {
    slug: 'dental',
    title: 'Studi dentistici',
    body: 'Igiene, urgenze, controlli. Gestisce richiami semestrali e capisce quando serve la dottoressa.',
    icon: '/assets/site-images/ambrogio/svg/06-vertical-dental.svg',
    accent: 'oklch(45% 0.12 175)',
  },
  {
    slug: 'beauty',
    title: 'Centri estetici',
    body: 'Trattamenti, pacchetti, gift card. Ogni servizio ha il suo tempo e il suo prezzo, Ambrogio li sa.',
    icon: '/assets/site-images/ambrogio/svg/07-vertical-beauty.svg',
    accent: 'oklch(60% 0.13 350)',
  },
  {
    slug: 'fitness',
    title: 'Palestre e personal trainer',
    body: 'Lezioni di gruppo, slot PT, abbonamenti. Riduce gli abbandoni con reminder umani.',
    icon: '/assets/site-images/ambrogio/svg/08-vertical-fitness.svg',
    accent: 'oklch(55% 0.15 30)',
  },
  {
    slug: 'professional',
    title: 'Studi professionali',
    body: 'Avvocati, commercialisti, consulenti. Filtra le richieste, capisce le priorità, fissa gli incontri.',
    icon: '/assets/site-images/ambrogio/svg/09-vertical-professional-office.svg',
    accent: 'oklch(50% 0.10 250)',
  },
] as const;

export function VerticalsSection() {
  return (
    <section className="section section-divider" aria-labelledby="verticals-heading">
      <div className="container stack stack-12">
        <div className="stack stack-4" style={{ maxWidth: '52ch' }}>
          <span className="eyebrow">Verticali</span>
          <h2 id="verticals-heading" className="text-balance">
            Quattro mestieri, una stessa promessa: nessun cliente perso.
          </h2>
          <p className="lead">
            Ambrogio capisce il linguaggio del tuo settore. Conosce i servizi, i tempi, le urgenze.
            Nessuna risposta robotica.
          </p>
        </div>

        <div className="feature-grid stagger-children">
          {VERTICALS.map((v, index) => (
            <Link
              key={v.slug}
              href={`/verticali/${v.slug}`}
              className="card card-interactive stack stack-4 vertical-card"
              style={
                {
                  textDecoration: 'none',
                  color: 'inherit',
                  '--vertical-accent': v.accent,
                  '--i': index,
                } as React.CSSProperties
              }
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <div className="vertical-icon-tile feature-icon-tile" aria-hidden="true">
                  <Image src={v.icon} alt="" width={36} height={36} />
                </div>
                <h3 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>{v.title}</h3>
              </div>
              <p style={{ color: 'var(--color-text-secondary)' }}>{v.body}</p>
              <span
                className="row plan-card-actions"
                style={{
                  gap: 'var(--space-2)',
                  color: v.accent,
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                }}
              >
                Scopri il caso d&apos;uso <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
