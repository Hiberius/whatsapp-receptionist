import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { requireSessionOrRedirect } from '@/lib/auth/guards';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Il layout è il punto di controllo dell'intera area autenticata: qualunque
 * pagina sotto `(dashboard)` passa di qui, quindi una nuova schermata nasce già
 * protetta senza doversene ricordare. Il middleware non può assolvere a questo
 * compito: si occupa solo di CSP e non conosce la sessione Supabase.
 */
export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireSessionOrRedirect();

  return <DashboardShell>{children}</DashboardShell>;
}
