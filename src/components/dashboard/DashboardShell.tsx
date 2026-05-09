import Link from 'next/link';
import type { ReactNode } from 'react';

const SIDEBAR_ITEMS = [
  { href: '/dashboard', label: 'Panoramica', icon: '◐' },
  { href: '/conversations', label: 'Conversazioni', icon: '✻' },
  { href: '/calendar', label: 'Calendario', icon: '◫' },
  { href: '/knowledge', label: 'Knowledge base', icon: '☰' },
  { href: '/settings', label: 'Impostazioni', icon: '⚙' },
  { href: '/billing', label: 'Fatturazione', icon: '€' },
] as const;

export interface DashboardShellProps {
  children: ReactNode;
  currentPath?: string;
  tenantName?: string;
}

export function DashboardShell({
  children,
  currentPath,
  tenantName = 'Il tuo studio',
}: Readonly<DashboardShellProps>) {
  return (
    <div className="dashboard-shell">
      <aside className="sidebar" aria-label="Navigazione dashboard">
        <Link
          href="/dashboard"
          className="site-logo"
          style={{ fontSize: 'var(--text-base)', display: 'block' }}
        >
          Ambrogio<span style={{ color: 'var(--color-accent)' }}>.ai</span>
        </Link>

        <div
          className="surface-flat"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            marginTop: 'var(--space-5)',
          }}
        >
          <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            Tenant attivo
          </p>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              marginTop: '2px',
            }}
          >
            {tenantName}
          </p>
        </div>

        <ul className="sidebar-nav">
          {SIDEBAR_ITEMS.map((item) => {
            const active = currentPath === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="sidebar-link"
                  aria-current={active ? 'page' : undefined}
                >
                  <span aria-hidden="true" style={{ width: '1.25rem' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div
          style={{
            position: 'absolute',
            bottom: 'var(--space-6)',
            left: 'var(--space-6)',
            right: 'var(--space-6)',
          }}
        >
          <Link href="/help" className="sidebar-link" style={{ fontSize: 'var(--text-xs)' }}>
            <span aria-hidden="true">?</span>
            Centro assistenza
          </Link>
        </div>
      </aside>

      <main className="dashboard-main" id="main">
        {children}
      </main>
    </div>
  );
}
