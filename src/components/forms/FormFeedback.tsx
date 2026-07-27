'use client';

import { type ApiFormState } from './useApiForm';

/**
 * Regione live che comunica l'esito dell'invio.
 *
 * Prima esisteva un `<div role="status" aria-live="polite" className="sr-only" />`
 * in ognuna delle pagine con form, ma i componenti erano Server Component senza
 * stato: la regione non veniva mai popolata. Era accessibilità apparente —
 * l'attributo c'era, l'annuncio no.
 *
 * `role="alert"` sugli errori li fa annunciare con priorità assertiva; il
 * successo resta `polite` per non interrompere la lettura in corso.
 */
export function FormFeedback({ state, id }: { state: ApiFormState; id: string }) {
  const isError = state.status === 'error';

  return (
    <div
      id={id}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={state.message === null ? 'sr-only' : undefined}
      style={
        state.message === null
          ? undefined
          : {
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              background: isError ? 'var(--color-danger-soft)' : 'var(--color-success-soft)',
              color: isError ? 'var(--color-danger)' : 'var(--color-success)',
            }
      }
    >
      {state.message}
    </div>
  );
}
