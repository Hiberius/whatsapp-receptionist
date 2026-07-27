import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Audit log · Admin',
  robots: { index: false, follow: false },
};

/*
 * Questa pagina mostrava voci di audit log inventate (export GDPR,
 * cancellazioni, accessi) con date e attori fittizi.
 *
 * È il caso più grave fra le schermate admin che mostravano dati finti: un
 * registro di audit serve a dimostrare cosa è successo davvero, in sede di
 * verifica o di contestazione. Un registro che mostra voci fabbricate non è
 * una schermata incompleta, è un documento falso — e la tabella `audit_log`
 * reale esiste già e viene scritta dagli endpoint GDPR, quindi la finzione
 * copriva dati veri.
 *
 * Il markup precedente resta nella history di git.
 */
export default function AdminAuditPage() {
  return (
    <div className="stack stack-6">
      <header className="stack stack-2">
        <span className="eyebrow">Admin</span>
        <h1>Audit log</h1>
        <p className="muted">Registro delle azioni sui dati personali.</p>
      </header>

      <div className="card card-padded stack stack-4">
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Non ancora collegato al registro reale</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Le voci mostrate erano di esempio e sono state rimosse. La tabella{' '}
          <code className="mono">audit_log</code> esiste ed è realmente popolata dagli endpoint GDPR
          (Art. 15 e Art. 17): questa schermata va collegata a quei dati, non riempita di
          segnaposto, perché un registro di audit ha valore solo se riporta ciò che è accaduto
          davvero.
        </p>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Fonte autorevole nel frattempo: la tabella <code className="mono">audit_log</code> nel
          progetto Supabase.
        </p>
      </div>
    </div>
  );
}
