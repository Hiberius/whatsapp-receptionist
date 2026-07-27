import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Utenti · Admin',
  robots: { index: false, follow: false },
};

/*
 * Questa pagina elencava utenti inventati (email, tenant di appartenenza,
 * ruolo, ultimo accesso) presentati come reali. Il markup precedente resta
 * nella history di git.
 *
 * Come per l'elenco tenant, la lettura cross-tenant richiede un servizio
 * dedicato con test di isolamento: qui si leggerebbero dati personali di
 * utenti di tenant diversi, quindi è anche una superficie GDPR.
 */
export default function AdminUsersPage() {
  return (
    <div className="stack stack-6">
      <header className="stack stack-2">
        <span className="eyebrow">Admin</span>
        <h1>Utenti</h1>
        <p className="muted">Utenti registrati su tutti i tenant.</p>
      </header>

      <div className="card card-padded stack stack-4">
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Non ancora collegato ai dati reali</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          I dati di esempio sono stati rimossi. Questa vista legge dati personali di utenti
          appartenenti a tenant diversi: oltre al servizio cross-tenant serve decidere quali campi
          un super-admin debba effettivamente vedere, e registrare l&apos;accesso su{' '}
          <code className="mono">audit_log</code> come già avviene per gli endpoint GDPR.
        </p>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Fonte autorevole nel frattempo: la sezione Authentication del progetto Supabase.
        </p>
      </div>
    </div>
  );
}
