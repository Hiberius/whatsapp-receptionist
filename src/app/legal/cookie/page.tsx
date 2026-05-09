import type { Metadata } from 'next';

import { LegalPageLayout } from '@/components/marketing/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'Cookie policy Ambrogio.ai: solo cookie tecnici strettamente necessari. Niente Google Analytics, niente Facebook Pixel.',
  alternates: { canonical: '/legal/cookie' },
};

export default function CookiePage() {
  return (
    <LegalPageLayout title="Cookie Policy" lastUpdated="8 maggio 2026">
      <p>
        Ambrogio.ai usa solo cookie tecnici strettamente necessari al funzionamento del Servizio.
        Nessun tracker pubblicitario di terze parti.
      </p>

      <h2>Cookie utilizzati</h2>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--text-sm)',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            <th style={{ textAlign: 'left', padding: 'var(--space-3) 0' }}>Nome</th>
            <th style={{ textAlign: 'left', padding: 'var(--space-3) 0' }}>Scopo</th>
            <th style={{ textAlign: 'left', padding: 'var(--space-3) 0' }}>Durata</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={{ padding: 'var(--space-3) 0' }}>
              <code>sb-access-token</code>
            </td>
            <td style={{ padding: 'var(--space-3) 0' }}>Sessione autenticata Supabase</td>
            <td style={{ padding: 'var(--space-3) 0' }}>1 ora</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={{ padding: 'var(--space-3) 0' }}>
              <code>sb-refresh-token</code>
            </td>
            <td style={{ padding: 'var(--space-3) 0' }}>Refresh sessione</td>
            <td style={{ padding: 'var(--space-3) 0' }}>30 giorni</td>
          </tr>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={{ padding: 'var(--space-3) 0' }}>
              <code>__Host-csp-nonce</code>
            </td>
            <td style={{ padding: 'var(--space-3) 0' }}>Nonce CSP per protezione XSS</td>
            <td style={{ padding: 'var(--space-3) 0' }}>Sessione</td>
          </tr>
        </tbody>
      </table>

      <h2>Niente cookie marketing</h2>
      <p>
        Non utilizziamo Google Analytics, Facebook Pixel o altri tracker comportamentali. Le
        metriche di utilizzo derivano esclusivamente dai dati operativi del Servizio.
      </p>

      <h2>Configurazione browser</h2>
      <p>
        Puoi disabilitare i cookie dalle impostazioni del browser. Disabilitare i cookie tecnici
        impedirà il funzionamento dell&apos;area autenticata.
      </p>
    </LegalPageLayout>
  );
}
