import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tenants · Admin',
  robots: { index: false, follow: false },
};

/*
 * Questa pagina mostrava un elenco di tenant inventati (nomi di studi, piani,
 * MRR, date di attivazione) presentati come dati reali. Il markup precedente
 * resta nella history di git ed è recuperabile quando la pagina verrà cablata.
 *
 * Non è stata cablata subito perché un elenco cross-tenant richiede query in
 * service_role che scavalcano la RLS: è la superficie più delicata del
 * prodotto e merita un servizio dedicato con test di isolamento, non una
 * query aggiunta di fretta a una pagina.
 */
export default function AdminTenantsPage() {
  return (
    <div className="stack stack-6">
      <header className="stack stack-2">
        <span className="eyebrow">Admin</span>
        <h1>Tenants</h1>
        <p className="muted">Elenco dei tenant registrati sulla piattaforma.</p>
      </header>

      <div className="card card-padded stack stack-4">
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Non ancora collegato ai dati reali</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Questa schermata mostrava dati di esempio. Sono stati rimossi: un pannello di
          amministrazione che mostra numeri inventati è peggio di un pannello assente, perché chi lo
          consulta ne trae conclusioni sbagliate.
        </p>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Per collegarla serve un servizio cross-tenant dedicato in{' '}
          <code className="mono">src/server/admin/</code>, con i propri test di isolamento: le query
          cross-tenant girano in <code className="mono">service_role</code> e scavalcano la RLS,
          quindi non vanno improvvisate dentro una pagina.
        </p>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Nel frattempo la fonte autorevole è la tabella <code className="mono">tenants</code> nel
          progetto Supabase.
        </p>
      </div>
    </div>
  );
}
