import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Billing · Admin',
  robots: { index: false, follow: false },
};

/*
 * Questa pagina pubblicava KPI finanziari inventati (MRR €11.450, ARR
 * proiettato, 38 clienti paganti, churn, growth rate), uno storico MRR a sei
 * mesi e un elenco fatture, tutto hardcoded e presentato come reale. Il markup
 * precedente resta nella history di git.
 *
 * Non è stato sostituito con dati veri perché le metriche di ricavo vanno
 * lette da Stripe, che è la fonte autorevole: ricalcolarle da una tabella
 * locale produrrebbe un secondo numero destinato a divergere da quello
 * fiscale.
 */
export default function AdminBillingPage() {
  return (
    <div className="stack stack-6">
      <header className="stack stack-2">
        <span className="eyebrow">Admin</span>
        <h1>Billing</h1>
        <p className="muted">Metriche di ricavo e stato degli abbonamenti.</p>
      </header>

      <div className="card card-padded stack stack-4">
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Non ancora collegato ai dati reali</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Questa schermata mostrava MRR, ARR, numero di clienti paganti, churn e storico a sei mesi
          come se fossero misurati. Erano valori scritti a mano: sono stati rimossi.
        </p>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          La fonte autorevole per i ricavi è la dashboard Stripe, che è anche quella che concorda
          con la contabilità. Un secondo calcolo fatto qui su dati locali finirebbe per divergere, e
          a quel punto nessuno dei due numeri sarebbe affidabile.
        </p>
        <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <a
            href="https://dashboard.stripe.com/"
            className="btn btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apri la dashboard Stripe
          </a>
        </div>
      </div>
    </div>
  );
}
