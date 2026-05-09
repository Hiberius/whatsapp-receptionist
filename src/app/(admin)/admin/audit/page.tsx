import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSuperAdmin } from '@/lib/auth/super-admin';

export const metadata: Metadata = {
  title: 'Audit log · Admin',
  robots: { index: false, follow: false },
};

type AuditAction =
  | 'gdpr_export'
  | 'gdpr_delete'
  | 'login'
  | 'login_failed'
  | 'settings_change'
  | 'billing_event'
  | 'plan_change'
  | 'team_invite'
  | 'integration_connected'
  | 'integration_disconnected'
  | 'kb_update'
  | 'webhook_failure';

interface AuditEntry {
  id: string;
  ts: string;
  tenantId: string;
  tenantName: string;
  user: string;
  action: AuditAction;
  target: string;
  ip: string;
  details: string;
}

const ACTION_TYPES: { value: AuditAction; label: string }[] = [
  { value: 'gdpr_export', label: 'GDPR export' },
  { value: 'gdpr_delete', label: 'GDPR delete' },
  { value: 'login', label: 'Login' },
  { value: 'login_failed', label: 'Login fallito' },
  { value: 'settings_change', label: 'Settings change' },
  { value: 'billing_event', label: 'Billing event' },
  { value: 'plan_change', label: 'Plan change' },
  { value: 'team_invite', label: 'Team invite' },
  { value: 'integration_connected', label: 'Integration connected' },
  { value: 'integration_disconnected', label: 'Integration disconnected' },
  { value: 'kb_update', label: 'KB update' },
  { value: 'webhook_failure', label: 'Webhook failure' },
];

const ACTION_LABELS = ACTION_TYPES.reduce<Record<AuditAction, string>>(
  (acc, item) => {
    acc[item.value] = item.label;
    return acc;
  },
  {} as Record<AuditAction, string>,
);

const ACTION_BADGE: Record<AuditAction, string> = {
  gdpr_export: 'badge-warm',
  gdpr_delete: 'badge-danger',
  login: 'badge-neutral',
  login_failed: 'badge-danger',
  settings_change: 'badge',
  billing_event: 'badge-warm',
  plan_change: 'badge-warm',
  team_invite: 'badge',
  integration_connected: 'badge-success',
  integration_disconnected: 'badge-neutral',
  kb_update: 'badge',
  webhook_failure: 'badge-danger',
};

const ENTRIES: AuditEntry[] = [
  {
    id: 'a_2026_05_08_001',
    ts: '08/05/2026 09:14:22',
    tenantId: 't1',
    tenantName: 'Studio Dentistico Rossi',
    user: 'm.rossi@studiorossi.it',
    action: 'login',
    target: 'sessione web',
    ip: '93.42.118.204',
    details: 'User-Agent: Chrome 130 / macOS 15.4 · MFA: TOTP',
  },
  {
    id: 'a_2026_05_08_002',
    ts: '08/05/2026 08:42:11',
    tenantId: 't1',
    tenantName: 'Studio Dentistico Rossi',
    user: 'reception@studiorossi.it',
    action: 'settings_change',
    target: 'orari apertura · venerdì',
    ip: '93.42.118.204',
    details: 'open_from 09:00→08:30, open_to 18:00 invariato',
  },
  {
    id: 'a_2026_05_08_003',
    ts: '08/05/2026 08:11:54',
    tenantId: 't5',
    tenantName: 'Mediagency XYZ',
    user: 'admin@mediagencyxyz.it',
    action: 'integration_connected',
    target: 'Stripe Connect · sub-tenant t14',
    ip: '5.171.220.18',
    details: 'OAuth flow completato · stripe_account_id=acct_1OqRzx...',
  },
  {
    id: 'a_2026_05_08_004',
    ts: '08/05/2026 07:48:02',
    tenantId: 't9',
    tenantName: 'Hotel Costa Smeralda',
    user: 'sistema',
    action: 'webhook_failure',
    target: 'POST /webhooks/whatsapp · 502',
    ip: '—',
    details: 'meta delivery webhook · retry 3/5 · prossimo tentativo +5min',
  },
  {
    id: 'a_2026_05_07_005',
    ts: '07/05/2026 22:30:18',
    tenantId: 't2',
    tenantName: 'Beauty Center Roma',
    user: 'g.esposito@beautyromacenter.it',
    action: 'plan_change',
    target: 'upgrade Starter → Professional',
    ip: '79.16.45.221',
    details: 'Stripe subscription sub_PqL... aggiornata · prorate=12,40€',
  },
  {
    id: 'a_2026_05_07_006',
    ts: '07/05/2026 19:48:33',
    tenantId: 't1',
    tenantName: 'Studio Dentistico Rossi',
    user: 'reception@studiorossi.it',
    action: 'gdpr_export',
    target: 'export dati paziente · CF MRZL85R10F205B',
    ip: '93.42.118.204',
    details: 'Richiesto da paziente · ZIP firmato · scadenza link 15/05',
  },
  {
    id: 'a_2026_05_07_007',
    ts: '07/05/2026 16:22:14',
    tenantId: 't3',
    tenantName: 'Fitness Studio Beta',
    user: 'unknown@example.com',
    action: 'login_failed',
    target: 'sessione web',
    ip: '185.220.101.42',
    details: '5 tentativi consecutivi · IP bloccato per 30min · TOR exit node sospetto',
  },
  {
    id: 'a_2026_05_07_008',
    ts: '07/05/2026 14:05:09',
    tenantId: 't4',
    tenantName: 'Studio Bianchi & Associati',
    user: 'g.bianchi@studiobianchi.legal',
    action: 'team_invite',
    target: 'paralegal@studiobianchi.legal · role=member',
    ip: '79.55.182.91',
    details: 'Invito email inviato · scade 14/05 · token jti=...8421',
  },
  {
    id: 'a_2026_05_07_009',
    ts: '07/05/2026 11:32:48',
    tenantId: 't1',
    tenantName: 'Studio Dentistico Rossi',
    user: 'sistema',
    action: 'billing_event',
    target: 'fattura SDI #2026-042 emessa',
    ip: '—',
    details: 'Stripe invoice in_1OqL... · Fatture in Cloud doc_id=98712 · totale 362,34€',
  },
  {
    id: 'a_2026_05_06_010',
    ts: '06/05/2026 18:14:01',
    tenantId: 't7',
    tenantName: 'Centro Riabilitazione Verona',
    user: 'admin@centroverona.it',
    action: 'kb_update',
    target: 'FAQ · prezzi fisioterapia',
    ip: '93.144.205.18',
    details: '8 entry modificate · re-embedding Pinecone in coda · job=kb_42091',
  },
  {
    id: 'a_2026_05_06_011',
    ts: '06/05/2026 15:42:37',
    tenantId: 't11',
    tenantName: 'Boutique Hotel Cinque Terre',
    user: 'owner@hotel5terre.it',
    action: 'gdpr_delete',
    target: 'eliminazione account ospite · CF VRDLCA72M50F205X',
    ip: '37.116.118.4',
    details: 'Hard delete eseguito · backup conservato per 30gg per audit · job_id=del_8821',
  },
  {
    id: 'a_2026_05_06_012',
    ts: '06/05/2026 12:19:22',
    tenantId: 't8',
    tenantName: 'Palestra Olimpia Milano',
    user: 'manager@olimpiagym.it',
    action: 'integration_disconnected',
    target: 'Google Calendar',
    ip: '93.43.218.7',
    details: 'Disconnessione manuale · token revocato lato Google',
  },
  {
    id: 'a_2026_05_05_013',
    ts: '05/05/2026 22:18:08',
    tenantId: 't1',
    tenantName: 'Studio Dentistico Rossi',
    user: 'AI agent',
    action: 'settings_change',
    target: 'risposta automatica weekend · attivata',
    ip: '—',
    details: 'Auto-applicato da configurazione · trigger=horario_chiuso',
  },
  {
    id: 'a_2026_05_05_014',
    ts: '05/05/2026 17:00:00',
    tenantId: 't5',
    tenantName: 'Mediagency XYZ',
    user: 'sistema',
    action: 'billing_event',
    target: 'addebito ricorrente · €897',
    ip: '—',
    details: 'Stripe charge ch_3Op... · payment_method=card_1OqRzx · status=succeeded',
  },
  {
    id: 'a_2026_05_05_015',
    ts: '05/05/2026 09:10:55',
    tenantId: 't13',
    tenantName: 'Studio Notarile Conti',
    user: 'a.conti@notarilecont.it',
    action: 'login',
    target: 'sessione web',
    ip: '79.21.144.88',
    details: 'User-Agent: Safari 18 / iPad · MFA: webauthn',
  },
];

export default async function AdminAuditPage() {
  await requireSuperAdmin();

  return (
    <div className="stack stack-6">
      <div className="stack stack-2">
        <span className="badge badge-warm">Cross-tenant</span>
        <h1>Audit log</h1>
        <p className="muted">
          Eventi sicurezza, GDPR, billing e configurazione di tutti i tenant. Conservazione 24 mesi.
        </p>
      </div>

      <section
        className="card stack stack-4"
        aria-label="Filtri audit"
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
            <label className="label" htmlFor="filter-action">
              Tipo azione
            </label>
            <select id="filter-action" className="select" defaultValue="">
              <option value="">Tutte ({ACTION_TYPES.length})</option>
              {ACTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="filter-tenant">
              Tenant
            </label>
            <select id="filter-tenant" className="select" defaultValue="">
              <option value="">Tutti</option>
              <option value="t1">Studio Dentistico Rossi</option>
              <option value="t2">Beauty Center Roma</option>
              <option value="t3">Fitness Studio Beta</option>
              <option value="t5">Mediagency XYZ</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="filter-user">
              Utente
            </label>
            <input id="filter-user" type="search" placeholder="email o user_id" className="input" />
          </div>
          <div className="field">
            <label className="label" htmlFor="filter-from">
              Dal
            </label>
            <input id="filter-from" type="date" className="input" defaultValue="2026-05-01" />
          </div>
          <div className="field">
            <label className="label" htmlFor="filter-to">
              Al
            </label>
            <input id="filter-to" type="date" className="input" defaultValue="2026-05-08" />
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost">
            Reset
          </button>
          <button type="button" className="btn btn-primary">
            Applica filtri
          </button>
        </div>
      </section>

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--text-sm)',
            }}
          >
            <caption className="sr-only">
              Eventi di audit log cross-tenant con timestamp, tenant, utente, azione, target e IP di
              origine.
            </caption>
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--color-border)',
                  background: 'var(--color-surface-sunken)',
                }}
              >
                <Th>Timestamp</Th>
                <Th>Tenant</Th>
                <Th>Utente</Th>
                <Th>Azione</Th>
                <Th>Target</Th>
                <Th>IP</Th>
                <Th>Dettagli</Th>
              </tr>
            </thead>
            <tbody>
              {ENTRIES.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <Td mono>{entry.ts}</Td>
                  <Td>
                    <Link
                      href={`/admin/tenants/${entry.tenantId}`}
                      className="btn-link"
                      style={{ fontSize: 'var(--text-sm)' }}
                    >
                      {entry.tenantName}
                    </Link>
                  </Td>
                  <Td>
                    <span className="mono" style={{ fontSize: 'var(--text-xs)' }}>
                      {entry.user}
                    </span>
                  </Td>
                  <Td>
                    <span className={`badge ${ACTION_BADGE[entry.action]}`}>
                      {ACTION_LABELS[entry.action]}
                    </span>
                  </Td>
                  <Td>{entry.target}</Td>
                  <Td mono muted>
                    {entry.ip}
                  </Td>
                  <Td>
                    <details className="audit-details" style={{ cursor: 'pointer' }}>
                      <summary
                        className="muted audit-details-summary"
                        style={{ fontSize: 'var(--text-xs)' }}
                      >
                        <span aria-hidden="true" className="audit-details-marker">
                          ▸
                        </span>{' '}
                        Mostra
                      </summary>
                      <span
                        className="mono"
                        style={{
                          display: 'block',
                          marginTop: 'var(--space-2)',
                          padding: 'var(--space-2)',
                          background: 'var(--color-surface-sunken)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {entry.details}
                      </span>
                    </details>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <nav
        aria-label="Paginazione audit"
        className="row-between"
        style={{
          padding: 'var(--space-3) var(--space-1)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <span className="muted">1-15 di 8.247 eventi · pagina 1 di 550</span>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Pagina precedente"
            disabled
          >
            ← Prec
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-current="page"
            aria-label="Pagina 1, corrente"
          >
            1
          </button>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Pagina 2">
            2
          </button>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Pagina 3">
            3
          </button>
          <span aria-hidden="true" className="muted">
            …
          </span>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Pagina 550">
            550
          </button>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Pagina successiva">
            Succ →
          </button>
        </div>
      </nav>
    </div>
  );
}

function Th({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <th
      style={{
        textAlign: 'left',
        padding: 'var(--space-3) var(--space-4)',
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

function Td({
  children,
  mono,
  muted,
}: Readonly<{ children: React.ReactNode; mono?: boolean; muted?: boolean }>) {
  const className = [mono ? 'mono' : null, muted ? 'muted' : null].filter(Boolean).join(' ');
  return (
    <td
      className={className || undefined}
      style={{
        padding: 'var(--space-3) var(--space-4)',
        fontSize: mono ? 'var(--text-xs)' : 'var(--text-sm)',
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  );
}
