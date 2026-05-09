import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/super-admin';

export const metadata: Metadata = {
  title: 'Dettaglio tenant · Admin',
  robots: { index: false, follow: false },
};

const TenantIdSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/u);

interface TenantUser {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'member';
  lastLogin: string;
}

interface AuditEntry {
  ts: string;
  action: string;
  target: string;
  user: string;
}

interface TenantDetail {
  id: string;
  name: string;
  vertical: string;
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  account: {
    legalName: string;
    pIva: string;
    sdiCode: string;
    address: string;
    contactEmail: string;
    ownerName: string;
    ownerEmail: string;
  };
  plan: {
    name: string;
    mrr: string;
    nextInvoiceDate: string;
    nextInvoiceAmount: string;
    paymentMethod: string;
    stripeCustomerId: string;
  };
  usage: {
    aiConversations: { value: string; limit: string };
    voiceMinutes: { value: string; limit: string };
    bookings: { value: string; limit: string };
  };
  integrations: {
    whatsapp: { connected: boolean; phone: string | null };
    googleCalendar: { connected: boolean; account: string | null };
    elevenlabs: { connected: boolean; voice: string | null };
    fattureInCloud: { connected: boolean; companyName: string | null };
  };
  team: TenantUser[];
  audit: AuditEntry[];
  created: string;
}

const TENANTS_DETAILS: Record<string, TenantDetail> = {
  t1: {
    id: 't1',
    name: 'Studio Dentistico Rossi',
    vertical: 'dental',
    status: 'active',
    account: {
      legalName: 'Studio Dentistico Rossi S.r.l.',
      pIva: 'IT04382910158',
      sdiCode: 'M5UXCR1',
      address: 'Via Garibaldi 14, 20121 Milano (MI)',
      contactEmail: 'amministrazione@studiorossi.it',
      ownerName: 'Dott. Marco Rossi',
      ownerEmail: 'm.rossi@studiorossi.it',
    },
    plan: {
      name: 'Professional',
      mrr: '€297',
      nextInvoiceDate: '12/06/2026',
      nextInvoiceAmount: '€362,34 (IVA inclusa)',
      paymentMethod: 'Visa •••• 4242',
      stripeCustomerId: 'cus_PqZxK2eR8nFkQp',
    },
    usage: {
      aiConversations: { value: '847', limit: '2.000' },
      voiceMinutes: { value: '124 min', limit: '300 min' },
      bookings: { value: '92', limit: 'illimitato' },
    },
    integrations: {
      whatsapp: { connected: true, phone: '+39 02 8765 4321' },
      googleCalendar: { connected: true, account: 'agenda@studiorossi.it' },
      elevenlabs: { connected: true, voice: 'Giulia (it-IT, calda)' },
      fattureInCloud: { connected: true, companyName: 'Studio Rossi S.r.l.' },
    },
    team: [
      {
        id: 'u_001',
        email: 'm.rossi@studiorossi.it',
        fullName: 'Marco Rossi',
        role: 'owner',
        lastLogin: '08/05/2026 09:14',
      },
      {
        id: 'u_002',
        email: 'reception@studiorossi.it',
        fullName: 'Anna Bianchi',
        role: 'admin',
        lastLogin: '08/05/2026 08:32',
      },
      {
        id: 'u_003',
        email: 'dr.verdi@studiorossi.it',
        fullName: 'Laura Verdi',
        role: 'member',
        lastLogin: '07/05/2026 19:48',
      },
      {
        id: 'u_004',
        email: 'igiene@studiorossi.it',
        fullName: 'Sara Ferri',
        role: 'member',
        lastLogin: '06/05/2026 14:22',
      },
    ],
    audit: [
      {
        ts: '08/05/2026 09:14',
        action: 'login',
        target: 'sessione web',
        user: 'm.rossi@studiorossi.it',
      },
      {
        ts: '08/05/2026 08:42',
        action: 'settings_change',
        target: 'orari apertura · venerdì',
        user: 'reception@studiorossi.it',
      },
      {
        ts: '07/05/2026 19:48',
        action: 'booking_created',
        target: 'appuntamento · pulizia · 14/05',
        user: 'AI agent',
      },
      {
        ts: '07/05/2026 16:10',
        action: 'integration_refresh',
        target: 'Google Calendar token',
        user: 'sistema',
      },
      {
        ts: '06/05/2026 11:03',
        action: 'kb_update',
        target: 'FAQ · prezzi pulizia',
        user: 'm.rossi@studiorossi.it',
      },
      {
        ts: '05/05/2026 22:18',
        action: 'voice_reply_sent',
        target: 'conversazione #4128',
        user: 'AI agent',
      },
      {
        ts: '05/05/2026 14:30',
        action: 'billing_event',
        target: 'fattura SDI #2026-042 emessa',
        user: 'sistema',
      },
      {
        ts: '04/05/2026 17:55',
        action: 'team_invite',
        target: 'igiene@studiorossi.it · role=member',
        user: 'm.rossi@studiorossi.it',
      },
      {
        ts: '03/05/2026 10:22',
        action: 'gdpr_export',
        target: 'export dati paziente · CF MRZL85...',
        user: 'reception@studiorossi.it',
      },
      {
        ts: '02/05/2026 09:01',
        action: 'login',
        target: 'sessione web',
        user: 'm.rossi@studiorossi.it',
      },
    ],
    created: '12/04/2026',
  },
  t2: {
    id: 't2',
    name: 'Beauty Center Roma',
    vertical: 'beauty',
    status: 'active',
    account: {
      legalName: 'Beauty Center Roma S.r.l.s.',
      pIva: 'IT15782039004',
      sdiCode: 'KRRH6B9',
      address: 'Via del Corso 121, 00186 Roma (RM)',
      contactEmail: 'info@beautyromacenter.it',
      ownerName: 'Giulia Esposito',
      ownerEmail: 'g.esposito@beautyromacenter.it',
    },
    plan: {
      name: 'Starter',
      mrr: '€97',
      nextInvoiceDate: '01/06/2026',
      nextInvoiceAmount: '€118,34 (IVA inclusa)',
      paymentMethod: 'SEPA •••• 8821',
      stripeCustomerId: 'cus_OnL7qR2vN8eKpX',
    },
    usage: {
      aiConversations: { value: '312', limit: '500' },
      voiceMinutes: { value: '38 min', limit: '60 min' },
      bookings: { value: '47', limit: '100' },
    },
    integrations: {
      whatsapp: { connected: true, phone: '+39 06 4567 8910' },
      googleCalendar: { connected: true, account: 'prenotazioni@beautyromacenter.it' },
      elevenlabs: { connected: false, voice: null },
      fattureInCloud: { connected: false, companyName: null },
    },
    team: [
      {
        id: 'u_011',
        email: 'g.esposito@beautyromacenter.it',
        fullName: 'Giulia Esposito',
        role: 'owner',
        lastLogin: '08/05/2026 11:02',
      },
      {
        id: 'u_012',
        email: 'reception@beautyromacenter.it',
        fullName: 'Martina Lupo',
        role: 'admin',
        lastLogin: '08/05/2026 10:15',
      },
    ],
    audit: [
      {
        ts: '08/05/2026 11:02',
        action: 'login',
        target: 'sessione web',
        user: 'g.esposito@beautyromacenter.it',
      },
      {
        ts: '08/05/2026 10:15',
        action: 'settings_change',
        target: 'risposta automatica · weekend',
        user: 'reception@beautyromacenter.it',
      },
      {
        ts: '07/05/2026 18:33',
        action: 'booking_created',
        target: 'manicure · 12/05 · 16:00',
        user: 'AI agent',
      },
      {
        ts: '06/05/2026 09:48',
        action: 'kb_update',
        target: 'listino trattamenti viso',
        user: 'g.esposito@beautyromacenter.it',
      },
      {
        ts: '05/05/2026 12:00',
        action: 'plan_change_requested',
        target: 'upgrade Starter → Professional',
        user: 'g.esposito@beautyromacenter.it',
      },
      {
        ts: '04/05/2026 19:22',
        action: 'login',
        target: 'sessione mobile',
        user: 'g.esposito@beautyromacenter.it',
      },
      {
        ts: '03/05/2026 14:11',
        action: 'voice_reply_sent',
        target: 'conversazione #882',
        user: 'AI agent',
      },
      {
        ts: '02/05/2026 08:55',
        action: 'integration_connected',
        target: 'Google Calendar',
        user: 'g.esposito@beautyromacenter.it',
      },
    ],
    created: '01/04/2026',
  },
};

const STATUS_BADGE = {
  active: { label: 'Attivo', class: 'badge-success' },
  trial: { label: 'Trial', class: 'badge-warm' },
  suspended: { label: 'Sospeso', class: 'badge-danger' },
  cancelled: { label: 'Cancellato', class: 'badge-neutral' },
} as const;

const ROLE_BADGE = {
  owner: { label: 'Owner', class: 'badge' },
  admin: { label: 'Admin', class: 'badge-warm' },
  member: { label: 'Member', class: 'badge-neutral' },
} as const;

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  settings_change: 'Settings change',
  booking_created: 'Booking created',
  integration_refresh: 'Integration refresh',
  integration_connected: 'Integration connected',
  kb_update: 'KB update',
  voice_reply_sent: 'Voice reply sent',
  billing_event: 'Billing event',
  team_invite: 'Team invite',
  gdpr_export: 'GDPR export',
  plan_change_requested: 'Plan change requested',
};

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function AdminTenantDetailPage({ params }: PageProps) {
  await requireSuperAdmin();

  const { tenantId } = await params;
  const parsed = TenantIdSchema.safeParse(tenantId);
  if (!parsed.success) {
    notFound();
  }

  const tenant = TENANTS_DETAILS[parsed.data];
  if (!tenant) {
    notFound();
  }

  const status = STATUS_BADGE[tenant.status];

  return (
    <div className="stack stack-8">
      <div className="stack stack-3">
        <Link href="/admin/tenants" className="btn-link" style={{ fontSize: 'var(--text-sm)' }}>
          ← Tutti i tenant
        </Link>
        <div className="row-between">
          <div className="stack stack-2">
            <div className="row" style={{ gap: 'var(--space-3)' }}>
              <span className="badge badge-warm">Cross-tenant</span>
              <span className={`badge ${status.class}`}>{status.label}</span>
              <span className="badge badge-neutral">{tenant.vertical}</span>
            </div>
            <h1>{tenant.name}</h1>
            <span className="mono muted" style={{ fontSize: 'var(--text-sm)' }}>
              {tenant.id} · iscritto il {tenant.created}
            </span>
          </div>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-secondary">
              Vedi log completi
            </button>
            <button type="button" className="btn btn-secondary">
              Gestisci billing
            </button>
            <button
              type="button"
              className="btn"
              style={{
                background: 'var(--color-danger-soft)',
                color: 'var(--color-danger)',
                borderColor: 'oklch(85% 0.06 27)',
              }}
            >
              Sospendi tenant
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        <section className="card stack stack-4">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Account</h2>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 'var(--space-5)',
              rowGap: 'var(--space-3)',
              fontSize: 'var(--text-sm)',
              margin: 0,
            }}
          >
            <DtRow label="Ragione sociale" value={tenant.account.legalName} />
            <DtRow label="P.IVA" value={tenant.account.pIva} mono />
            <DtRow label="Codice SDI" value={tenant.account.sdiCode} mono />
            <DtRow label="Indirizzo" value={tenant.account.address} />
            <DtRow label="Email principale" value={tenant.account.contactEmail} />
            <DtRow
              label="Owner"
              value={`${tenant.account.ownerName} · ${tenant.account.ownerEmail}`}
            />
          </dl>
        </section>

        <section className="card stack stack-4">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Plan & MRR</h2>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 'var(--space-5)',
              rowGap: 'var(--space-3)',
              fontSize: 'var(--text-sm)',
              margin: 0,
            }}
          >
            <DtRow label="Piano corrente" value={tenant.plan.name} />
            <DtRow label="MRR" value={tenant.plan.mrr} bold />
            <DtRow label="Prossima fattura" value={tenant.plan.nextInvoiceDate} />
            <DtRow label="Importo" value={tenant.plan.nextInvoiceAmount} />
            <DtRow label="Pagamento" value={tenant.plan.paymentMethod} mono />
            <DtRow label="Customer Stripe" value={tenant.plan.stripeCustomerId} mono />
          </dl>
        </section>
      </div>

      <section className="card stack stack-4">
        <h2 style={{ fontSize: 'var(--text-xl)' }}>Usage · Maggio 2026</h2>
        <div className="kpi-grid" style={{ marginBottom: 0 }}>
          <UsageCard
            label="Conversazioni AI"
            value={tenant.usage.aiConversations.value}
            limit={tenant.usage.aiConversations.limit}
          />
          <UsageCard
            label="Vocali trascritti"
            value={tenant.usage.voiceMinutes.value}
            limit={tenant.usage.voiceMinutes.limit}
          />
          <UsageCard
            label="Booking creati"
            value={tenant.usage.bookings.value}
            limit={tenant.usage.bookings.limit}
          />
        </div>
      </section>

      <section className="card stack stack-4">
        <h2 style={{ fontSize: 'var(--text-xl)' }}>Integrazioni</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack stack-2">
          <IntegrationRow
            name="WhatsApp Cloud API"
            connected={tenant.integrations.whatsapp.connected}
            detail={tenant.integrations.whatsapp.phone}
          />
          <IntegrationRow
            name="Google Calendar"
            connected={tenant.integrations.googleCalendar.connected}
            detail={tenant.integrations.googleCalendar.account}
          />
          <IntegrationRow
            name="ElevenLabs voice"
            connected={tenant.integrations.elevenlabs.connected}
            detail={tenant.integrations.elevenlabs.voice}
          />
          <IntegrationRow
            name="Fatture in Cloud"
            connected={tenant.integrations.fattureInCloud.connected}
            detail={tenant.integrations.fattureInCloud.companyName}
          />
        </ul>
      </section>

      <section className="card stack stack-4">
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Team ({tenant.team.length})</h2>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            Mostra max 5 utenti più recenti
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
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--color-border)',
                }}
              >
                <Th>Utente</Th>
                <Th>Email</Th>
                <Th>Ruolo</Th>
                <Th>Ultimo accesso</Th>
              </tr>
            </thead>
            <tbody>
              {tenant.team.slice(0, 5).map((member) => {
                const role = ROLE_BADGE[member.role];
                return (
                  <tr key={member.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <Td>
                      <span style={{ fontWeight: 600 }}>{member.fullName}</span>
                    </Td>
                    <Td>
                      <span className="mono" style={{ fontSize: 'var(--text-xs)' }}>
                        {member.email}
                      </span>
                    </Td>
                    <Td>
                      <span className={`badge ${role.class}`}>{role.label}</span>
                    </Td>
                    <Td muted>{member.lastLogin}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack stack-4">
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Audit recente</h2>
          <Link
            href={`/admin/audit?tenant=${tenant.id}`}
            className="btn-link"
            style={{ fontSize: 'var(--text-sm)' }}
          >
            Vedi audit completo →
          </Link>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack stack-2">
          {tenant.audit.map((entry, idx) => (
            <li
              key={`${entry.ts}-${idx}`}
              className="surface-flat"
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 200px 1fr 200px',
                gap: 'var(--space-4)',
                alignItems: 'center',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
                {entry.ts}
              </span>
              <span style={{ fontWeight: 600 }}>{ACTION_LABELS[entry.action] ?? entry.action}</span>
              <span className="muted">{entry.target}</span>
              <span className="mono" style={{ fontSize: 'var(--text-xs)' }}>
                {entry.user}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DtRow({
  label,
  value,
  mono,
  bold,
}: Readonly<{ label: string; value: string; mono?: boolean; bold?: boolean }>) {
  return (
    <>
      <dt
        className="muted"
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
          paddingTop: '2px',
        }}
      >
        {label}
      </dt>
      <dd
        className={mono ? 'mono' : undefined}
        style={{
          margin: 0,
          fontWeight: bold ? 600 : 400,
        }}
      >
        {value}
      </dd>
    </>
  );
}

function UsageCard({
  label,
  value,
  limit,
}: Readonly<{ label: string; value: string; limit: string }>) {
  return (
    <article className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
        su {limit} inclusi
      </span>
    </article>
  );
}

function IntegrationRow({
  name,
  connected,
  detail,
}: Readonly<{ name: string; connected: boolean; detail: string | null }>) {
  return (
    <li
      className="surface-flat"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 120px',
        gap: 'var(--space-4)',
        alignItems: 'center',
        padding: 'var(--space-3) var(--space-4)',
      }}
    >
      <span style={{ fontWeight: 600 }}>{name}</span>
      <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
        {detail ?? '—'}
      </span>
      <span
        className={`badge ${connected ? 'badge-success' : 'badge-neutral'}`}
        style={{ justifySelf: 'end' }}
      >
        {connected ? 'Connesso' : 'Non connesso'}
      </span>
    </li>
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

function Td({ children, muted }: Readonly<{ children: React.ReactNode; muted?: boolean }>) {
  return (
    <td
      className={muted ? 'muted' : undefined}
      style={{
        padding: 'var(--space-3) var(--space-4)',
        fontSize: muted ? 'var(--text-xs)' : 'var(--text-sm)',
      }}
    >
      {children}
    </td>
  );
}
