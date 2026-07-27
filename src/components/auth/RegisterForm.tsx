'use client';

import { FormFeedback } from '@/components/forms/FormFeedback';
import { useApiForm } from '@/components/forms/useApiForm';

const VERTICALS = [
  { value: 'dental', label: 'Studio dentistico' },
  { value: 'beauty', label: 'Centro estetico / SPA' },
  { value: 'fitness', label: 'Palestra / personal trainer' },
  { value: 'professional', label: 'Studio professionale' },
  { value: 'other', label: 'Altro' },
] as const;

export function RegisterForm() {
  const { state, onSubmit } = useApiForm({
    endpoint: '/api/auth/sign-up',
    successMessage:
      'Account creato. Ti abbiamo inviato un link di accesso via email: aprilo per completare la configurazione.',
  });

  const isSubmitting = state.status === 'submitting';

  return (
    <form onSubmit={onSubmit} className="stack stack-4" noValidate>
      <FormFeedback state={state} id="register-form-errors" />

      <div className="field">
        <label htmlFor="business_name" className="label">
          Nome studio o azienda
        </label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          autoComplete="organization"
          required
          minLength={2}
          maxLength={120}
          placeholder="Studio Dentistico Rossi"
          className="input"
          disabled={isSubmitting}
        />
      </div>

      <div className="field">
        <label htmlFor="email" className="label">
          Email di lavoro
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
          placeholder="info@studio.it"
          className="input"
          aria-describedby="register-email-helper"
          disabled={isSubmitting}
        />
        <p className="helper" id="register-email-helper">
          Useremo questa email per l&apos;account principale del tenant.
        </p>
      </div>

      <div className="field">
        <label htmlFor="vertical" className="label">
          Settore
        </label>
        <select
          id="vertical"
          name="vertical"
          required
          className="select"
          defaultValue=""
          disabled={isSubmitting}
        >
          <option value="" disabled>
            Seleziona il settore
          </option>
          {VERTICALS.map((vertical) => (
            <option key={vertical.value} value={vertical.value}>
              {vertical.label}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn btn-primary btn-lg" disabled={isSubmitting}>
        {isSubmitting ? 'Creazione in corso…' : 'Crea account'}
      </button>
    </form>
  );
}
