import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSuperAdmin } from '@/lib/auth/super-admin';

export const metadata: Metadata = {
  title: 'Billing · Admin',
  robots: { index: false, follow: false },
};

interface MrrPoint {
  month: string;
  mrr: number;
}

interface Invoice {
  id: string;
  number: string;
  tenantId: string;
  tenantName: string;
  amount: string;
  amountValue: number;
  issuedAt: string;
  stripeStatus: 'paid' | 'open' | 'past_due' | 'failed' | 'refunded';
  sdiStatus: 'sent' | 'pending' | 'rejected' | 'not_required';
}

const KPIS = [
  { label: 'MRR totale', value: '€11.450', trend: '+€990 vs Aprile (+9,5%)' },
  { label: 'ARR proiettato', value: '€137.400', trend: 'Run-rate attuale' },
  { label: 'Customer paganti', value: '38', trend: '+3 questo mese' },
  { label: 'Churn 30gg', value: '2,1%', trend: '−0,4% vs Aprile' },
  { label: 'Growth rate', value: '+12,4%', trend: '6 mesi consecutivi' },
] as const;

const MRR_HISTORY: MrrPoint[] = [
  { month: 'Dic', mrr: 6_820 },
  { month: 'Gen', mrr: 7_640 },
  { month: 'Feb', mrr: 8_910 },
  { month: 'Mar', mrr: 9_780 },
  { month: 'Apr', mrr: 10_460 },
  { month: 'Mag', mrr: 11_450 },
];

const INVOICES: Invoice[] = [
  {
    id: 'inv_001',
    number: '2026-0094',
    tenantId: 't1',
    tenantName: 'Studio Dentistico Rossi',
    amount: '€362,34',
    amountValue: 362.34,
    issuedAt: '07/05/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_002',
    number: '2026-0093',
    tenantId: 't5',
    tenantName: 'Mediagency XYZ',
    amount: '€1.094,34',
    amountValue: 1094.34,
    issuedAt: '05/05/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_003',
    number: '2026-0092',
    tenantId: 't3',
    tenantName: 'Fitness Studio Beta',
    amount: '€297,00',
    amountValue: 297.0,
    issuedAt: '03/05/2026',
    stripeStatus: 'paid',
    sdiStatus: 'not_required',
  },
  {
    id: 'inv_004',
    number: '2026-0091',
    tenantId: 't7',
    tenantName: 'Centro Riabilitazione Verona',
    amount: '€362,34',
    amountValue: 362.34,
    issuedAt: '02/05/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_005',
    number: '2026-0090',
    tenantId: 't13',
    tenantName: 'Studio Notarile Conti',
    amount: '€362,34',
    amountValue: 362.34,
    issuedAt: '01/05/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_006',
    number: '2026-0089',
    tenantId: 't2',
    tenantName: 'Beauty Center Roma',
    amount: '€118,34',
    amountValue: 118.34,
    issuedAt: '01/05/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_007',
    number: '2026-0088',
    tenantId: 't9',
    tenantName: 'Hotel Costa Smeralda',
    amount: '€1.094,34',
    amountValue: 1094.34,
    issuedAt: '30/04/2026',
    stripeStatus: 'past_due',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_008',
    number: '2026-0087',
    tenantId: 't11',
    tenantName: 'Boutique Hotel Cinque Terre',
    amount: '€362,34',
    amountValue: 362.34,
    issuedAt: '28/04/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_009',
    number: '2026-0086',
    tenantId: 't8',
    tenantName: 'Palestra Olimpia Milano',
    amount: '€118,34',
    amountValue: 118.34,
    issuedAt: '28/04/2026',
    stripeStatus: 'failed',
    sdiStatus: 'pending',
  },
  {
    id: 'inv_010',
    number: '2026-0085',
    tenantId: 't4',
    tenantName: 'Studio Bianchi & Associati',
    amount: '€362,34',
    amountValue: 362.34,
    issuedAt: '26/04/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_011',
    number: '2026-0084',
    tenantId: 't10',
    tenantName: 'Estetica Aurora',
    amount: '€118,34',
    amountValue: 118.34,
    issuedAt: '24/04/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_012',
    number: '2026-0083',
    tenantId: 't1',
    tenantName: 'Studio Dentistico Rossi',
    amount: '€362,34',
    amountValue: 362.34,
    issuedAt: '07/04/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_013',
    number: '2026-0082',
    tenantId: 't15',
    tenantName: 'Skill Seekers',
    amount: '€297,00',
    amountValue: 297.0,
    issuedAt: '06/04/2026',
    stripeStatus: 'paid',
    sdiStatus: 'not_required',
  },
  {
    id: 'inv_014',
    number: '2026-0081',
    tenantId: 't5',
    tenantName: 'Mediagency XYZ',
    amount: '€1.094,34',
    amountValue: 1094.34,
    issuedAt: '05/04/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_015',
    number: '2026-0080',
    tenantId: 't12',
    tenantName: 'Studio Veterinario Campo Marzio',
    amount: '€362,34',
    amountValue: 362.34,
    issuedAt: '04/04/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_016',
    number: '2026-0079',
    tenantId: 't3',
    tenantName: 'Fitness Studio Beta',
    amount: '€297,00',
    amountValue: 297.0,
    issuedAt: '03/04/2026',
    stripeStatus: 'paid',
    sdiStatus: 'not_required',
  },
  {
    id: 'inv_017',
    number: '2026-0078',
    tenantId: 't7',
    tenantName: 'Centro Riabilitazione Verona',
    amount: '€362,34',
    amountValue: 362.34,
    issuedAt: '02/04/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_018',
    number: '2026-0077',
    tenantId: 't14',
    tenantName: 'Pasticceria Mancini',
    amount: '€118,34',
    amountValue: 118.34,
    issuedAt: '02/04/2026',
    stripeStatus: 'refunded',
    sdiStatus: 'rejected',
  },
  {
    id: 'inv_019',
    number: '2026-0076',
    tenantId: 't13',
    tenantName: 'Studio Notarile Conti',
    amount: '€362,34',
    amountValue: 362.34,
    issuedAt: '01/04/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
  {
    id: 'inv_020',
    number: '2026-0075',
    tenantId: 't2',
    tenantName: 'Beauty Center Roma',
    amount: '€118,34',
    amountValue: 118.34,
    issuedAt: '01/04/2026',
    stripeStatus: 'paid',
    sdiStatus: 'sent',
  },
];

const STRIPE_BADGE = {
  paid: { label: 'Paid', class: 'badge-success' },
  open: { label: 'Open', class: 'badge-warm' },
  past_due: { label: 'Past due', class: 'badge-danger' },
  failed: { label: 'Failed', class: 'badge-danger' },
  refunded: { label: 'Refunded', class: 'badge-neutral' },
} as const;

const SDI_BADGE = {
  sent: { label: 'SDI inviata', class: 'badge-success' },
  pending: { label: 'SDI pending', class: 'badge-warm' },
  rejected: { label: 'SDI rifiutata', class: 'badge-danger' },
  not_required: { label: 'No SDI', class: 'badge-neutral' },
} as const;

export default async function AdminBillingPage() {
  await requireSuperAdmin();

  return (
    <div className="stack stack-8">
      <div className="stack stack-2">
        <span className="badge badge-warm">Cross-tenant</span>
        <h1>Billing</h1>
        <p className="muted">
          Vista finanziaria aggregata. Stripe live · Fatture in Cloud · SDI Italia.
        </p>
      </div>

      <section className="kpi-grid" style={{ marginBottom: 0 }}>
        {KPIS.map((kpi) => (
          <article key={kpi.label} className="kpi">
            <span className="kpi-label">{kpi.label}</span>
            <span className="kpi-value">{kpi.value}</span>
            <span className="kpi-trend kpi-trend-up" style={{ fontSize: 'var(--text-xs)' }}>
              {kpi.trend}
            </span>
          </article>
        ))}
      </section>

      <section className="card stack stack-4">
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>MRR · ultimi 6 mesi</h2>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            Snapshot fine mese · da Dicembre 2025 a Maggio 2026
          </span>
        </div>
        <MrrChart points={MRR_HISTORY} />
      </section>

      <section className="card stack stack-4" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          className="row-between"
          style={{
            padding: 'var(--space-5) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="stack stack-2">
            <h2 style={{ fontSize: 'var(--text-xl)' }}>Ultime fatture</h2>
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
              {INVOICES.length} fatture · €
              {INVOICES.reduce((acc, inv) => acc + inv.amountValue, 0)
                .toFixed(2)
                .replace('.', ',')}{' '}
              totale lordo
            </span>
          </div>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-secondary btn-sm">
              Export CSV
            </button>
            <button type="button" className="btn btn-secondary btn-sm">
              Sincronizza Fatture in Cloud
            </button>
          </div>
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
              Fatture cross-tenant con numero, tenant, importo, stato pagamento Stripe e stato SDI.
            </caption>
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--color-border)',
                  background: 'var(--color-surface-sunken)',
                }}
              >
                <Th>Numero</Th>
                <Th>Tenant</Th>
                <Th>Data</Th>
                <Th align="right">Importo</Th>
                <Th>Stripe</Th>
                <Th>SDI</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {INVOICES.map((invoice) => {
                const stripe = STRIPE_BADGE[invoice.stripeStatus];
                const sdi = SDI_BADGE[invoice.sdiStatus];
                return (
                  <tr key={invoice.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <Td>
                      <span className="mono" style={{ fontWeight: 600 }}>
                        {invoice.number}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/tenants/${invoice.tenantId}`}
                        className="btn-link"
                        style={{ fontSize: 'var(--text-sm)' }}
                      >
                        {invoice.tenantName}
                      </Link>
                    </Td>
                    <Td muted>{invoice.issuedAt}</Td>
                    <Td align="right" mono>
                      <span style={{ fontWeight: 600 }}>{invoice.amount}</span>
                    </Td>
                    <Td>
                      <span className={`badge ${stripe.class}`}>{stripe.label}</span>
                    </Td>
                    <Td>
                      <span className={`badge ${sdi.class}`}>{sdi.label}</span>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        className="btn-link"
                        aria-label={`Scarica PDF fattura ${invoice.number} di ${invoice.tenantName}`}
                      >
                        PDF →
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const CHART_WIDTH = 720;
const CHART_HEIGHT = 220;
const CHART_PAD_X = 48;
const CHART_PAD_TOP = 24;
const CHART_PAD_BOTTOM = 36;

function MrrChart({ points }: Readonly<{ points: ReadonlyArray<MrrPoint> }>) {
  if (points.length === 0) {
    return null;
  }

  const minMrr = Math.min(...points.map((p) => p.mrr));
  const maxMrr = Math.max(...points.map((p) => p.mrr));
  const yMin = Math.floor(minMrr / 1000) * 1000 - 1000;
  const yMax = Math.ceil(maxMrr / 1000) * 1000 + 1000;
  const yRange = yMax - yMin;
  const innerWidth = CHART_WIDTH - CHART_PAD_X * 2;
  const innerHeight = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;

  const xFor = (idx: number) => {
    if (points.length === 1) {
      return CHART_PAD_X + innerWidth / 2;
    }
    return CHART_PAD_X + (idx / (points.length - 1)) * innerWidth;
  };

  const yFor = (value: number) => {
    return CHART_PAD_TOP + innerHeight - ((value - yMin) / yRange) * innerHeight;
  };

  const linePath = points
    .map(
      (point, idx) =>
        `${idx === 0 ? 'M' : 'L'}${xFor(idx).toFixed(1)} ${yFor(point.mrr).toFixed(1)}`,
    )
    .join(' ');

  const areaPath = `${linePath} L${xFor(points.length - 1).toFixed(1)} ${yFor(yMin).toFixed(1)} L${xFor(0).toFixed(1)} ${yFor(yMin).toFixed(1)} Z`;

  const yTicks = [yMin, yMin + yRange * 0.25, yMin + yRange * 0.5, yMin + yRange * 0.75, yMax];

  return (
    <svg
      role="img"
      aria-label="Grafico MRR ultimi 6 mesi"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      style={{ width: '100%', height: 'auto', maxHeight: '280px' }}
    >
      <defs>
        <linearGradient id="mrr-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={CHART_PAD_X}
            x2={CHART_WIDTH - CHART_PAD_X}
            y1={yFor(tick)}
            y2={yFor(tick)}
            stroke="var(--color-border)"
            strokeDasharray="2 4"
          />
          <text
            x={CHART_PAD_X - 8}
            y={yFor(tick) + 3}
            textAnchor="end"
            fontSize="10"
            fontFamily="var(--font-mono)"
            fill="var(--color-text-muted)"
          >
            €{(tick / 1000).toFixed(0)}k
          </text>
        </g>
      ))}

      <path d={areaPath} fill="url(#mrr-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((point, idx) => (
        <g key={point.month}>
          <circle
            cx={xFor(idx)}
            cy={yFor(point.mrr)}
            r={idx === points.length - 1 ? 5 : 3.5}
            fill="var(--color-accent)"
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
          <text
            x={xFor(idx)}
            y={yFor(point.mrr) - 12}
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fontWeight="600"
            fill="var(--color-text)"
          >
            €{(point.mrr / 1000).toFixed(1)}k
          </text>
          <text
            x={xFor(idx)}
            y={CHART_HEIGHT - 12}
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-display)"
            fill="var(--color-text-muted)"
          >
            {point.month}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Th({
  children,
  align,
}: Readonly<{ children?: React.ReactNode; align?: 'left' | 'right' }>) {
  return (
    <th
      style={{
        textAlign: align ?? 'left',
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
        padding: 'var(--space-4) var(--space-5)',
        fontSize: muted ? 'var(--text-xs)' : 'var(--text-sm)',
        textAlign: align ?? 'left',
      }}
    >
      {children}
    </td>
  );
}
