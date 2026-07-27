'use client';

import { FormFeedback } from '@/components/forms/FormFeedback';
import { useApiForm } from '@/components/forms/useApiForm';

interface Option {
  readonly value: string;
  readonly label: string;
}

interface OnboardingFormProps {
  readonly verticals: readonly Option[];
  readonly timezones: readonly Option[];
  readonly prefilledBusinessName: string;
  readonly prefilledVertical: string;
}

export function OnboardingForm({
  verticals,
  timezones,
  prefilledBusinessName,
  prefilledVertical,
}: OnboardingFormProps) {
  const { state, onSubmit } = useApiForm({
    endpoint: '/api/onboarding/tenant',
    successMessage: 'Studio configurato.',
    redirectTo: '/dashboard',
    // I nomi dei campi del form non coincidono con lo schema dell'API
    // (`business_name` → `tenantName`, `vertical` → `businessType`): la
    // mappatura va fatta qui, esplicitamente, altrimenti la validazione Zod
    // `.strict()` rifiuta il payload.
    buildBody: (formData) => ({
      tenantName: String(formData.get('business_name') ?? ''),
      businessType: formData.get('vertical') ? String(formData.get('vertical')) : null,
      timezone: String(formData.get('timezone') ?? 'Europe/Rome'),
    }),
  });

  const isSubmitting = state.status === 'submitting';

  return (
    <form onSubmit={onSubmit} className="stack stack-5" noValidate>
      <FormFeedback state={state} id="onboarding-form-errors" />

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
          defaultValue={prefilledBusinessName}
          disabled={isSubmitting}
        />
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
          defaultValue={prefilledVertical}
          disabled={isSubmitting}
        >
          <option value="" disabled>
            Seleziona il settore
          </option>
          {verticals.map((vertical) => (
            <option key={vertical.value} value={vertical.value}>
              {vertical.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="timezone" className="label">
          Fuso orario
        </label>
        <select
          id="timezone"
          name="timezone"
          required
          className="select"
          defaultValue="Europe/Rome"
          disabled={isSubmitting}
        >
          {timezones.map((timezone) => (
            <option key={timezone.value} value={timezone.value}>
              {timezone.label}
            </option>
          ))}
        </select>
      </div>

      <p
        className="helper"
        style={{
          background: 'var(--color-accent-soft)',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <strong>P.IVA e codice SDI</strong> li chiediamo dopo, alla prima fattura. Adesso bastano i
        dati base: 30 secondi.
      </p>

      <div className="row" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        <button type="submit" className="btn btn-primary btn-lg" disabled={isSubmitting}>
          {isSubmitting ? 'Salvataggio…' : 'Continua →'}
        </button>
      </div>
    </form>
  );
}
