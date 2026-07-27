'use client';

import { FormFeedback } from '@/components/forms/FormFeedback';
import { useApiForm } from '@/components/forms/useApiForm';

const TOPICS = [
  { value: 'sales', label: 'Voglio provare Ambrogio' },
  { value: 'support', label: 'Ho bisogno di supporto' },
  { value: 'agency', label: "Sono un'agenzia / partner" },
  { value: 'press', label: 'Stampa / media' },
  { value: 'other', label: 'Altro' },
] as const;

export function ContactForm() {
  const { state, onSubmit } = useApiForm({
    endpoint: '/api/contact',
    successMessage: 'Messaggio inviato. Ti rispondiamo entro un giorno lavorativo.',
    buildBody: (formData) => ({
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      // Lo schema accetta `null`, non la stringa vuota che il form invierebbe.
      company: formData.get('company') ? String(formData.get('company')) : null,
      topic: String(formData.get('topic') ?? ''),
      message: String(formData.get('message') ?? ''),
      // Una checkbox invia la stringa "on"; lo schema pretende `z.literal(true)`.
      consent: formData.get('consent') === 'on',
    }),
  });

  const isSubmitting = state.status === 'submitting';

  return (
    <form onSubmit={onSubmit} className="card card-padded stack stack-5" noValidate>
      <FormFeedback state={state} id="contact-form-errors" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-4)',
        }}
      >
        <div className="field">
          <label htmlFor="name" className="label">
            Nome
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={120}
            autoComplete="name"
            className="input"
            placeholder="Mario Rossi"
            disabled={isSubmitting}
          />
        </div>
        <div className="field">
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            className="input"
            placeholder="mario@studio.it"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="company" className="label">
          Studio o azienda
        </label>
        <input
          id="company"
          name="company"
          type="text"
          maxLength={160}
          autoComplete="organization"
          className="input"
          disabled={isSubmitting}
        />
      </div>

      <div className="field">
        <label htmlFor="topic" className="label">
          Di cosa vuoi parlare?
        </label>
        <select
          id="topic"
          name="topic"
          required
          className="select"
          defaultValue=""
          disabled={isSubmitting}
        >
          <option value="" disabled>
            Seleziona
          </option>
          {TOPICS.map((topic) => (
            <option key={topic.value} value={topic.value}>
              {topic.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="message" className="label">
          Messaggio
        </label>
        <textarea
          id="message"
          name="message"
          required
          maxLength={5000}
          rows={6}
          className="textarea"
          placeholder="Raccontaci."
          disabled={isSubmitting}
        />
      </div>

      <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'flex-start' }}>
        <input id="consent" name="consent" type="checkbox" required disabled={isSubmitting} />
        <label
          htmlFor="consent"
          className="muted"
          style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5 }}
        >
          Acconsento al trattamento dei dati per finalità di contatto come descritto nella{' '}
          <a href="/legal/privacy" className="btn-link">
            privacy policy
          </a>
          .
        </label>
      </div>

      <button type="submit" className="btn btn-primary btn-lg" disabled={isSubmitting}>
        {isSubmitting ? 'Invio in corso…' : 'Invia messaggio'}
      </button>
    </form>
  );
}
