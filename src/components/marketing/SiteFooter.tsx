import Link from 'next/link';

const FOOTER_COLUMNS = [
  {
    title: 'Prodotto',
    links: [
      { href: '/#features', label: 'Funzionalità' },
      { href: '/pricing', label: 'Piani e prezzi' },
      { href: '/verticali/dental', label: 'Per dentisti' },
      { href: '/verticali/beauty', label: 'Per centri estetici' },
      { href: '/verticali/fitness', label: 'Per palestre e PT' },
      { href: '/verticali/professional', label: 'Studi professionali' },
    ],
  },
  {
    title: 'Risorse',
    links: [
      { href: '/case-studies', label: 'Case study' },
      { href: '/blog', label: 'Blog' },
      { href: '/changelog', label: 'Changelog' },
      { href: '/docs', label: 'Documentazione' },
      { href: '/help', label: 'Centro assistenza' },
    ],
  },
  {
    title: 'Azienda',
    links: [
      { href: '/about', label: 'Chi siamo' },
      { href: '/contact', label: 'Contatti' },
      { href: '/status', label: 'Stato del servizio' },
    ],
  },
  {
    title: 'Legale',
    links: [
      { href: '/legal/privacy', label: 'Privacy policy' },
      { href: '/legal/terms', label: 'Termini' },
      { href: '/legal/dpa', label: 'DPA' },
      { href: '/legal/cookie', label: 'Cookie policy' },
      { href: '/legal/security', label: 'Sicurezza' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col stack stack-3">
            <Link href="/" className="site-logo">
              Ambrogio<span style={{ color: 'var(--color-accent)' }}>.ai</span>
            </Link>
            <p className="muted" style={{ fontSize: 'var(--text-sm)', maxWidth: '36ch' }}>
              Reception AI sempre attivo per PMI italiane. WhatsApp, voce, prenotazioni automatiche
              e ROI misurabile.
            </p>
            <div
              className="row"
              style={{ gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}
              data-testid="trust-badges"
            >
              <span className="badge badge-success" data-trust="hosted-eu">
                Hosted EU
              </span>
              <span className="badge badge-neutral" data-trust="gdpr">
                GDPR ready
              </span>
              <span className="badge badge-neutral" data-trust="italian">
                Made in Italia
              </span>
            </div>
            <address
              className="muted"
              style={{
                fontSize: 'var(--text-xs)',
                fontStyle: 'normal',
                lineHeight: 'var(--leading-relaxed)',
                marginTop: 'var(--space-3)',
              }}
            >
              Ambrogio.ai · Roma, Italia
              <br />
              <a href="mailto:hello@ambrogio.ai" style={{ color: 'var(--color-text-secondary)' }}>
                hello@ambrogio.ai
              </a>
            </address>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <div className="footer-col" key={column.title}>
              <h4>{column.title}</h4>
              {column.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <hr className="divider" />
        <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            © {new Date().getFullYear()} Ambrogio.ai — Made with care in Italia.
          </p>
          <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            v0.1.0 ·{' '}
            <Link href="/status" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
              <span className="sr-only">Stato del servizio: </span>
              <span aria-hidden="true">● </span>
              Operativo
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
