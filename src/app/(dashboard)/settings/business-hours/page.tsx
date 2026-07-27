import type { Metadata } from 'next';
import Link from 'next/link';

import { BusinessHoursForm } from '@/components/settings/BusinessHoursForm';
import { type BusinessHourView } from '@/components/settings/business-hours-model';
import { requireSession, type AuthSession } from '@/lib/auth/session';
import { logger } from '@/lib/logging/logger';
import { createTenantSettingsService } from '@/server/settings/tenant-settings';

export const metadata: Metadata = {
  title: 'Orari di apertura · Impostazioni · Ambrogio.ai',
};

// Gli orari dipendono dalla sessione: non devono finire in cache statica.
export const dynamic = 'force-dynamic';

type LoadResult =
  | { readonly ok: true; readonly hours: readonly BusinessHourView[] }
  | { readonly ok: false };

async function loadHours(session: AuthSession): Promise<LoadResult> {
  try {
    const service = createTenantSettingsService();
    const hours = await service.listBusinessHours({ session });

    return {
      ok: true,
      // Al client passiamo solo i campi che l'editor usa davvero.
      hours: hours.map((hour) => ({
        id: hour.id,
        weekday: hour.weekday,
        opensAt: hour.opensAt,
        closesAt: hour.closesAt,
        active: hour.active,
      })),
    };
  } catch (error) {
    // Il layout ha già garantito la sessione: un errore qui viene dal datastore.
    logger.error({ err: error, tenantId: session.tenantId }, 'Lettura orari di apertura fallita');
    return { ok: false };
  }
}

export default async function BusinessHoursSettingsPage() {
  const session = await requireSession();
  const result = await loadHours(session);

  return (
    <>
      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">
            <Link href="/settings" className="btn-link">
              Impostazioni
            </Link>{' '}
            / Studio
          </span>
          <h1>Orari di apertura</h1>
          <p className="muted">
            Sono i dati con cui Ambrogio calcola la disponibilità. Un errore qui si traduce in
            appuntamenti fissati quando lo studio è chiuso.
          </p>
        </div>
      </div>

      {result.ok ? (
        <BusinessHoursForm
          hours={result.hours}
          canManage={session.role === 'owner' || session.role === 'admin'}
        />
      ) : (
        <section className="card stack stack-3">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Orari non leggibili</h2>
          <p className="muted">
            Non siamo riusciti a recuperare gli orari salvati. Non significa che siano stati persi:
            è la lettura ad aver fallito. Ricarica tra poco, e se il problema resta scrivici dalla
            pagina contatti.
          </p>
          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <Link href="/settings/business-hours" className="btn btn-secondary btn-sm">
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
