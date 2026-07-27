'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ChangeEvent } from 'react';

import { FormFeedback } from '@/components/forms/FormFeedback';
import { useApiForm } from '@/components/forms/useApiForm';

/**
 * Limite del body testuale WhatsApp. Rispecchia `WHATSAPP_TEXT_MAX_LENGTH` in
 * `src/server/conversations/operator-messages.ts`: quel modulo è server-only
 * (importa `node:crypto` e il client Supabase admin) e non va importato qui.
 */
const WHATSAPP_TEXT_MAX_LENGTH = 4096;

interface OperatorReplyFormProps {
  readonly conversationId: string;
  /** Motivo per cui l'invio è bloccato, oppure `null` se è consentito. */
  readonly disabledReason: string | null;
}

/**
 * Invio manuale di un messaggio da parte dell'operatore.
 *
 * I vincoli (ruolo, canale, opt-out, finestra 24h) sono già valutati lato
 * server: qui vengono solo mostrati in anticipo, perché l'operatore sappia
 * prima di scrivere se il messaggio può partire. La route rivaluta comunque
 * tutto al POST.
 */
export function OperatorReplyForm({ conversationId, disabledReason }: OperatorReplyFormProps) {
  const router = useRouter();
  const [length, setLength] = useState(0);

  const { state, onSubmit } = useApiForm({
    endpoint: `/api/conversations/${conversationId}/messages`,
    successMessage: 'Messaggio accodato. Comparirà nella cronologia appena il worker lo invia.',
    buildBody: (formData) => ({ content: String(formData.get('content') ?? '') }),
  });

  useEffect(() => {
    if (state.status !== 'success') {
      return;
    }

    // `useApiForm` resetta il form ma non lo stato locale, e la cronologia è
    // renderizzata dal server: serve un refresh per vedere il messaggio.
    setLength(0);
    router.refresh();
  }, [state.status, router]);

  const isBlocked = disabledReason !== null;
  const isSubmitting = state.status === 'submitting';
  const isDisabled = isBlocked || isSubmitting;

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    setLength(event.currentTarget.value.length);
  }

  return (
    <form onSubmit={onSubmit} className="card card-padded stack stack-4" noValidate>
      <FormFeedback state={state} id={`operator-reply-feedback-${conversationId}`} />

      {isBlocked ? (
        <p
          id={`operator-reply-blocked-${conversationId}`}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            background: 'var(--color-warning-soft)',
            color: 'var(--color-warning)',
          }}
        >
          {disabledReason}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor={`operator-reply-${conversationId}`} className="label">
          Messaggio
        </label>
        <textarea
          id={`operator-reply-${conversationId}`}
          name="content"
          rows={4}
          required
          maxLength={WHATSAPP_TEXT_MAX_LENGTH}
          className="textarea"
          placeholder="Scrivi la risposta che il cliente riceverà su WhatsApp."
          disabled={isDisabled}
          onChange={handleChange}
          aria-describedby={
            isBlocked
              ? `operator-reply-blocked-${conversationId}`
              : `operator-reply-helper-${conversationId}`
          }
        />
        <p id={`operator-reply-helper-${conversationId}`} className="helper">
          {length}/{WHATSAPP_TEXT_MAX_LENGTH} caratteri. Il messaggio resta registrato nella
          cronologia come inviato da operatore.
        </p>
      </div>

      <div className="row-between" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          L’invio viene accodato e parte dal numero WhatsApp collegato.
        </span>
        <button type="submit" className="btn btn-primary" disabled={isDisabled || length === 0}>
          {isSubmitting ? 'Invio in corso…' : 'Invia messaggio'}
        </button>
      </div>
    </form>
  );
}
