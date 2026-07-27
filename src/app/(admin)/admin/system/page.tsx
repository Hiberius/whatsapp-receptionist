import type { Metadata } from 'next';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { type AppEnv, env } from '@/lib/env';
import {
  type HealthCheck,
  type HealthStatus,
  overallStatus,
  runHealthChecks,
} from '@/lib/health/checks';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import vercelConfig from '../../../../../vercel.json';

export const metadata: Metadata = {
  title: 'Sistema · Admin',
  robots: { index: false, follow: false },
};

/**
 * Nessuna cache: un pannello di monitoraggio che serve una misurazione vecchia
 * afferma qualcosa di falso sul presente.
 */
export const dynamic = 'force-dynamic';

// --------------------------------------------------------------------------
// Configurazione runtime
// --------------------------------------------------------------------------

interface RuntimeVar {
  readonly key: keyof AppEnv;
  readonly area: string;
  readonly required: boolean;
}

/**
 * Variabili di configurazione mostrate nel pannello.
 *
 * Ogni chiave esiste nello schema Zod di `src/lib/env.ts`: il pannello riporta
 * solo se il valore è valorizzato, mai il valore stesso. Le date di rotazione
 * non compaiono perché il sistema non le registra da nessuna parte.
 */
const RUNTIME_VARS: readonly RuntimeVar[] = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', area: 'Database', required: true },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', area: 'Database', required: true },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', area: 'Database', required: true },
  { key: 'SUPABASE_DB_URL', area: 'Database', required: false },
  { key: 'INTERNAL_JOB_SECRET', area: 'Job interni', required: true },
  { key: 'CRON_SECRET', area: 'Job interni', required: false },
  { key: 'ANTHROPIC_API_KEY', area: 'Motore AI', required: true },
  { key: 'ANTHROPIC_MODEL_PRIMARY', area: 'Motore AI', required: true },
  { key: 'ANTHROPIC_MODEL_FAST', area: 'Motore AI', required: true },
  { key: 'OPENAI_API_KEY', area: 'Motore AI', required: false },
  { key: 'UPSTASH_REDIS_REST_URL', area: 'Rate limiting', required: true },
  { key: 'UPSTASH_REDIS_REST_TOKEN', area: 'Rate limiting', required: true },
  { key: 'WHATSAPP_API_KEY', area: 'WhatsApp', required: true },
  { key: 'WHATSAPP_WEBHOOK_HEADER_SECRET', area: 'WhatsApp', required: true },
  { key: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', area: 'WhatsApp', required: false },
  { key: 'ELEVENLABS_API_KEY', area: 'Voce', required: false },
  { key: 'STRIPE_SECRET_KEY', area: 'Fatturazione', required: true },
  { key: 'STRIPE_WEBHOOK_SECRET', area: 'Fatturazione', required: true },
  { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', area: 'Fatturazione', required: false },
  { key: 'STRIPE_PRICE_STARTER', area: 'Fatturazione', required: false },
  { key: 'STRIPE_PRICE_PROFESSIONAL', area: 'Fatturazione', required: false },
  { key: 'FATTUREINCLOUD_API_TOKEN', area: 'Fatturazione', required: false },
  { key: 'FATTUREINCLOUD_COMPANY_ID', area: 'Fatturazione', required: false },
  { key: 'GOOGLE_OAUTH_CLIENT_ID', area: 'Calendario', required: false },
  { key: 'GOOGLE_OAUTH_CLIENT_SECRET', area: 'Calendario', required: false },
  { key: 'GOOGLE_OAUTH_STATE_SECRET', area: 'Calendario', required: false },
  { key: 'GOOGLE_CALENDAR_REDIRECT_URI', area: 'Calendario', required: false },
  { key: 'INTEGRATION_CREDENTIALS_ENCRYPTION_KEY', area: 'Calendario', required: false },
];

/**
 * Interruttori di comportamento realmente letti a runtime. Sono variabili di
 * ambiente, non flag persistiti: cambiano solo con un nuovo deploy, quindi qui
 * sono in sola lettura. Un toggle cliccabile suggerirebbe un controllo che il
 * sistema non ha.
 */
const RUNTIME_SWITCHES: readonly { key: keyof AppEnv; label: string; description: string }[] = [
  {
    key: 'AMBROGIO_AI_AUTOREPLY_ENABLED',
    label: 'Risposta automatica AI',
    description:
      'Interruttore globale. Se disattivato nessun tenant riceve risposte automatiche, anche con la risposta automatica abilitata nelle proprie impostazioni.',
  },
  {
    key: 'ELEVENLABS_ENABLE_LOGGING',
    label: 'Logging ElevenLabs',
    description: 'Consente al provider di conservare gli audio inviati. Rilevante ai fini GDPR.',
  },
];

function isConfigured(key: keyof AppEnv): boolean {
  const value = env[key];
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined;
}

// --------------------------------------------------------------------------
// Cron dichiarati
// --------------------------------------------------------------------------

interface DeclaredCron {
  readonly path: string;
  readonly schedule: string;
}

/**
 * Fonte autorevole della pianificazione: `vercel.json`. Importato invece di
 * essere ricopiato, così una modifica alla schedulazione non può divergere da
 * quanto mostrato qui.
 */
const DECLARED_CRONS: readonly DeclaredCron[] = vercelConfig.crons;

const CRON_PURPOSE: Record<string, string> = {
  '/api/internal/jobs/whatsapp-outbox':
    'Consegna i messaggi in uscita accodati in whatsapp_outbox_jobs.',
  '/api/internal/jobs/whatsapp-voice':
    'Trascrive i vocali in ingresso accodati in whatsapp_voice_jobs.',
  '/api/internal/jobs/whatsapp-template-sync':
    'Allinea i template WhatsApp approvati dal provider per un tenant.',
  '/api/internal/jobs/appointment-reminders': 'Invia i promemoria degli appuntamenti in scadenza.',
  '/api/internal/jobs/gdpr-hard-delete':
    'Esegue la cancellazione definitiva dei tenant oltre il periodo di conservazione (GDPR art. 17).',
};

/** Traduce le espressioni cron effettivamente usate; altrimenti mostra l'originale. */
function describeSchedule(expression: string): string {
  if (expression === '* * * * *') return 'ogni minuto';

  const everyNMinutes = /^\*\/(\d+) \* \* \* \*$/u.exec(expression);
  const minutesStep = everyNMinutes?.[1];
  if (minutesStep !== undefined) return `ogni ${minutesStep} minuti`;

  const dailyAt = /^(\d{1,2}) (\d{1,2}) \* \* \*$/u.exec(expression);
  const minute = dailyAt?.[1];
  const hour = dailyAt?.[2];
  if (minute !== undefined && hour !== undefined) {
    return `ogni giorno alle ${hour.padStart(2, '0')}:${minute.padStart(2, '0')} UTC`;
  }

  return expression;
}

// --------------------------------------------------------------------------
// Code di lavoro (unica traccia reale di attività dei worker)
// --------------------------------------------------------------------------

type QueueTable = 'whatsapp_outbox_jobs' | 'whatsapp_voice_jobs';

interface QueueSnapshot {
  readonly table: QueueTable;
  readonly label: string;
  readonly description: string;
  readonly pending: number;
  readonly blocked: number;
  readonly lastAttemptAt: string | null;
}

const QUEUES: readonly { table: QueueTable; label: string; description: string }[] = [
  {
    table: 'whatsapp_outbox_jobs',
    label: 'Messaggi in uscita',
    description: 'Lavorata dal cron whatsapp-outbox.',
  },
  {
    table: 'whatsapp_voice_jobs',
    label: 'Trascrizione vocali',
    description: 'Lavorata dal cron whatsapp-voice.',
  },
];

function readTimestampField(row: unknown, field: string): string | null {
  if (typeof row !== 'object' || row === null) return null;
  const value = (row as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : null;
}

/**
 * Legge lo stato reale di una coda.
 *
 * `last_attempt_at` è l'unico dato che il sistema registra sull'esecuzione dei
 * worker: non esiste una tabella di run dei cron, quindi questo è il sostituto
 * onesto di uno storico delle esecuzioni.
 *
 * @returns `null` se il database non risponde: l'assenza del dato va mostrata,
 * non sostituita con uno zero che sembrerebbe una coda vuota.
 */
async function loadQueueSnapshot(queue: (typeof QUEUES)[number]): Promise<QueueSnapshot | null> {
  try {
    const supabase = createSupabaseAdminClient();

    const [pending, blocked, lastAttempt] = await Promise.all([
      supabase
        .from(queue.table)
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'processing', 'retry']),
      supabase
        .from(queue.table)
        .select('id', { count: 'exact', head: true })
        .in('status', ['failed', 'dead_letter']),
      supabase
        .from(queue.table)
        .select('last_attempt_at')
        .not('last_attempt_at', 'is', null)
        .order('last_attempt_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (pending.error || blocked.error || lastAttempt.error) return null;

    return {
      table: queue.table,
      label: queue.label,
      description: queue.description,
      pending: pending.count ?? 0,
      blocked: blocked.count ?? 0,
      lastAttemptAt: readTimestampField(lastAttempt.data, 'last_attempt_at'),
    };
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// Presentazione
// --------------------------------------------------------------------------

const HEALTH_PRESENTATION: Record<HealthStatus, { label: string; badgeClass: string }> = {
  ok: { label: 'Operativo', badgeClass: 'badge-success' },
  degraded: { label: 'Degradato', badgeClass: 'badge-warm' },
  down: { label: 'Non raggiungibile', badgeClass: 'badge-danger' },
};

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'non disponibile';
  return parsed.toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Europe/Rome',
  });
}

function formatAge(iso: string, now: Date): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  const minutes = Math.floor((now.getTime() - parsed.getTime()) / 60_000);
  if (minutes < 1) return 'meno di un minuto fa';
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  return `${Math.floor(hours / 24)} g fa`;
}

export default async function AdminSystemPage() {
  await requireSuperAdmin();

  const [checks, queues] = await Promise.all([
    runHealthChecks(),
    Promise.all(QUEUES.map((queue) => loadQueueSnapshot(queue))),
  ]);

  const now = new Date();
  const overall = HEALTH_PRESENTATION[overallStatus(checks)];
  const missingRequired = RUNTIME_VARS.filter((item) => item.required && !isConfigured(item.key));
  const configuredCount = RUNTIME_VARS.filter((item) => isConfigured(item.key)).length;

  return (
    <div className="stack stack-8">
      <div className="stack stack-2">
        <span className="badge badge-warm">Cross-tenant</span>
        <h1>Sistema</h1>
        <p className="muted">
          Stato misurato delle dipendenze, configurazione runtime e code di lavoro. Ogni valore in
          questa pagina è rilevato al caricamento: nulla è dichiarato a mano.
        </p>
      </div>

      <section className="card stack stack-4">
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Dipendenze esterne</h2>
          <span className={`badge ${overall.badgeClass}`}>{overall.label}</span>
        </div>
        <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          Probe eseguite alle {formatDateTime(now.toISOString())} (fuso Europe/Rome). Stesso dato in
          formato macchina su <span className="mono">/api/health/deep</span>.
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack stack-2">
          {checks.map((check) => (
            <HealthRow key={check.name} check={check} />
          ))}
        </ul>
      </section>

      <section className="card stack stack-4">
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Configurazione runtime</h2>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            {configuredCount} su {RUNTIME_VARS.length} valorizzate
            {missingRequired.length > 0 ? ` · ${missingRequired.length} richieste mancanti` : ''}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          Il pannello mostra solo se una variabile è valorizzata, mai il suo contenuto. La data
          dell&apos;ultima rotazione non compare perché il sistema non la registra.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <caption className="sr-only">
              Variabili di configurazione runtime con area funzionale e stato di valorizzazione.
            </caption>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <Th>Variabile</Th>
                <Th>Area</Th>
                <Th>Stato</Th>
              </tr>
            </thead>
            <tbody>
              {RUNTIME_VARS.map((item) => {
                const configured = isConfigured(item.key);
                const badgeClass = configured
                  ? 'badge-success'
                  : item.required
                    ? 'badge-danger'
                    : 'badge-neutral';
                const label = configured
                  ? 'Valorizzata'
                  : item.required
                    ? 'Mancante'
                    : 'Non configurata';
                return (
                  <tr key={item.key} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <Td>
                      <span className="mono" style={{ fontWeight: 600 }}>
                        {item.key}
                      </span>
                    </Td>
                    <Td muted>{item.area}</Td>
                    <Td>
                      <span className={`badge ${badgeClass}`}>{label}</span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack stack-4">
        <h2 style={{ fontSize: 'var(--text-xl)' }}>Interruttori di comportamento</h2>
        <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          Definiti da variabili di ambiente e letti a ogni richiesta. Sono in sola lettura: si
          cambiano con un nuovo deploy, non da questa pagina.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack stack-2">
          {RUNTIME_SWITCHES.map((item) => {
            const enabled = env[item.key] === true;
            return (
              <li
                key={item.key}
                className="surface-flat"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 'var(--space-4)',
                  alignItems: 'center',
                  padding: 'var(--space-4) var(--space-5)',
                }}
              >
                <div className="stack stack-2">
                  <span style={{ fontWeight: 600 }}>{item.label}</span>
                  <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
                    {item.key}
                  </span>
                  <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {item.description}
                  </span>
                </div>
                <span className={`badge ${enabled ? 'badge-success' : 'badge-neutral'}`}>
                  {enabled ? 'Attivo' : 'Disattivo'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card stack stack-4">
        <div className="row-between">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Job schedulati</h2>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            {DECLARED_CRONS.length} job dichiarati
          </span>
        </div>
        <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          Questa tabella riporta la <strong>pianificazione dichiarata</strong> in{' '}
          <span className="mono">vercel.json</span>, non l&apos;esito dell&apos;ultima esecuzione:
          il sistema non registra uno storico dei run. L&apos;unica traccia reale di attività dei
          worker è nella sezione Code di lavoro qui sotto.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <caption className="sr-only">
              Job cron dichiarati nella configurazione di deploy con la relativa pianificazione.
            </caption>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <Th>Endpoint</Th>
                <Th>Pianificazione</Th>
                <Th>Frequenza</Th>
              </tr>
            </thead>
            <tbody>
              {DECLARED_CRONS.map((cron) => (
                <tr key={cron.path} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <Td>
                    <div className="stack stack-2">
                      <span className="mono" style={{ fontWeight: 600 }}>
                        {cron.path}
                      </span>
                      {CRON_PURPOSE[cron.path] ? (
                        <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                          {CRON_PURPOSE[cron.path]}
                        </span>
                      ) : null}
                    </div>
                  </Td>
                  <Td mono>{cron.schedule}</Td>
                  <Td muted>{describeSchedule(cron.schedule)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack stack-4">
        <h2 style={{ fontSize: 'var(--text-xl)' }}>Code di lavoro</h2>
        <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          Conteggi letti dalle tabelle di coda. Se l&apos;ultimo tentativo è molto più vecchio della
          frequenza del cron corrispondente, il worker non sta girando.
        </p>

        <div className="stack stack-3">
          {queues.map((snapshot, index) => {
            const queue = QUEUES[index];
            if (queue === undefined) return null;
            return <QueueCard key={queue.table} queue={queue} snapshot={snapshot} now={now} />;
          })}
        </div>
      </section>
    </div>
  );
}

function HealthRow({ check }: Readonly<{ check: HealthCheck }>) {
  const presentation = HEALTH_PRESENTATION[check.status];
  return (
    <li
      className="surface-flat"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 'var(--space-4)',
        alignItems: 'center',
        padding: 'var(--space-3) var(--space-5)',
      }}
    >
      <div className="stack stack-2">
        <span style={{ fontWeight: 500 }}>{check.label}</span>
        {check.details ? (
          <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
            {check.details}
          </span>
        ) : null}
      </div>
      <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
        {check.latencyMs === undefined ? '—' : `${check.latencyMs} ms`}
      </span>
      <span className={`badge ${presentation.badgeClass}`}>{presentation.label}</span>
    </li>
  );
}

function QueueCard({
  queue,
  snapshot,
  now,
}: Readonly<{
  queue: (typeof QUEUES)[number];
  snapshot: QueueSnapshot | null;
  now: Date;
}>) {
  if (snapshot === null) {
    return (
      <div className="surface-flat" style={{ padding: 'var(--space-4) var(--space-5)' }}>
        <div className="stack stack-2">
          <span style={{ fontWeight: 600 }}>{queue.label}</span>
          <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Conteggi non disponibili: la tabella <span className="mono">{queue.table}</span> non ha
            risposto. Verifica lo stato del database nella sezione Dipendenze esterne.
          </span>
        </div>
      </div>
    );
  }

  const isIdle = snapshot.pending === 0 && snapshot.blocked === 0;

  return (
    <div className="surface-flat" style={{ padding: 'var(--space-4) var(--space-5)' }}>
      <div className="stack stack-3">
        <div className="row-between">
          <div className="stack stack-2">
            <span style={{ fontWeight: 600 }}>{queue.label}</span>
            <span className="mono muted" style={{ fontSize: 'var(--text-xs)' }}>
              {queue.table} · {queue.description}
            </span>
          </div>
          {snapshot.blocked > 0 ? (
            <span className="badge badge-danger">{snapshot.blocked} bloccati</span>
          ) : null}
        </div>

        <div className="row" style={{ gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          <QueueStat label="In coda" value={String(snapshot.pending)} />
          <QueueStat label="Falliti o dead letter" value={String(snapshot.blocked)} />
          <QueueStat
            label="Ultimo tentativo registrato"
            value={
              snapshot.lastAttemptAt === null
                ? 'mai'
                : `${formatDateTime(snapshot.lastAttemptAt)} · ${formatAge(snapshot.lastAttemptAt, now)}`
            }
          />
        </div>

        {isIdle && snapshot.lastAttemptAt === null ? (
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Nessun lavoro mai transitato in questa coda. È lo stato atteso finché non arriva il
            primo messaggio WhatsApp su un tenant configurato.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function QueueStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="stack stack-2">
      <span
        className="muted"
        style={{
          fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{value}</span>
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
}: Readonly<{
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
}>) {
  const className = [mono ? 'mono' : null, muted ? 'muted' : null].filter(Boolean).join(' ');
  return (
    <td
      className={className || undefined}
      style={{
        padding: 'var(--space-3) var(--space-4)',
        fontSize: mono || muted ? 'var(--text-xs)' : 'var(--text-sm)',
        textAlign: 'left',
      }}
    >
      {children}
    </td>
  );
}
