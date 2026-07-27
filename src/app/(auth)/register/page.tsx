import type { Metadata } from 'next';
import Link from 'next/link';

import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'Registrati · Ambrogio.ai',
  description: 'Crea il tuo account Ambrogio.ai e attiva la reception AI in 24 ore.',
  robots: { index: false, follow: false },
};

const TRIAL_INCLUDES = [
  '14 giorni gratis, no carta',
  '500 conversazioni AI di prova',
  'Onboarding co-gestito',
  'Cancelli con 1 click',
] as const;

export default function RegisterPage() {
  return (
    <div className="stack stack-6">
      <div className="stack stack-2">
        <span className="badge badge-success">Trial 14 giorni · Senza carta</span>
        <h1 style={{ fontSize: 'var(--text-3xl)' }}>Crea il tuo studio</h1>
        <p className="muted">
          Bastano 60 secondi per creare l&apos;account. Configurerai i numeri WhatsApp e il
          calendario nel passo successivo.
        </p>
      </div>

      <RegisterForm />

      <ul
        className="card stack stack-2"
        style={{
          listStyle: 'none',
          padding: 'var(--space-5)',
          background: 'var(--color-accent-soft)',
          border: '1px solid oklch(85% 0.05 175)',
        }}
      >
        {TRIAL_INCLUDES.map((item) => (
          <li
            key={item}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <span aria-hidden="true" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>

      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
        Hai già un account?{' '}
        <Link href="/login" className="btn-link">
          Accedi
        </Link>
      </p>
    </div>
  );
}
