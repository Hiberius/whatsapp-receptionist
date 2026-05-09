import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Fatturazione · Ambrogio.ai',
};

const RECENT_INVOICES = [
  { date: '01/05/2026', number: 'FE/2026/00012', amount: '€297,00', status: 'paid' },
  { date: '01/04/2026', number: 'FE/2026/00009', amount: '€297,00', status: 'paid' },
  { date: '01/03/2026', number: 'FE/2026/00006', amount: '€297,00', status: 'paid' },
  { date: '01/02/2026', number: 'FE/2026/00003', amount: '€297,00', status: 'paid' },
] as const;

export default function BillingPage() {
  return (
    <>
      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">Fatturazione</span>
          <h1>Piano e fatture</h1>
        </div>
      </div>

      <div className="dashboard-content-grid">
        <section className="card stack stack-6">
          <div className="row-between">
            <div className="stack stack-2">
              <span className="badge">Piano attuale</span>
              <h2 style={{ fontSize: 'var(--text-2xl)' }}>Professional</h2>
              <p className="muted">€297/mese — fatturato il 1° del mese.</p>
            </div>
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <Link href="/pricing" className="btn btn-secondary">
                Cambia piano
              </Link>
              <button type="button" className="btn btn-primary">
                Apri portale Stripe
              </button>
            </div>
          </div>

          <hr className="divider" style={{ margin: 0 }} />

          <div>
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>
              Utilizzo questo mese
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--space-4)',
              }}
            >
              <div>
                <p className="kpi-label">Conversazioni AI</p>
                <p className="kpi-value">347/2.500</p>
                <div
                  style={{
                    height: 6,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-surface-sunken)',
                    overflow: 'hidden',
                    marginTop: 'var(--space-2)',
                  }}
                >
                  <div
                    style={{
                      width: '13.9%',
                      height: '100%',
                      background: 'var(--color-accent)',
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="kpi-label">Vocali trascritti</p>
                <p className="kpi-value">82</p>
              </div>
              <div>
                <p className="kpi-label">Booking</p>
                <p className="kpi-value">124</p>
              </div>
            </div>
          </div>
        </section>

        <aside className="card stack stack-3">
          <span className="eyebrow">Dati fatturazione</span>
          <p style={{ fontWeight: 600 }}>Studio Dentistico Demo Srl</p>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            P.IVA 12345678901
            <br />
            Codice destinatario SDI: 0000000
            <br />
            Via Roma 1, 00100 Roma
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Modifica dati di fatturazione dello studio"
            style={{ alignSelf: 'flex-start' }}
          >
            Modifica →
          </button>
        </aside>
      </div>

      <section className="card stack stack-4" style={{ marginTop: 'var(--space-6)' }}>
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Fatture elettroniche</h2>
          <span className="badge badge-success">SDI attivo</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--text-sm)',
            }}
          >
            <caption className="sr-only">
              Storico fatture elettroniche emesse al tuo studio con data, numero, importo e stato.
            </caption>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: 'var(--space-3) 0' }}>Data</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3) 0' }}>Numero</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3) 0' }}>Importo</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3) 0' }}>Stato</th>
                <th style={{ textAlign: 'right', padding: 'var(--space-3) 0' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_INVOICES.map((inv) => (
                <tr key={inv.number} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 'var(--space-3) 0' }}>{inv.date}</td>
                  <td style={{ padding: 'var(--space-3) 0' }} className="mono">
                    {inv.number}
                  </td>
                  <td style={{ padding: 'var(--space-3) 0', fontWeight: 600 }}>{inv.amount}</td>
                  <td style={{ padding: 'var(--space-3) 0' }}>
                    <span className="badge badge-success">Pagata</span>
                  </td>
                  <td style={{ textAlign: 'right', padding: 'var(--space-3) 0' }}>
                    <button
                      type="button"
                      className="btn-link"
                      aria-label={`Scarica PDF fattura ${inv.number} del ${inv.date}`}
                    >
                      Scarica PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
