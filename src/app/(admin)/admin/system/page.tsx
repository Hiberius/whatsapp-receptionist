import type { Metadata } from 'next';

import { FeatureFlagToggle } from '@/components/admin/FeatureFlagToggle';
import { requireSuperAdmin } from '@/lib/auth/super-admin';

export const metadata: Metadata = {
  title: 'Sistema · Admin',
  robots: { index: false, follow: false },
};

interface EnvVar {
  name: string;
  scope: 'public' | 'server' | 'edge';
  status: 'configured' | 'missing' | 'rotation_pending';
  rotatedAt: string | null;
}

interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  rollout: 'global' | 'tenant_subset' | 'beta';
  scope: string;
}

interface CronJob {
  name: string;
  schedule: string;
  lastRunAt: string;
  duration: string;
  status: 'success' | 'failed' | 'running' | 'idle';
  description: string;
}

interface DbTable {
  name: string;
  rows: string;
}

const ENV_VARS: EnvVar[] = [
  {
    name: 'DATABASE_URL',
    scope: 'server',
    status: 'configured',
    rotatedAt: '02/04/2026',
  },
  {
    name: 'SUPABASE_URL',
    scope: 'public',
    status: 'configured',
    rotatedAt: '01/03/2026',
  },
  {
    name: 'SUPABASE_ANON_KEY',
    scope: 'public',
    status: 'configured',
    rotatedAt: '01/03/2026',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    scope: 'server',
    status: 'configured',
    rotatedAt: '01/03/2026',
  },
  {
    name: 'ANTHROPIC_API_KEY',
    scope: 'server',
    status: 'configured',
    rotatedAt: '15/04/2026',
  },
  {
    name: 'OPENAI_API_KEY',
    scope: 'server',
    status: 'configured',
    rotatedAt: '15/04/2026',
  },
  {
    name: 'STRIPE_SECRET_KEY',
    scope: 'server',
    status: 'rotation_pending',
    rotatedAt: '02/02/2026',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    scope: 'server',
    status: 'configured',
    rotatedAt: '02/02/2026',
  },
  {
    name: 'WHATSAPP_CLOUD_TOKEN',
    scope: 'server',
    status: 'configured',
    rotatedAt: '20/04/2026',
  },
  {
    name: 'ELEVENLABS_API_KEY',
    scope: 'server',
    status: 'configured',
    rotatedAt: '20/04/2026',
  },
  {
    name: 'UPSTASH_REDIS_REST_URL',
    scope: 'server',
    status: 'configured',
    rotatedAt: '01/03/2026',
  },
  {
    name: 'FATTURE_IN_CLOUD_API_KEY',
    scope: 'server',
    status: 'configured',
    rotatedAt: '15/04/2026',
  },
  {
    name: 'SENTRY_DSN',
    scope: 'server',
    status: 'missing',
    rotatedAt: null,
  },
  {
    name: 'PINECONE_API_KEY',
    scope: 'server',
    status: 'configured',
    rotatedAt: '15/04/2026',
  },
];

const FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: 'voice_replies_enabled',
    description: 'Risposte vocali ElevenLabs su WhatsApp.',
    enabled: true,
    rollout: 'global',
    scope: 'tutti i tenant',
  },
  {
    key: 'agency_white_label',
    description: 'White-label per agency con sub-tenant management.',
    enabled: true,
    rollout: 'tenant_subset',
    scope: '4 agency su piano Agency',
  },
  {
    key: 'fatturazione_sdi_auto',
    description: 'Emissione automatica fatture su SDI tramite Fatture in Cloud.',
    enabled: true,
    rollout: 'global',
    scope: 'tutti i tenant con piano ≥ Professional',
  },
  {
    key: 'ai_fallback_openai',
    description: 'Fallback automatico OpenAI quando Anthropic latency > 800ms p95.',
    enabled: true,
    rollout: 'global',
    scope: 'tutti i tenant Enterprise',
  },
  {
    key: 'gdpr_self_service_export',
    description: 'Export self-service GDPR senza approvazione admin.',
    enabled: false,
    rollout: 'beta',
    scope: '7 tenant beta',
  },
  {
    key: 'multi_language_kb',
    description: 'Knowledge base multilingua (it / en / es / mt).',
    enabled: true,
    rollout: 'global',
    scope: 'tutti i tenant',
  },
  {
    key: 'sms_channel',
    description: 'Canale SMS (Twilio) come integrazione opzionale.',
    enabled: false,
    rollout: 'beta',
    scope: '0 tenant — feature in dev',
  },
  {
    key: 'analytics_export_csv',
    description: 'Export CSV report KPI per dashboard.',
    enabled: true,
    rollout: 'global',
    scope: 'tutti i tenant',
  },
];

const CRON_JOBS: CronJob[] = [
  {
    name: 'billing-reconcile',
    schedule: '0 3 * * *',
    lastRunAt: '08/05/2026 03:00:14',
    duration: '42s',
    status: 'success',
    description: 'Riconcilia Stripe charge ↔ Fatture in Cloud per tutti i tenant.',
  },
  {
    name: 'usage-aggregator',
    schedule: '*/15 * * * *',
    lastRunAt: '08/05/2026 12:30:01',
    duration: '8s',
    status: 'success',
    description: 'Aggrega contatori usage per tenant (conversazioni, vocali, booking).',
  },
  {
    name: 'gdpr-retention-purge',
    schedule: '0 4 * * 0',
    lastRunAt: '04/05/2026 04:00:18',
    duration: '3m 12s',
    status: 'success',
    description: 'Hard-delete dati oltre retention 24 mesi (audit log, conversazioni).',
  },
  {
    name: 'webhook-retry-queue',
    schedule: '*/5 * * * *',
    lastRunAt: '08/05/2026 12:35:02',
    duration: '12s',
    status: 'failed',
    description: '4 webhook in coda · 1 errore persistente su tenant t9 (HTTP 502).',
  },
  {
    name: 'kb-reembedding',
    schedule: '0 2 * * *',
    lastRunAt: '08/05/2026 02:00:55',
    duration: '14m 38s',
    status: 'success',
    description: 'Re-embedding Pinecone per knowledge base modificate nelle 24h.',
  },
  {
    name: 'health-monitor',
    schedule: '* * * * *',
    lastRunAt: '08/05/2026 12:38:00',
    duration: '2s',
    status: 'running',
    description: 'Monitor latency upstream (Anthropic, ElevenLabs, Meta, Stripe).',
  },
  {
    name: 'mrr-snapshot',
    schedule: '0 0 * * *',
    lastRunAt: '08/05/2026 00:00:08',
    duration: '4s',
    status: 'success',
    description: 'Snapshot giornaliero MRR per dashboard billing.',
  },
];

const DB_TABLES: DbTable[] = [
  { name: 'tenants', rows: '47' },
  { name: 'users', rows: '128' },
  { name: 'tenant_users', rows: '162' },
  { name: 'conversations', rows: '38.412' },
  { name: 'messages', rows: '184.927' },
  { name: 'bookings', rows: '4.812' },
  { name: 'knowledge_base_entries', rows: '12.044' },
  { name: 'audit_log', rows: '8.247' },
  { name: 'invoices', rows: '914' },
  { name: 'integrations', rows: '188' },
  { name: 'webhooks_outbox', rows: '12 (in coda)' },
  { name: 'feature_flag_overrides', rows: '23' },
];

const SCOPE_BADGE = {
  public: { label: 'public', class: 'badge-warm' },
  server: { label: 'server', class: 'badge' },
  edge: { label: 'edge', class: 'badge-neutral' },
} as const;

const ENV_STATUS_BADGE = {
  configured: { label: 'Configurato', class: 'badge-success' },
  missing: { label: 'Mancante', class: 'badge-danger' },
  rotation_pending: { label: 'Rotazione attesa', class: 'badge-warm' },
} as const;

const CRON_STATUS_BADGE = {
  success: { label: 'OK', class: 'badge-success' },
  failed: { label: 'Failed', class: 'badge-danger' },
  running: { label: 'Running', class: 'badge-warm' },
  idle: { label: 'Idle', class: 'badge-neutral' },
} as const;

const ROLLOUT_BADGE = {
  global: { label: 'Global', class: 'badge-success' },
  tenant_subset: { label: 'Subset', class: 'badge-warm' },
  beta: { label: 'Beta', class: 'badge' },
} as const;

const TOTAL_ROWS = DB_TABLES.reduce((acc, table) => {
  const numeric = parseInt(table.rows.replace(/[^0-9]/gu, ''), 10);
  return acc + (Number.isFinite(numeric) ? numeric : 0);
}, 0);

export default async function AdminSystemPage() {
  await requireSuperAdmin();

  return (
    <div className="stack stack-8">
      <div className="stack stack-2">
        <span className="badge badge-warm">Cross-tenant</span>
        <h1>Sistema</h1>
        <p className="muted">
          Configurazione runtime, feature flags, cron e database. Modifiche applicate live —
          attenzione.
        </p>
      </div>

      <section className="card stack stack-4">
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Env config</h2>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            {ENV_VARS.filter((v) => v.status === 'configured').length} configurate ·{' '}
            {ENV_VARS.filter((v) => v.status === 'missing').length} mancanti ·{' '}
            {ENV_VARS.filter((v) => v.status === 'rotation_pending').length} rotazione
          </span>
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
              Variabili di ambiente runtime con scope, stato di configurazione e data ultima
              rotazione.
            </caption>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <Th>Nome variabile</Th>
                <Th>Scope</Th>
                <Th>Stato</Th>
                <Th>Ultima rotazione</Th>
              </tr>
            </thead>
            <tbody>
              {ENV_VARS.map((envVar) => {
                const scope = SCOPE_BADGE[envVar.scope];
                const status = ENV_STATUS_BADGE[envVar.status];
                return (
                  <tr key={envVar.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <Td>
                      <span className="mono" style={{ fontWeight: 600 }}>
                        {envVar.name}
                      </span>
                    </Td>
                    <Td>
                      <span className={`badge ${scope.class}`}>{scope.label}</span>
                    </Td>
                    <Td>
                      <span className={`badge ${status.class}`}>{status.label}</span>
                    </Td>
                    <Td muted>{envVar.rotatedAt ?? '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack stack-4">
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Feature flags</h2>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            {FEATURE_FLAGS.filter((f) => f.enabled).length} attive · {FEATURE_FLAGS.length} totali
          </span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack stack-2">
          {FEATURE_FLAGS.map((flag) => {
            const rollout = ROLLOUT_BADGE[flag.rollout];
            return (
              <li
                key={flag.key}
                className="surface-flat"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 'var(--space-4)',
                  alignItems: 'center',
                  padding: 'var(--space-4) var(--space-5)',
                }}
              >
                <div className="stack stack-2">
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {flag.key}
                  </span>
                  <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {flag.description}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Scope: {flag.scope}
                  </span>
                </div>
                <span className={`badge ${rollout.class}`}>{rollout.label}</span>
                <FeatureFlagToggle
                  flagKey={flag.key}
                  description={flag.description}
                  initialEnabled={flag.enabled}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card stack stack-4">
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Background jobs</h2>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            {CRON_JOBS.filter((j) => j.status === 'success').length} OK ·{' '}
            {CRON_JOBS.filter((j) => j.status === 'failed').length} failed ·{' '}
            {CRON_JOBS.filter((j) => j.status === 'running').length} running
          </span>
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
              Background job schedulati con cron schedule, durata e stato dell&apos;ultima
              esecuzione.
            </caption>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <Th>Job</Th>
                <Th>Schedule</Th>
                <Th>Ultima esecuzione</Th>
                <Th>Durata</Th>
                <Th>Stato</Th>
              </tr>
            </thead>
            <tbody>
              {CRON_JOBS.map((job) => {
                const status = CRON_STATUS_BADGE[job.status];
                return (
                  <tr key={job.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <Td>
                      <div className="stack stack-2">
                        <span className="mono" style={{ fontWeight: 600 }}>
                          {job.name}
                        </span>
                        <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                          {job.description}
                        </span>
                      </div>
                    </Td>
                    <Td mono>{job.schedule}</Td>
                    <Td muted>{job.lastRunAt}</Td>
                    <Td mono>{job.duration}</Td>
                    <Td>
                      <span className={`badge ${status.class}`}>{status.label}</span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack stack-4">
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Database</h2>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            Postgres 16 · Supabase EU-central · ultima migration{' '}
            <span className="mono">20260507_add_voice_quota_columns.sql</span> applicata 07/05
          </span>
        </div>

        <div className="kpi-grid" style={{ marginBottom: 0 }}>
          <article className="kpi">
            <span className="kpi-label">Tabelle</span>
            <span className="kpi-value">{DB_TABLES.length}</span>
          </article>
          <article className="kpi">
            <span className="kpi-label">Righe totali</span>
            <span className="kpi-value">{TOTAL_ROWS.toLocaleString('it-IT')}</span>
          </article>
          <article className="kpi">
            <span className="kpi-label">Migrations applicate</span>
            <span className="kpi-value">42</span>
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
              ultima 07/05/2026
            </span>
          </article>
          <article className="kpi">
            <span className="kpi-label">Storage usato</span>
            <span className="kpi-value">8,2 GB</span>
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
              su 100 GB · 8,2%
            </span>
          </article>
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
              Tabelle del database con conteggio righe correnti.
            </caption>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <Th>Tabella</Th>
                <Th align="right">Righe</Th>
              </tr>
            </thead>
            <tbody>
              {DB_TABLES.map((table) => (
                <tr key={table.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <Td>
                    <span className="mono">{table.name}</span>
                  </Td>
                  <Td align="right" mono>
                    {table.rows}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Th({
  children,
  align,
}: Readonly<{ children: React.ReactNode; align?: 'left' | 'right' }>) {
  return (
    <th
      style={{
        textAlign: align ?? 'left',
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
  align,
}: Readonly<{
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
  align?: 'left' | 'right';
}>) {
  const className = [mono ? 'mono' : null, muted ? 'muted' : null].filter(Boolean).join(' ');
  return (
    <td
      className={className || undefined}
      style={{
        padding: 'var(--space-3) var(--space-4)',
        fontSize: mono || muted ? 'var(--text-xs)' : 'var(--text-sm)',
        textAlign: align ?? 'left',
      }}
    >
      {children}
    </td>
  );
}
