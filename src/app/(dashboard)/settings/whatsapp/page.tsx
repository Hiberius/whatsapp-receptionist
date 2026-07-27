import type { Metadata } from 'next';
import Link from 'next/link';

import {
  WhatsAppConnectionForm,
  type WhatsAppConnectionView,
} from '@/components/settings/WhatsAppConnectionForm';
import { requireSession } from '@/lib/auth/session';
import { logger } from '@/lib/logging/logger';
import { createWhatsAppProvisioningService } from '@/server/whatsapp/provisioning';

export const metadata: Metadata = {
  title: 'WhatsApp Business · Impostazioni · Ambrogio.ai',
};

// Lo stato dipende dalla sessione: non deve finire in cache statica.
export const dynamic = 'force-dynamic';

type LoadResult =
  | { readonly ok: true; readonly status: WhatsAppConnectionView }
  | { readonly ok: false };

async function loadStatus(tenantId: string): Promise<LoadResult> {
  try {
    const service = createWhatsAppProvisioningService();
    return { ok: true, status: await service.getStatus(tenantId) };
  } catch (error) {
    // Il layout ha già garantito la sessione: un errore qui è del datastore,
    // e vale la pena mostrare la pagina in stato degradato invece di un 500.
    logger.error({ err: error, tenantId }, 'Lettura stato integrazione WhatsApp fallita');
    return { ok: false };
  }
}

export default async function WhatsAppSettingsPage() {
  const session = await requireSession();
  const result = await loadStatus(session.tenantId);

  return (
    <>
      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">
            <Link href="/settings" className="btn-link">
              Impostazioni
            </Link>{' '}
            / Integrazioni
          </span>
          <h1>WhatsApp Business</h1>
          <p className="muted">
            Collega il numero del tuo studio: da quel momento Ambrogio legge e risponde ai messaggi
            in arrivo su questo canale.
          </p>
        </div>
      </div>

      {result.ok ? (
        <WhatsAppConnectionForm
          status={result.status}
          canManage={session.role === 'owner' || session.role === 'admin'}
        />
      ) : (
        <section className="card stack stack-3">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Stato non leggibile</h2>
          <p className="muted">
            Non siamo riusciti a recuperare la configurazione del canale. Non significa che il
            numero sia stato scollegato: è solo la lettura ad aver fallito. Ricarica tra poco, e se
            il problema resta scrivici dalla pagina contatti.
          </p>
          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <Link href="/settings/whatsapp" className="btn btn-secondary btn-sm">
              Riprova
            </Link>
            <Link href="/contact" className="btn btn-ghost btn-sm">
              Contatta il supporto
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
