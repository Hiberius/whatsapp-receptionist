import Link from 'next/link';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/conversations', label: 'Conversazioni' },
  { href: '/settings', label: 'Impostazioni' },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="app-shell">
      <header className="panel" style={{ borderRadius: 0 }}>
        <nav
          aria-label="Navigazione principale"
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: 16,
            justifyContent: 'space-between',
            width: 'min(1120px, calc(100vw - 48px))',
            margin: '0 auto',
          }}
        >
          <Link href="/dashboard" style={{ fontWeight: 700 }}>
            Ambrogio.ai
          </Link>
          <div style={{ display: 'flex', gap: 12 }}>
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <div className="page-frame">{children}</div>
    </div>
  );
}
