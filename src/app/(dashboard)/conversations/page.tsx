import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conversazioni · Ambrogio.ai',
};

const SAMPLE_CONVERSATIONS = [
  {
    id: 'c1',
    customer: 'Anna Rossi',
    channel: 'WhatsApp',
    lastMessage: 'Perfetto, allora a lunedì alle 14:00. Grazie!',
    timestamp: '2 min fa',
    status: 'closed',
    aiHandled: true,
  },
  {
    id: 'c2',
    customer: '+39 333 1234567',
    channel: 'WhatsApp',
    lastMessage: '[Vocale 0:23] Buongiorno volevo chiedere...',
    timestamp: '14 min fa',
    status: 'in_progress',
    aiHandled: true,
  },
  {
    id: 'c3',
    customer: 'Marco Bianchi',
    channel: 'WhatsApp',
    lastMessage: 'Quanto costa la pulizia dei denti?',
    timestamp: '1h fa',
    status: 'in_progress',
    aiHandled: true,
  },
  {
    id: 'c4',
    customer: 'Giulia Verdi',
    channel: 'WhatsApp',
    lastMessage: 'Vorrei parlare con la dottoressa, è urgente',
    timestamp: '2h fa',
    status: 'escalated',
    aiHandled: false,
  },
] as const;

const STATUS_CONFIG = {
  closed: { label: 'Chiusa', badge: 'badge-success' },
  in_progress: { label: 'In corso', badge: 'badge' },
  escalated: { label: 'Escalation', badge: 'badge-danger' },
} as const;

export default function ConversationsPage() {
  return (
    <>
      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">Conversazioni</span>
          <h1>Tutto quello che è successo</h1>
        </div>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <label htmlFor="conversations-search" className="sr-only">
            Cerca conversazione per nome, numero o parola chiave
          </label>
          <input
            id="conversations-search"
            type="search"
            placeholder="Cerca per nome, numero, parola chiave"
            className="input"
            style={{ minWidth: '280px' }}
          />
          <button type="button" className="btn btn-secondary">
            Filtra
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {SAMPLE_CONVERSATIONS.map((conv, index) => {
            const status = STATUS_CONFIG[conv.status];
            return (
              <li
                key={conv.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-4) var(--space-6)',
                  borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                  cursor: 'pointer',
                  transition: 'background var(--duration-normal) var(--ease-out)',
                }}
                tabIndex={0}
              >
                <div className="stack stack-2">
                  <div className="row" style={{ gap: 'var(--space-3)' }}>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{conv.customer}</p>
                    <span className="badge badge-neutral">{conv.channel}</span>
                    {conv.aiHandled ? (
                      <span className="badge">AI</span>
                    ) : (
                      <span className="badge badge-warm">Umano</span>
                    )}
                  </div>
                  <p
                    className="muted"
                    style={{
                      fontSize: 'var(--text-sm)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '600px',
                    }}
                  >
                    {conv.lastMessage}
                  </p>
                </div>
                <div
                  className="stack stack-2"
                  style={{ alignItems: 'flex-end', textAlign: 'right' }}
                >
                  <span className={`badge ${status.badge}`}>{status.label}</span>
                  <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                    {conv.timestamp}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p
        className="muted text-center"
        style={{ marginTop: 'var(--space-6)', fontSize: 'var(--text-sm)' }}
      >
        Mostriamo le ultime 4 conversazioni · Storico completo presto disponibile.
      </p>
    </>
  );
}
