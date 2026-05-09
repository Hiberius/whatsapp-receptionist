import Link from 'next/link';

const NAV_LINKS = [
  { href: '/#features', label: 'Funzionalità' },
  { href: '/verticali', label: 'Verticali' },
  { href: '/pricing', label: 'Piani' },
  { href: '/blog', label: 'Blog' },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header" role="banner">
      <div className="container site-header-inner">
        <Link href="/" className="site-logo" aria-label="Ambrogio.ai - homepage">
          Ambrogio<span style={{ color: 'var(--color-accent)' }}>.ai</span>
        </Link>
        <nav aria-label="Navigazione principale">
          <ul className="site-nav">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="row site-header-actions" style={{ gap: 'var(--space-3)' }}>
          <Link
            href="/pricing"
            className="btn btn-ghost btn-sm site-header-mobile-link"
            aria-label="Apri menu (vai a pricing)"
          >
            Menu
          </Link>
          <Link href="/login" className="btn btn-ghost btn-sm">
            Accedi
          </Link>
          <Link href="/register" className="btn btn-primary btn-sm">
            Prova gratis
          </Link>
        </div>
      </div>
    </header>
  );
}
