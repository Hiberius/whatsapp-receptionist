import Image from 'next/image';
import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="container hero-grid">
        <div className="stack stack-6 animate-fade-up">
          <span className="hero-eyebrow">
            <span aria-hidden="true">●</span> Beta Italia · Posti limitati
          </span>
          <h1 id="hero-heading" className="display text-balance">
            La tua reception AI risponde anche di notte. E prenota davvero.
          </h1>
          <p className="lead text-pretty">
            Ambrogio.ai è il receptionist AI sempre attivo che risponde su WhatsApp, gestisce voci e
            testi, prende appuntamenti sul tuo calendario e ti consegna ogni mattina la lista delle
            cose fatte mentre dormivi.
          </p>
          <div className="row" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <Link href="/register" className="btn btn-primary btn-lg">
              Inizia la prova
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/#how-it-works" className="btn btn-secondary btn-lg">
              Vedi come funziona
            </Link>
          </div>
          <div
            className="row"
            style={{
              gap: 'var(--space-8)',
              marginTop: 'var(--space-6)',
              paddingTop: 'var(--space-6)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <div className="stat">
              <span className="stat-value">24/7</span>
              <span className="stat-label">Sempre in ascolto</span>
            </div>
            <div className="stat">
              <span className="stat-value">EU</span>
              <span className="stat-label">Dati in Europa</span>
            </div>
            <div className="stat">
              <span className="stat-value">MIT</span>
              <span className="stat-label">Codice open source</span>
            </div>
          </div>
        </div>
        <div
          className="animate-fade-up"
          style={{ position: 'relative', minHeight: '420px', animationDelay: '120ms' }}
        >
          <Image
            src="/assets/site-images/ambrogio/svg/01-hero-always-on-reception.svg"
            alt="Illustrazione di una reception AI sempre attiva"
            width={640}
            height={520}
            priority
            style={{ width: '100%', height: 'auto', maxWidth: '640px', marginInline: 'auto' }}
          />
        </div>
      </div>
    </section>
  );
}
