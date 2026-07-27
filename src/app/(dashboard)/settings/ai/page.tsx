import type { Metadata } from 'next';
import Link from 'next/link';

import { AiPromptForm, type AiPromptSettingsView } from '@/components/settings/AiPromptForm';
import { requireSession, type AuthSession } from '@/lib/auth/session';
import { logger } from '@/lib/logging/logger';
import { createAiPromptSettingsService } from '@/server/ai/prompt-settings';

export const metadata: Metadata = {
  title: 'Personalita AI · Impostazioni · Ambrogio.ai',
};

// Lo stato dipende dalla sessione: non deve finire in cache statica.
export const dynamic = 'force-dynamic';

type LoadResult =
  | { readonly ok: true; readonly settings: AiPromptSettingsView }
  | { readonly ok: false };

async function loadSettings(session: AuthSession): Promise<LoadResult> {
  try {
    const settings = await createAiPromptSettingsService().getSettings({ session });
    return { ok: true, settings };
  } catch (error) {
    // Il layout ha gia' garantito la sessione: un errore qui viene dal datastore.
    // Meglio una pagina in stato degradato che un 500 sull'intera schermata.
    logger.error({ err: error, tenantId: session.tenantId }, 'Lettura prompt AI fallita');
    return { ok: false };
  }
}

export default async function AiSettingsPage() {
  const session = await requireSession();
  const result = await loadSettings(session);

  return (
    <>
      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">
            <Link href="/settings" className="btn-link">
              Impostazioni
            </Link>{' '}
            / AI
          </span>
          <h1>Personalita dell&apos;assistente</h1>
          <p className="muted">
            Decidi come parla Ambrogio ai tuoi clienti. Le regole di sicurezza e il formato della
            risposta restano nostri: puoi leggerli qui sotto, ma non sovrascriverli.
          </p>
        </div>
      </div>

      {result.ok ? (
        <AiPromptForm
          settings={result.settings}
          canManage={session.role === 'owner' || session.role === 'admin'}
        />
      ) : (
        <section className="card stack stack-3">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Configurazione non leggibile</h2>
          <p className="muted">
            Non siamo riusciti a recuperare la personalita configurata. Non significa che sia stata
            persa: e la lettura ad aver fallito, e le risposte continuano a usare l&apos;ultima
            versione attiva. Ricarica tra poco, e se il problema resta scrivici dalla pagina
            contatti.
          </p>
          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <Link href="/settings/ai" className="btn btn-secondary btn-sm">
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
