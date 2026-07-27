import Link from 'next/link';
import type { ReactNode } from 'react';

import { requireSuperAdminOrRedirect } from '@/lib/auth/guards';

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/tenants', label: 'Tenants' },
  { href: '/admin/users', label: 'Utenti' },
  { href: '/admin/billing', label: 'Billing' },
  { href: '/admin/audit', label: 'Audit log' },
  { href: '/admin/system', label: 'Sistema' },
] as const;

/**
 * Gate del pannello cross-tenant. Le singole pagine admin chiamavano già
 * `requireSuperAdmin`, ma il layout è la sede corretta del controllo: una
 * pagina aggiunta domani è protetta per costruzione, non per disciplina.
 */
export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireSuperAdminOrRedirect();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header
        style={{
          background: 'linear-gradient(135deg, oklch(20% 0.015 175), oklch(28% 0.05 175))',
          color: 'var(--color-accent-fg)',
          borderBottom: '2px solid var(--color-accent)',
        }}
      >
        <div
          className="container"
          style={{
            paddingBlock: 'var(--space-3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-6)',
          }}
        >
          <Link
            href="/admin"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 'var(--text-base)',
              letterSpacing: 'var(--tracking-tight)',
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <span
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-accent-fg)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 'var(--tracking-wider)',
                textTransform: 'uppercase',
              }}
            >
              Admin
            </span>
            Ambrogio.ai
          </Link>

          <nav aria-label="Admin nav">
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                display: 'flex',
                gap: 'var(--space-5)',
              }}
            >
              {ADMIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      color: 'oklch(85% 0.02 175)',
                      transition: 'color var(--duration-normal) var(--ease-out)',
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <Link
            href="/dashboard"
            className="btn btn-sm"
            style={{
              background: 'var(--color-accent-fg)',
              color: 'oklch(20% 0.015 175)',
              fontWeight: 600,
            }}
          >
            ← Esci da admin
          </Link>
        </div>
      </header>
      <main id="main" className="container" style={{ paddingBlock: 'var(--space-12)' }}>
        {children}
      </main>
    </div>
  );
}
