import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Accedi · Ambrogio.ai',
  description: 'Accedi al tuo account Ambrogio.ai',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="stack stack-6">
      <div className="stack stack-2">
        <h1 style={{ fontSize: 'var(--text-3xl)' }}>Bentornato</h1>
        <p className="muted">
          Inserisci la tua email e ti mandiamo un link sicuro per accedere. Niente password da
          ricordare.
        </p>
      </div>

      <form action="/api/auth/magic-link" method="POST" className="stack stack-4">
        <div role="status" aria-live="polite" id="login-form-errors" className="sr-only" />

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
          />
          <p className="helper">Ti invieremo un link sicuro che scade dopo 10 minuti.</p>
        </div>

        <button type="submit" className="btn btn-primary btn-lg">
          Invia link di accesso
        </button>
      </form>

      <div
        className="stack stack-3"
        style={{
          paddingTop: 'var(--space-6)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Non hai ancora un account?{' '}
          <Link href="/register" className="btn-link">
            Crea il tuo studio
          </Link>
        </p>
        <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          Cliccando su &quot;Invia link&quot; accetti i{' '}
          <Link href="/legal/terms" className="btn-link">
            termini di servizio
          </Link>{' '}
          e la{' '}
          <Link href="/legal/privacy" className="btn-link">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
