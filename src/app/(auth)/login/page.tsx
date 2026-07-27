import type { Metadata } from 'next';
import Link from 'next/link';

import { LoginForm } from '@/components/auth/LoginForm';

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

      <LoginForm />

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
