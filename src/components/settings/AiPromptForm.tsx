'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { FormFeedback } from '@/components/forms/FormFeedback';
import { useApiForm, type ApiFormState } from '@/components/forms/useApiForm';

const ENDPOINT = '/api/ai-prompts';

/**
 * Proiezioni client dei tipi di `@/server/ai/prompt-settings`.
 *
 * Sono ridichiarate qui e non importate perche' quel modulo istanzia il client
 * Supabase con la service role key: anche un import di solo tipo lo trascina
 * nel grafo del bundle client. I campi sono un sottoinsieme, quindi il Server
 * Component puo' passare il risultato del servizio senza adattarlo.
 */
export interface AiPromptSectionView {
  readonly key: string;
  readonly title: string;
  readonly lines: readonly string[];
}

export interface AiPromptVersionView {
  readonly id: string;
  readonly version: number;
  readonly promptText: string;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface AiPromptSettingsView {
  readonly assistantName: string;
  readonly defaultPersona: string;
  readonly activeVersion: AiPromptVersionView | null;
  readonly versions: readonly AiPromptVersionView[];
  readonly immutableSections: readonly AiPromptSectionView[];
  /** System prompt completo, con la personalita attiva gia composta nei blocchi. */
  readonly composedPreview: string;
  readonly limits: {
    readonly minLength: number;
    readonly maxLength: number;
  };
}

interface AiPromptFormProps {
  readonly settings: AiPromptSettingsView;
  /** Solo owner e admin possono scrivere: l'API rifiuta gli altri con 403. */
  readonly canManage: boolean;
}

const IDLE: ApiFormState = { status: 'idle', message: null };

export function AiPromptForm({ settings, canManage }: AiPromptFormProps) {
  const router = useRouter();
  const currentPersona = settings.activeVersion?.promptText ?? settings.defaultPersona;
  const [persona, setPersona] = useState(currentPersona);
  const [restoreState, setRestoreState] = useState<ApiFormState>(IDLE);
  const [pendingVersionId, setPendingVersionId] = useState<string | null>(null);

  const { state, onSubmit } = useApiForm({
    endpoint: ENDPOINT,
    successMessage: 'Personalita pubblicata. La versione precedente resta consultabile qui sotto.',
    buildBody: (formData) => ({
      action: 'publish',
      promptText: String(formData.get('promptText') ?? ''),
    }),
  });

  // Dopo una scrittura riuscita la cronologia e la versione attiva sono
  // cambiate lato server: senza refresh la pagina descrive lo stato di prima.
  const shouldRefresh = state.status === 'success' || restoreState.status === 'success';
  useEffect(() => {
    if (shouldRefresh) {
      router.refresh();
    }
  }, [shouldRefresh, router]);

  // `useApiForm` chiama `form.reset()` al successo: il textarea controllato
  // deve tornare in pari con quanto e' stato appena pubblicato.
  useEffect(() => {
    setPersona(currentPersona);
  }, [currentPersona]);

  const onRestore = useCallback(async (versionId: string): Promise<void> => {
    setPendingVersionId(versionId);
    setRestoreState({ status: 'submitting', message: null });

    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'activate', versionId }),
      });
    } catch {
      setPendingVersionId(null);
      setRestoreState({
        status: 'error',
        message: 'Connessione non riuscita. Controlla la rete e riprova.',
      });
      return;
    }

    setPendingVersionId(null);

    if (!response.ok) {
      setRestoreState({ status: 'error', message: await readErrorMessage(response) });
      return;
    }

    setRestoreState({
      status: 'success',
      message: 'Versione ripristinata. Ambrogio risponde di nuovo con questo testo.',
    });
  }, []);

  const isSubmitting = state.status === 'submitting';
  const isRestoring = restoreState.status === 'submitting';
  const personaLength = persona.trim().length;
  const isTooShort = personaLength < settings.limits.minLength;

  return (
    <div className="stack stack-6">
      <section className="card stack stack-4">
        <div className="row-between" style={{ gap: 'var(--space-4)' }}>
          <div className="stack stack-2">
            <span className="eyebrow">Stato</span>
            <h2 style={{ fontSize: 'var(--text-xl)' }}>
              {settings.activeVersion
                ? `Personalita personalizzata, versione ${settings.activeVersion.version}`
                : 'Personalita di default'}
            </h2>
          </div>
          <span className={settings.activeVersion ? 'badge badge-success' : 'badge badge-neutral'}>
            {settings.activeVersion ? 'Personalizzata' : 'Default'}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          {settings.activeVersion
            ? `Pubblicata il ${formatDate(settings.activeVersion.createdAt)}.`
            : `Nessuna versione pubblicata: ${settings.assistantName} usa il testo di default, che trovi gia compilato qui sotto.`}
        </p>
      </section>

      <section className="card stack stack-4">
        <div className="stack stack-2">
          <span className="eyebrow">Perimetro</span>
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Cosa non puoi cambiare</h2>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Il testo che scrivi viene inserito <em>tra</em> questi due blocchi, non al loro posto.
            Restano attivi anche se il tuo testo chiede di ignorarli.
          </p>
        </div>

        {settings.immutableSections.map((section) => (
          <div key={section.key} className="stack stack-2">
            <h3 className="mono" style={{ fontSize: 'var(--text-sm)' }}>
              {section.title}
            </h3>
            <ul
              className="stack stack-1"
              style={{
                listStyle: 'none',
                padding: 'var(--space-3) var(--space-4)',
                margin: 0,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-sunken)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {section.lines.map((line) => (
                <li key={line} className="muted">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <details className="stack stack-2">
          <summary style={{ cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
            Mostra il prompt completo che riceve il modello
          </summary>
          <pre
            className="mono"
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface-sunken)',
              fontSize: 'var(--text-xs)',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
              margin: 0,
            }}
          >
            {settings.composedPreview}
          </pre>
        </details>
      </section>

      {canManage ? (
        <form onSubmit={onSubmit} className="card stack stack-6" noValidate>
          <div className="stack stack-2">
            <h2 style={{ fontSize: 'var(--text-xl)' }}>Personalita e tono</h2>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              Come si presenta {settings.assistantName}, che registro usa, cosa mette in evidenza.
              Ogni salvataggio crea una nuova versione e disattiva la precedente, che resta
              ripristinabile.
            </p>
          </div>

          <FormFeedback state={state} id="ai-prompt-publish-feedback" />

          <div className="field">
            <label htmlFor="promptText" className="label">
              Testo della personalita
            </label>
            <textarea
              id="promptText"
              name="promptText"
              className="textarea"
              rows={12}
              required
              minLength={settings.limits.minLength}
              maxLength={settings.limits.maxLength}
              spellCheck
              value={persona}
              onChange={(event) => setPersona(event.target.value)}
              aria-describedby="promptText-help"
              disabled={isSubmitting}
            />
            <p id="promptText-help" className="helper">
              {personaLength} / {settings.limits.maxLength} caratteri. Minimo{' '}
              {settings.limits.minLength}. Scrivi istruzioni, non esempi di risposta: il modello le
              applica a ogni messaggio.
            </p>
          </div>

          <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || isTooShort || persona.trim() === currentPersona.trim()}
            >
              {isSubmitting ? 'Pubblicazione…' : 'Pubblica nuova versione'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPersona(settings.defaultPersona)}
              disabled={isSubmitting}
            >
              Riporta al testo di default
            </button>
          </div>
        </form>
      ) : (
        <p className="helper">
          Solo il titolare dell&apos;account e gli amministratori possono modificare la personalita
          dell&apos;assistente.
        </p>
      )}

      <section className="card stack stack-4">
        <div className="stack stack-2">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Versioni</h2>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Se una modifica peggiora le risposte, riattiva la versione precedente: il testo non
            viene riscritto, cambia solo quale versione e attiva.
          </p>
        </div>

        <FormFeedback state={restoreState} id="ai-prompt-restore-feedback" />

        {settings.versions.length === 0 ? (
          <p className="helper">
            Nessuna versione pubblicata. La cronologia inizia dal primo salvataggio.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack stack-3">
            {settings.versions.map((version) => (
              <li
                key={version.id}
                className="stack stack-2"
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-sunken)',
                }}
              >
                <div className="row-between" style={{ gap: 'var(--space-4)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                    Versione {version.version} · {formatDate(version.createdAt)}
                  </span>
                  {version.active ? (
                    <span className="badge badge-success">Attiva</span>
                  ) : canManage ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => void onRestore(version.id)}
                      disabled={isRestoring}
                    >
                      {pendingVersionId === version.id ? 'Ripristino…' : 'Ripristina'}
                    </button>
                  ) : null}
                </div>
                <p
                  className="muted"
                  style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', margin: 0 }}
                >
                  {version.promptText}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'data non disponibile';
  }

  return parsed.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/** L'envelope d'errore di `jsonHandler` e' `{ ok: false, error: { code, message } }`. */
async function readErrorMessage(response: Response): Promise<string> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const code = readErrorField(payload, 'code');

  if (code === 'forbidden') {
    return 'Non hai i permessi per modificare la personalita dell’assistente.';
  }

  if (code === 'rate_limited') {
    return 'Troppi tentativi ravvicinati. Riprova tra qualche minuto.';
  }

  if (code === 'unauthorized') {
    return 'Sessione non valida. Effettua di nuovo l’accesso.';
  }

  if (code === 'not_found') {
    return 'Questa versione non esiste piu. Ricarica la pagina.';
  }

  const exposed = readErrorField(payload, 'message');
  if (exposed !== null && exposed !== 'Internal server error') {
    return exposed;
  }

  return 'Non siamo riusciti a ripristinare la versione. Riprova tra poco.';
}

function readErrorField(payload: unknown, field: 'code' | 'message'): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : null;
}
