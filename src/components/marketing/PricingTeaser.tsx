import Link from 'next/link';

const PLANS = [
  {
    name: 'Starter',
    price: '€97',
    period: '/mese',
    badge: 'Per studi singoli',
    description: 'Un solo numero WhatsApp, 1 calendario, 500 conversazioni AI/mese.',
    features: [
      '1 numero WhatsApp Business',
      '1 calendario Google',
      '500 conversazioni AI / mese',
      'Trascrizione vocali',
      'Dashboard base',
    ],
    cta: 'Inizia con Starter',
    href: '/register?plan=starter',
    highlight: false,
  },
  {
    name: 'Professional',
    price: '€297',
    period: '/mese',
    badge: 'Più popolare',
    description: 'Multi-operatore, voce in uscita, integrazioni avanzate, supporto prioritario.',
    features: [
      'Fino a 3 numeri WhatsApp',
      'Multi-calendario operatore',
      '2.500 conversazioni AI / mese',
      'Voce ElevenLabs in uscita',
      'Reminder automatici',
      'Knowledge base custom',
      'Supporto prioritario',
    ],
    cta: 'Inizia con Professional',
    href: '/register?plan=professional',
    highlight: true,
  },
  {
    name: 'Agency',
    price: '€897',
    period: '/mese',
    badge: 'White-label',
    description: 'Per agenzie e consulenti che gestiscono più clienti finali.',
    features: [
      '5 clienti inclusi',
      'White-label dashboard',
      'API e webhook',
      'Conversazioni illimitate*',
      'Account manager dedicato',
      'Onboarding co-gestito',
    ],
    cta: 'Parliamone',
    href: '/contact?plan=agency',
    highlight: false,
  },
] as const;

export function PricingTeaser() {
  return (
    <section className="section" aria-labelledby="pricing-heading">
      <div className="container stack stack-12">
        <div className="stack stack-4" style={{ maxWidth: '52ch' }}>
          <span className="eyebrow">Piani trasparenti</span>
          <h2 id="pricing-heading" className="text-balance">
            Paghi solo quando Ambrogio fa il suo lavoro.
          </h2>
          <p className="lead">
            Niente costi nascosti, niente moltiplicatori sui token. Sai esattamente quanto spendi al
            mese e quanto guadagni in più.
          </p>
        </div>

        <div
          className="grid stagger-children"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
        >
          {PLANS.map((plan, index) => (
            <article
              key={plan.name}
              className={`card card-padded stack stack-6 plan-card ${plan.highlight ? 'plan-card-featured' : ''}`}
              style={{ '--i': index } as React.CSSProperties}
            >
              {plan.highlight ? (
                <span
                  className="badge"
                  style={{
                    position: 'absolute',
                    top: '-14px',
                    right: 'var(--space-6)',
                    background: 'var(--color-accent)',
                    color: 'var(--color-accent-fg)',
                  }}
                >
                  {plan.badge}
                </span>
              ) : (
                <span className="badge badge-neutral">{plan.badge}</span>
              )}
              <div className="stack stack-2">
                <h3 style={{ fontSize: 'var(--text-2xl)' }}>{plan.name}</h3>
                <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-1)' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-4xl)',
                      fontWeight: 700,
                      letterSpacing: 'var(--tracking-tight)',
                    }}
                  >
                    {plan.price}
                  </span>
                  <span className="muted">{plan.period}</span>
                </div>
                <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                  {plan.description}
                </p>
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                {plan.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        color: 'var(--color-accent)',
                        marginTop: '2px',
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`btn ${plan.highlight ? 'btn-primary' : 'btn-secondary'} btn-lg plan-card-actions`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>

        <p
          className="muted text-center"
          style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-4)' }}
        >
          Tutti i prezzi escludono IVA. Pagamento mensile o annuale (-20%). Fatturazione elettronica
          SDI inclusa.
        </p>
      </div>
    </section>
  );
}
