import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin · Ambrogio.ai',
  robots: { index: false, follow: false },
};

const SYSTEM_STATS = [
  { label: 'Tenants attivi', value: '47', trend: '+3 questo mese' },
  { label: 'Utenti totali', value: '128', trend: '+12 questo mese' },
  { label: 'MRR', value: '€11.450', trend: '+€990' },
  { label: 'Conversazioni AI 24h', value: '2.847', trend: '+18% vs ieri' },
] as const;

const HEALTH_CHECKS = [
  { name: 'Database Postgres', status: 'healthy', latency: '12ms' },
  { name: 'Supabase Auth', status: 'healthy', latency: '24ms' },
  { name: 'Stripe API', status: 'healthy', latency: '180ms' },
  { name: 'WhatsApp Cloud API', status: 'healthy', latency: '95ms' },
  { name: 'Anthropic API', status: 'degraded', latency: '850ms' },
  { name: 'ElevenLabs API', status: 'healthy', latency: '320ms' },
  { name: 'Upstash Redis', status: 'healthy', latency: '8ms' },
  { name: 'Fatture in Cloud', status: 'healthy', latency: '420ms' },
] as const;

const STATUS_COLOR = {
  healthy: { color: 'var(--color-success)', label: '● Operativo' },
  degraded: { color: 'var(--color-warning)', label: '● Degradato' },
  down: { color: 'var(--color-danger)', label: '● Down' },
} as const;

export default function AdminOverviewPage() {
  return (
    <div className="stack stack-8">
      <div className="stack stack-2">
        <span className="badge badge-warm">Cross-tenant</span>
        <h1>Sistema Ambrogio.ai</h1>
        <p className="muted">Vista super-admin. Tutti i tenant, tutti gli utenti, tutto.</p>
      </div>

      <section className="kpi-grid">
        {SYSTEM_STATS.map((stat) => (
          <article key={stat.label} className="kpi">
            <span className="kpi-label">{stat.label}</span>
            <span className="kpi-value">{stat.value}</span>
            <span className="kpi-trend kpi-trend-up" style={{ fontSize: 'var(--text-xs)' }}>
              {stat.trend}
            </span>
          </article>
        ))}
      </section>

      <section className="card stack stack-4">
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Health checks</h2>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            Aggiornato 12s fa · auto-refresh ogni 30s
          </span>
        </div>

        <ul style={{ listStyle: 'none', padding: 0 }} className="stack stack-2">
          {HEALTH_CHECKS.map((check) => {
            const status = STATUS_COLOR[check.status];
            return (
              <li
                key={check.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 'var(--space-4)',
                  alignItems: 'center',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-sunken)',
                }}
              >
                <span style={{ fontWeight: 500 }}>{check.name}</span>
                <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
                  {check.latency}
                </span>
                <span
                  style={{
                    color: status.color,
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                  }}
                >
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        className="card"
        style={{
          background: 'var(--color-warning-soft)',
          borderColor: 'oklch(85% 0.06 70)',
        }}
      >
        <h3 style={{ fontSize: 'var(--text-lg)' }}>⚠ Anthropic API degradata</h3>
        <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
          Latency p95 a 850ms (target &lt;500ms). Auto-fallback OpenAI attivo per i tenant
          enterprise. Status page Anthropic:{' '}
          <a href="https://status.anthropic.com" className="btn-link">
            status.anthropic.com
          </a>
        </p>
      </section>
    </div>
  );
}
