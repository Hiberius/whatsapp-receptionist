import Image from 'next/image';

const STEPS = [
  {
    n: '01',
    title: 'Connetti i canali',
    body: 'Numero WhatsApp Business, Google Calendar, Stripe per i pagamenti. 15 minuti per ogni integrazione.',
  },
  {
    n: '02',
    title: 'Insegna il tuo studio',
    body: 'Carica il listino, gli orari, le FAQ. Ambrogio impara come parli e capisce le richieste reali.',
  },
  {
    n: '03',
    title: 'Spegni il telefono',
    body: 'O lascialo squillare se vuoi: Ambrogio risponde a chi chiede, prenota, conferma. Tu fai il tuo lavoro.',
  },
] as const;

export function HowItWorksSection() {
  return (
    <section
      className="section section-divider"
      id="how-it-works"
      aria-labelledby="how-heading"
      style={{ background: 'var(--color-surface-sunken)' }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 'var(--space-16)',
            alignItems: 'center',
          }}
        >
          <div className="stack stack-4" style={{ maxWidth: '52ch' }}>
            <span className="eyebrow">Come funziona</span>
            <h2 id="how-heading" className="text-balance">
              Tre passi. Una giornata. Reception sempre attiva.
            </h2>
            <p className="lead">
              Onboarding guidato: rispondi a poche domande, carica i tuoi servizi, autorizza Google
              Calendar. Ambrogio è operativo entro fine giornata.
            </p>
          </div>

          <ol
            className="grid stagger-children"
            style={{
              listStyle: 'none',
              padding: 0,
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            }}
          >
            {STEPS.map((step, index) => (
              <li
                key={step.n}
                className="card card-padded stack stack-4 step-card"
                style={
                  {
                    background: 'var(--color-surface)',
                    '--i': index,
                  } as React.CSSProperties
                }
              >
                <span className="step-number" aria-hidden="true">
                  {step.n}
                </span>
                <h3 style={{ fontSize: 'var(--text-xl)' }}>{step.title}</h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>{step.body}</p>
              </li>
            ))}
          </ol>

          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              padding: 'var(--space-8)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <Image
              src="/assets/site-images/ambrogio/svg/13-onboarding-three-steps.svg"
              alt="Onboarding in tre step: connetti, insegna, attiva"
              width={720}
              height={360}
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
