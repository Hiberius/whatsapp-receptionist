'use client';

import { FormFeedback } from '@/components/forms/FormFeedback';
import { useApiForm } from '@/components/forms/useApiForm';

export function LoginForm() {
  const { state, onSubmit } = useApiForm({
    endpoint: '/api/auth/magic-link',
    successMessage:
      'Se l’indirizzo è associato a un account, riceverai un link di accesso entro pochi istanti. Controlla anche lo spam.',
  });

  return (
    <form onSubmit={onSubmit} className="stack stack-4" noValidate>
      <FormFeedback state={state} id="login-form-errors" />

      <div className="field">
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="tu@studio.it"
          className="input"
          aria-describedby="login-email-helper"
          disabled={state.status === 'submitting'}
        />
        <p className="helper" id="login-email-helper">
          Ti invieremo un link sicuro che scade dopo 10 minuti.
        </p>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={state.status === 'submitting'}
      >
        {state.status === 'submitting' ? 'Invio in corso…' : 'Invia link di accesso'}
      </button>
    </form>
  );
}
