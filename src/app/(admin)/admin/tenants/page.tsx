import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tenants · Admin',
  robots: { index: false, follow: false },
};

const TENANTS = [
  {
    id: 't1',
    name: 'Studio Dentistico Rossi',
    vertical: 'dental',
    plan: 'Professional',
    mrr: '€297',
    status: 'active',
    created: '12/04/2026',
  },
  {
    id: 't2',
    name: 'Beauty Center Roma',
    vertical: 'beauty',
    plan: 'Starter',
    mrr: '€97',
    status: 'active',
    created: '01/04/2026',
  },
  {
    id: 't3',
    name: 'Fitness Studio Beta',
    vertical: 'fitness',
    plan: 'Professional',
    mrr: '€297',
    status: 'active',
    created: '15/03/2026',
  },
  {
    id: 't4',
    name: 'Studio Bianchi & Associati',
    vertical: 'professional',
    plan: 'Professional',
    mrr: '€297',
    status: 'trial',
    created: '02/05/2026',
  },
  {
    id: 't5',
    name: 'Mediagency XYZ',
    vertical: 'agency',
    plan: 'Agency',
    mrr: '€897',
    status: 'active',
    created: '10/03/2026',
  },
] as const;

const STATUS_BADGE = {
  active: { label: 'Attivo', class: 'badge-success' },
  trial: { label: 'Trial', class: 'badge-warm' },
  suspended: { label: 'Sospeso', class: 'badge-danger' },
  cancelled: { label: 'Cancellato', class: 'badge-neutral' },
} as const;

export default function AdminTenantsPage() {
  return (
    <div className="stack stack-6">
      <div className="row-between">
        <div className="stack stack-2">
          <span className="badge badge-warm">Cross-tenant</span>
          <h1>Tenants</h1>
          <p className="muted">{TENANTS.length} attivi · MRR totale €1.885</p>
        </div>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <label htmlFor="tenants-search" className="sr-only">
            Cerca tenant per nome, P.IVA o email
          </label>
          <input
            id="tenants-search"
            type="search"
            placeholder="Cerca per nome, P.IVA, email"
            className="input"
            style={{ minWidth: '280px' }}
          />
          <button type="button" className="btn btn-secondary">
            Filtra
          </button>
          <button type="button" className="btn btn-primary">
            + Nuovo tenant
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--text-sm)',
            }}
          >
            <caption className="sr-only">
              Tenant attivi sulla piattaforma con vertical, piano, MRR, stato e data di iscrizione.
            </caption>
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--color-border)',
                  background: 'var(--color-surface-sunken)',
                }}
              >
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--space-3) var(--space-5)',
                    fontWeight: 600,
                    fontSize: 'var(--text-xs)',
                    letterSpacing: 'var(--tracking-wider)',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Studio
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--space-3) var(--space-5)',
                    fontWeight: 600,
                    fontSize: 'var(--text-xs)',
                    letterSpacing: 'var(--tracking-wider)',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Vertical
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--space-3) var(--space-5)',
                    fontWeight: 600,
                    fontSize: 'var(--text-xs)',
                    letterSpacing: 'var(--tracking-wider)',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Piano
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: 'var(--space-3) var(--space-5)',
                    fontWeight: 600,
                    fontSize: 'var(--text-xs)',
                    letterSpacing: 'var(--tracking-wider)',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  MRR
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--space-3) var(--space-5)',
                    fontWeight: 600,
                    fontSize: 'var(--text-xs)',
                    letterSpacing: 'var(--tracking-wider)',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Stato
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 'var(--space-3) var(--space-5)',
                    fontWeight: 600,
                    fontSize: 'var(--text-xs)',
                    letterSpacing: 'var(--tracking-wider)',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Iscritto
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {TENANTS.map((tenant) => {
                const status = STATUS_BADGE[tenant.status];
                return (
                  <tr
                    key={tenant.id}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background var(--duration-normal) var(--ease-out)',
                    }}
                  >
                    <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                      <div className="stack stack-2">
                        <span style={{ fontWeight: 600 }}>{tenant.name}</span>
                        <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
                          {tenant.id}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                      <span className="badge badge-neutral">{tenant.vertical}</span>
                    </td>
                    <td style={{ padding: 'var(--space-4) var(--space-5)' }}>{tenant.plan}</td>
                    <td
                      style={{
                        padding: 'var(--space-4) var(--space-5)',
                        textAlign: 'right',
                        fontWeight: 600,
                      }}
                    >
                      {tenant.mrr}
                    </td>
                    <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                      <span className={`badge ${status.class}`}>{status.label}</span>
                    </td>
                    <td
                      className="muted"
                      style={{
                        padding: 'var(--space-4) var(--space-5)',
                        fontSize: 'var(--text-xs)',
                      }}
                    >
                      {tenant.created}
                    </td>
                    <td style={{ padding: 'var(--space-4) var(--space-5)' }}>
                      <button
                        type="button"
                        className="btn-link"
                        aria-label={`Dettagli tenant ${tenant.name}`}
                      >
                        Dettagli →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
