import Link from 'next/link';

export function CtaSection() {
  return (
    <section className="section" aria-labelledby="cta-heading">
      <div className="container">
        <div
          className="card card-padded stack stack-6 text-center cta-card"
          style={{
            padding: 'clamp(2.5rem, 4vw + 1rem, 4.5rem)',
            alignItems: 'center',
          }}
        >
          <span
            className="hero-eyebrow"
            style={{
              background: 'transparent',
              borderColor: 'var(--color-accent-fg)',
              color: 'var(--color-accent-fg)',
            }}
          >
            Beta Italia · Posti limitati
          </span>
          <h2
            id="cta-heading"
            className="text-balance"
            style={{
              fontSize: 'var(--text-4xl)',
              color: 'inherit',
              maxWidth: '24ch',
              margin: '0 auto',
            }}
          >
            Spegni il telefono. Lavora meglio. Guadagna di più.
          </h2>
          <p
            className="lead text-pretty"
            style={{
              color: 'oklch(95% 0.005 150)',
              maxWidth: '54ch',
              margin: '0 auto',
            }}
          >
            I primi 50 studi ricevono onboarding co-gestito gratuito (€500 di valore) e prezzo beta
            congelato per 12 mesi.
          </p>
          <div className="row" style={{ gap: 'var(--space-3)', justifyContent: 'center' }}>
            <Link
              href="/register"
              className="btn btn-lg"
              style={{
                background: 'var(--color-accent-fg)',
                color: 'var(--color-accent)',
              }}
            >
              Richiedi accesso beta
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/pricing"
              className="btn btn-lg"
              style={{
                background: 'transparent',
                color: 'var(--color-accent-fg)',
                borderColor: 'var(--color-accent-fg)',
              }}
            >
              Vedi i piani
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
