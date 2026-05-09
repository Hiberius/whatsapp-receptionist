import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSuperAdmin } from '@/lib/auth/super-admin';

export const metadata: Metadata = {
  title: 'Utenti · Admin',
  robots: { index: false, follow: false },
};

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  tenantName: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'invited' | 'suspended';
  created: string;
  lastLogin: string;
}

const ROLE_BADGE = {
  owner: { label: 'Owner', class: 'badge' },
  admin: { label: 'Admin', class: 'badge-warm' },
  member: { label: 'Member', class: 'badge-neutral' },
} as const;

const STATUS_BADGE = {
  active: { label: 'Attivo', class: 'badge-success' },
  invited: { label: 'Invitato', class: 'badge-warm' },
  suspended: { label: 'Sospeso', class: 'badge-danger' },
} as const;

const USERS: UserRow[] = [
  {
    id: 'u_001',
    email: 'm.rossi@studiorossi.it',
    fullName: 'Marco Rossi',
    tenantId: 't1',
    tenantName: 'Studio Dentistico Rossi',
    role: 'owner',
    status: 'active',
    created: '12/04/2026',
    lastLogin: '08/05/2026 09:14',
  },
  {
    id: 'u_002',
    email: 'reception@studiorossi.it',
    fullName: 'Anna Bianchi',
    tenantId: 't1',
    tenantName: 'Studio Dentistico Rossi',
    role: 'admin',
    status: 'active',
    created: '14/04/2026',
    lastLogin: '08/05/2026 08:32',
  },
  {
    id: 'u_011',
    email: 'g.esposito@beautyromacenter.it',
    fullName: 'Giulia Esposito',
    tenantId: 't2',
    tenantName: 'Beauty Center Roma',
    role: 'owner',
    status: 'active',
    created: '01/04/2026',
    lastLogin: '08/05/2026 11:02',
  },
  {
    id: 'u_012',
    email: 'reception@beautyromacenter.it',
    fullName: 'Martina Lupo',
    tenantId: 't2',
    tenantName: 'Beauty Center Roma',
    role: 'admin',
    status: 'active',
    created: '02/04/2026',
    lastLogin: '08/05/2026 10:15',
  },
  {
    id: 'u_021',
    email: 'owner@fitnessbeta.example',
    fullName: 'Example Owner',
    tenantId: 't3',
    tenantName: 'Fitness Studio Beta',
    role: 'owner',
    status: 'active',
    created: '15/03/2026',
    lastLogin: '08/05/2026 07:45',
  },
  {
    id: 'u_031',
    email: 'g.bianchi@studiobianchi.legal',
    fullName: 'Giorgio Bianchi',
    tenantId: 't4',
    tenantName: 'Studio Bianchi & Associati',
    role: 'owner',
    status: 'active',
    created: '02/05/2026',
    lastLogin: '07/05/2026 18:11',
  },
  {
    id: 'u_032',
    email: 'paralegal@studiobianchi.legal',
    fullName: 'Elisa Conti',
    tenantId: 't4',
    tenantName: 'Studio Bianchi & Associati',
    role: 'member',
    status: 'invited',
    created: '07/05/2026',
    lastLogin: '—',
  },
  {
    id: 'u_041',
    email: 'admin@mediagencyxyz.it',
    fullName: 'Federico Manzoni',
    tenantId: 't5',
    tenantName: 'Mediagency XYZ',
    role: 'owner',
    status: 'active',
    created: '10/03/2026',
    lastLogin: '08/05/2026 08:11',
  },
  {
    id: 'u_042',
    email: 'account@mediagencyxyz.it',
    fullName: 'Chiara De Luca',
    tenantId: 't5',
    tenantName: 'Mediagency XYZ',
    role: 'admin',
    status: 'active',
    created: '11/03/2026',
    lastLogin: '07/05/2026 16:54',
  },
  {
    id: 'u_051',
    email: 'old.account@oldsupplier.it',
    fullName: 'Marco Verdi',
    tenantId: 't6',
    tenantName: 'Old Supplier S.r.l.',
    role: 'owner',
    status: 'suspended',
    created: '20/02/2026',
    lastLogin: '14/04/2026 09:02',
  },
  {
    id: 'u_061',
    email: 'admin@centroverona.it',
    fullName: 'Davide Lombardo',
    tenantId: 't7',
    tenantName: 'Centro Riabilitazione Verona',
    role: 'admin',
    status: 'active',
    created: '03/03/2026',
    lastLogin: '06/05/2026 18:14',
  },
  {
    id: 'u_071',
    email: 'a.conti@notarilecont.it',
    fullName: 'Alessandro Conti',
    tenantId: 't13',
    tenantName: 'Studio Notarile Conti',
    role: 'owner',
    status: 'active',
    created: '22/03/2026',
    lastLogin: '05/05/2026 09:10',
  },
];

export default async function AdminUsersPage() {
  await requireSuperAdmin();

  return (
    <div className="stack stack-6">
      <div className="row-between">
        <div className="stack stack-2">
          <span className="badge badge-warm">Cross-tenant</span>
          <h1>Utenti</h1>
          <p className="muted">
            {USERS.length} utenti su {new Set(USERS.map((u) => u.tenantId)).size} tenant ·{' '}
            {USERS.filter((u) => u.status === 'active').length} attivi ·{' '}
            {USERS.filter((u) => u.status === 'invited').length} invitati
          </p>
        </div>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <label htmlFor="users-search" className="sr-only">
            Cerca utente per email, nome o user_id
          </label>
          <input
            id="users-search"
            type="search"
            placeholder="Cerca per email, nome, user_id"
            className="input"
            style={{ minWidth: '300px' }}
          />
          <button type="button" className="btn btn-primary">
            + Invita super-admin
          </button>
        </div>
      </div>

      <section
        className="card stack stack-3"
        aria-label="Filtri utenti"
        style={{ background: 'var(--color-surface-sunken)' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          <div className="field">
            <label className="label" htmlFor="filter-role">
              Ruolo
            </label>
            <select id="filter-role" className="select" defaultValue="">
              <option value="">Tutti</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="filter-status">
              Stato
            </label>
            <select id="filter-status" className="select" defaultValue="">
              <option value="">Tutti</option>
              <option value="active">Attivo</option>
              <option value="invited">Invitato</option>
              <option value="suspended">Sospeso</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="filter-tenant">
              Tenant
            </label>
            <select id="filter-tenant" className="select" defaultValue="">
              <option value="">Tutti</option>
              {Array.from(new Set(USERS.map((u) => u.tenantName))).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="filter-last-login">
              Ultimo accesso
            </label>
            <select id="filter-last-login" className="select" defaultValue="all">
              <option value="all">Tutti</option>
              <option value="24h">Ultime 24h</option>
              <option value="7d">Ultimi 7gg</option>
              <option value="30d">Ultimi 30gg</option>
              <option value="never">Mai</option>
            </select>
          </div>
        </div>
      </section>

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
              Elenco utenti cross-tenant con email, tenant di appartenenza, ruolo, stato e ultimo
              accesso.
            </caption>
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--color-border)',
                  background: 'var(--color-surface-sunken)',
                }}
              >
                <Th>Utente</Th>
                <Th>Email</Th>
                <Th>Tenant</Th>
                <Th>Ruolo</Th>
                <Th>Stato</Th>
                <Th>Iscritto</Th>
                <Th>Ultimo accesso</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {USERS.map((user) => {
                const role = ROLE_BADGE[user.role];
                const status = STATUS_BADGE[user.status];
                return (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <Td>
                      <div className="stack stack-2">
                        <span style={{ fontWeight: 600 }}>{user.fullName}</span>
                        <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
                          {user.id}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <span className="mono" style={{ fontSize: 'var(--text-xs)' }}>
                        {user.email}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/tenants/${user.tenantId}`}
                        className="btn-link"
                        style={{ fontSize: 'var(--text-sm)' }}
                      >
                        {user.tenantName}
                      </Link>
                    </Td>
                    <Td>
                      <span className={`badge ${role.class}`}>{role.label}</span>
                    </Td>
                    <Td>
                      <span className={`badge ${status.class}`}>{status.label}</span>
                    </Td>
                    <Td muted>{user.created}</Td>
                    <Td muted>{user.lastLogin}</Td>
                    <Td>
                      <button
                        type="button"
                        className="btn-link"
                        aria-label={`Dettagli utente ${user.fullName} (${user.email})`}
                      >
                        Dettagli →
                      </button>
                    </Td>
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

function Th({ children }: Readonly<{ children?: React.ReactNode }>) {
  return (
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
      {children}
    </th>
  );
}

function Td({ children, muted }: Readonly<{ children: React.ReactNode; muted?: boolean }>) {
  return (
    <td
      className={muted ? 'muted' : undefined}
      style={{
        padding: 'var(--space-4) var(--space-5)',
        fontSize: muted ? 'var(--text-xs)' : 'var(--text-sm)',
      }}
    >
      {children}
    </td>
  );
}
