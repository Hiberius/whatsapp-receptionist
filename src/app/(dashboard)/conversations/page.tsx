import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/auth/session';
import {
  createConversationInboxService,
  type ConversationChannel,
  type ConversationStatus,
  type ListConversationsResult,
} from '@/server/conversations/inbox';

export const metadata: Metadata = {
  title: 'Conversazioni · Ambrogio.ai',
};

const PAGE_SIZE = 30;

const STATUS_LABELS: Record<ConversationStatus, { label: string; badge: string }> = {
  active: { label: 'Attiva', badge: 'badge' },
  escalated: { label: 'Escalation', badge: 'badge badge-danger' },
  closed: { label: 'Chiusa', badge: 'badge badge-neutral' },
  spam: { label: 'Spam', badge: 'badge badge-warm' },
};

const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  whatsapp: 'WhatsApp',
  instagram_dm: 'Instagram DM',
  web_chat: 'Chat web',
  sms: 'SMS',
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // `requireSession` resta fuori dal try/catch: se la sessione manca deve
  // propagare al guard del layout, non diventare un errore di pagina.
  const session = await requireSession();
  const params = await searchParams;

  const status = readStatus(params.status);
  const channel = readChannel(params.channel);
  const before = readDate(params.before);

  let result: ListConversationsResult | null = null;
  let failed = false;

  try {
    result = await createConversationInboxService().listConversations({
      session,
      filters: {
        limit: PAGE_SIZE,
        ...(status !== null ? { status } : {}),
        ...(channel !== null ? { channel } : {}),
        before,
      },
    });
  } catch {
    failed = true;
  }

  const now = Date.now();
  const hasFilters = status !== null || channel !== null || before !== null;

  return (
    <>
      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">Conversazioni</span>
          <h1>Inbox</h1>
          <p className="muted">
            Ogni chat gestita da Ambrogio, con lo stato aggiornato. Apri una conversazione per
            leggere la cronologia e rispondere a mano.
          </p>
        </div>

        <form
          method="get"
          className="row"
          style={{ gap: 'var(--space-2)', alignItems: 'flex-end' }}
        >
          <div className="field">
            <label htmlFor="filter-status" className="label">
              Stato
            </label>
            <select
              id="filter-status"
              name="status"
              className="select"
              defaultValue={status ?? ''}
              style={{ minWidth: '160px' }}
            >
              <option value="">Tutti</option>
              {(Object.keys(STATUS_LABELS) as ConversationStatus[]).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value].label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-channel" className="label">
              Canale
            </label>
            <select
              id="filter-channel"
              name="channel"
              className="select"
              defaultValue={channel ?? ''}
              style={{ minWidth: '160px' }}
            >
              <option value="">Tutti</option>
              {(Object.keys(CHANNEL_LABELS) as ConversationChannel[]).map((value) => (
                <option key={value} value={value}>
                  {CHANNEL_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-secondary">
            Applica
          </button>
        </form>
      </div>

      {failed ? (
        <div className="card card-padded stack stack-3" role="alert">
          <h2 style={{ fontSize: 'var(--text-lg)' }}>Non riusciamo a caricare le conversazioni</h2>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Il servizio non ha risposto. Ricarica la pagina: se il problema resta, controlla lo
            stato del sistema.
          </p>
          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <Link href="/conversations" className="btn btn-secondary btn-sm">
              Riprova
            </Link>
            <Link href="/status" className="btn btn-ghost btn-sm">
              Stato del servizio
            </Link>
          </div>
        </div>
      ) : null}

      {!failed && result !== null && result.conversations.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p className="empty-state-title">
              {hasFilters
                ? 'Nessuna conversazione con questi filtri'
                : 'Ancora nessuna conversazione'}
            </p>
            <p className="empty-state-text">
              {hasFilters
                ? 'Prova ad allargare i filtri: potrebbero esserci chat in un altro stato o su un altro canale.'
                : 'Le conversazioni compaiono qui non appena un cliente scrive al numero WhatsApp collegato. Se non hai ancora collegato il numero, parti dalle impostazioni.'}
            </p>
            {hasFilters ? (
              <Link href="/conversations" className="btn btn-secondary btn-sm">
                Rimuovi i filtri
              </Link>
            ) : (
              <Link href="/settings" className="btn btn-primary btn-sm">
                Collega WhatsApp
              </Link>
            )}
          </div>
        </div>
      ) : null}

      {!failed && result !== null && result.conversations.length > 0 ? (
        <>
          {/* Niente `overflow: hidden`: l'outline di focus delle righe ha
              `outline-offset` e verrebbe tagliato dal contenitore. */}
          <div className="card" style={{ padding: 0 }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {result.conversations.map((conversation, index) => {
                const statusConfig = STATUS_LABELS[conversation.status];
                return (
                  <li
                    key={conversation.id}
                    style={{
                      borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                    }}
                  >
                    <Link
                      href={`/conversations/${conversation.id}`}
                      className="card-interactive"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 'var(--space-4)',
                        padding: 'var(--space-4) var(--space-6)',
                        border: 'none',
                        borderRadius: 0,
                        background: 'transparent',
                        color: 'inherit',
                      }}
                    >
                      <div className="stack stack-2">
                        <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
                            {conversation.customerName ?? conversation.customerIdentifier}
                          </span>
                          <span className="badge badge-neutral">
                            {CHANNEL_LABELS[conversation.channel]}
                          </span>
                          {conversation.aiEnabled ? (
                            <span className="badge">AI attiva</span>
                          ) : (
                            <span className="badge badge-warm">Solo operatore</span>
                          )}
                        </div>
                        {conversation.customerName !== null ? (
                          <span className="muted mono" style={{ fontSize: 'var(--text-xs)' }}>
                            {conversation.customerIdentifier}
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="stack stack-2"
                        style={{ alignItems: 'flex-end', textAlign: 'right' }}
                      >
                        <span className={statusConfig.badge}>{statusConfig.label}</span>
                        <time
                          dateTime={conversation.lastMessageAt}
                          className="muted"
                          style={{ fontSize: 'var(--text-xs)' }}
                        >
                          {formatRelative(conversation.lastMessageAt, now)}
                        </time>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div
            className="row-between"
            style={{ marginTop: 'var(--space-6)', gap: 'var(--space-4)', flexWrap: 'wrap' }}
          >
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              {result.conversations.length} conversazioni, dalla più recente.
            </p>
            <div className="row" style={{ gap: 'var(--space-3)' }}>
              {before !== null ? (
                <Link
                  href={buildHref({ status, channel, before: null })}
                  className="btn btn-ghost btn-sm"
                >
                  Torna alle più recenti
                </Link>
              ) : null}
              {result.nextCursor !== null ? (
                <Link
                  href={buildHref({ status, channel, before: result.nextCursor })}
                  className="btn btn-secondary btn-sm"
                >
                  Conversazioni più vecchie
                </Link>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function readStatus(value: string | string[] | undefined): ConversationStatus | null {
  const raw = typeof value === 'string' ? value : null;

  return raw !== null && raw in STATUS_LABELS ? (raw as ConversationStatus) : null;
}

function readChannel(value: string | string[] | undefined): ConversationChannel | null {
  const raw = typeof value === 'string' ? value : null;

  return raw !== null && raw in CHANNEL_LABELS ? (raw as ConversationChannel) : null;
}

function readDate(value: string | string[] | undefined): Date | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildHref(input: {
  status: ConversationStatus | null;
  channel: ConversationChannel | null;
  before: string | null;
}): string {
  const query = new URLSearchParams();

  if (input.status !== null) {
    query.set('status', input.status);
  }

  if (input.channel !== null) {
    query.set('channel', input.channel);
  }

  if (input.before !== null) {
    query.set('before', input.before);
  }

  const serialized = query.toString();

  return serialized.length > 0 ? `/conversations?${serialized}` : '/conversations';
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function formatRelative(iso: string, now: number): string {
  const timestamp = Date.parse(iso);

  if (Number.isNaN(timestamp)) {
    return 'data non disponibile';
  }

  const elapsed = now - timestamp;

  if (elapsed < MINUTE_MS) {
    return 'adesso';
  }

  if (elapsed < HOUR_MS) {
    return `${Math.floor(elapsed / MINUTE_MS)} min fa`;
  }

  if (elapsed < DAY_MS) {
    return `${Math.floor(elapsed / HOUR_MS)} h fa`;
  }

  if (elapsed < 7 * DAY_MS) {
    return `${Math.floor(elapsed / DAY_MS)} g fa`;
  }

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  }).format(new Date(timestamp));
}
