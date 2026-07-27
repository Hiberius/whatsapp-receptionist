import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { OperatorReplyForm } from '@/components/dashboard/OperatorReplyForm';
import { requireSession, type AuthSession } from '@/lib/auth/session';
import { AppError } from '@/lib/errors/app-error';
import {
  createConversationInboxService,
  type ConversationChannel,
  type ConversationDetail,
  type ConversationMessage,
  type ConversationStatus,
} from '@/server/conversations/inbox';
import { CUSTOMER_SERVICE_WINDOW_MS } from '@/server/conversations/operator-messages';
import { createWhatsAppOptOutService } from '@/server/whatsapp/opt-outs';

export const metadata: Metadata = {
  title: 'Conversazione · Ambrogio.ai',
};

// `listMessages` accetta al massimo 200 messaggi per conversazione.
const MESSAGE_LIMIT = 200;

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

const SENDER_STYLES: Record<
  ConversationMessage['senderType'],
  { label: string; align: 'flex-start' | 'flex-end' | 'center'; background: string; border: string }
> = {
  customer: {
    label: 'Cliente',
    align: 'flex-start',
    background: 'var(--color-surface-sunken)',
    border: '1px solid var(--color-border)',
  },
  ai: {
    label: 'Ambrogio AI',
    align: 'flex-end',
    background: 'var(--color-accent-soft)',
    border: '1px solid var(--color-accent-soft)',
  },
  human: {
    label: 'Operatore',
    align: 'flex-end',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-accent)',
  },
  system: {
    label: 'Sistema',
    align: 'center',
    background: 'transparent',
    border: '1px dashed var(--color-border)',
  },
};

const DELIVERY_LABELS: Record<ConversationMessage['status'], string | null> = {
  received: null,
  pending: 'in coda',
  sent: 'inviato',
  delivered: 'consegnato',
  read: 'letto',
  failed: 'invio fallito',
};

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  // Fuori dal try/catch: una sessione mancante deve propagare al guard.
  const session = await requireSession();
  const { conversationId } = await params;

  let detail: ConversationDetail | null = null;
  let failed = false;

  try {
    detail = await createConversationInboxService().getConversation({
      session,
      conversationId,
      messageLimit: MESSAGE_LIMIT,
    });
  } catch (error: unknown) {
    if (error instanceof AppError && error.code === 'not_found') {
      notFound();
    }

    failed = true;
  }

  if (failed || detail === null) {
    return (
      <>
        <BackLink />
        <div className="card card-padded stack stack-3" role="alert">
          <h1 style={{ fontSize: 'var(--text-xl)' }}>Non riusciamo ad aprire la conversazione</h1>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Il servizio non ha risposto. Ricarica la pagina: se il problema resta, controlla lo
            stato del sistema.
          </p>
          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <Link href={`/conversations/${conversationId}`} className="btn btn-secondary btn-sm">
              Riprova
            </Link>
            <Link href="/status" className="btn btn-ghost btn-sm">
              Stato del servizio
            </Link>
          </div>
        </div>
      </>
    );
  }

  const { conversation, messages } = detail;
  const statusConfig = STATUS_LABELS[conversation.status];
  const isAdmin = session.role === 'owner' || session.role === 'admin';

  // Stesso calcolo del servizio di invio: finestra 24h dall'ultimo messaggio.
  const windowExpiresAt = Date.parse(conversation.lastMessageAt) + CUSTOMER_SERVICE_WINDOW_MS;
  const isWindowKnown = Number.isFinite(windowExpiresAt);
  const isWindowOpen = isWindowKnown && windowExpiresAt > Date.now();

  const optedOut =
    isAdmin && conversation.channel === 'whatsapp'
      ? await readOptOut(session, conversation.customerIdentifier)
      : null;

  const disabledReason = resolveDisabledReason({
    isAdmin,
    channel: conversation.channel,
    optedOut,
    isWindowOpen,
  });

  return (
    <>
      <BackLink />

      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">Conversazione</span>
          <h1>{conversation.customerName ?? conversation.customerIdentifier}</h1>
          <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span className="badge badge-neutral">{CHANNEL_LABELS[conversation.channel]}</span>
            <span className={statusConfig.badge}>{statusConfig.label}</span>
            {conversation.aiEnabled ? (
              <span className="badge">AI attiva</span>
            ) : (
              <span className="badge badge-warm">Solo operatore</span>
            )}
            {optedOut === true ? (
              <span className="badge badge-danger">Consenso revocato</span>
            ) : null}
          </div>
          <p className="muted mono" style={{ fontSize: 'var(--text-xs)' }}>
            {conversation.customerIdentifier}
          </p>
        </div>

        <div className="stack stack-2" style={{ textAlign: 'right' }}>
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            Ultimo messaggio
          </span>
          <time dateTime={conversation.lastMessageAt} style={{ fontWeight: 600 }}>
            {formatDateTime(conversation.lastMessageAt)}
          </time>
        </div>
      </div>

      {conversation.channel === 'whatsapp' ? (
        <div
          className="card card-padded stack stack-2"
          style={{
            marginBottom: 'var(--space-6)',
            background: isWindowOpen ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
            borderColor: isWindowOpen ? 'var(--color-success)' : 'var(--color-warning)',
          }}
        >
          <span className="eyebrow">Finestra di servizio WhatsApp</span>
          {isWindowKnown ? (
            <p style={{ fontSize: 'var(--text-sm)' }}>
              {isWindowOpen ? (
                <>
                  Aperta fino al{' '}
                  <strong>{formatDateTime(new Date(windowExpiresAt).toISOString())}</strong>. Entro
                  questo orario puoi scrivere un messaggio libero.
                </>
              ) : (
                <>
                  Chiusa dal{' '}
                  <strong>{formatDateTime(new Date(windowExpiresAt).toISOString())}</strong>. Fuori
                  dalle 24 ore WhatsApp consente solo template approvati, non ancora supportati:
                  potrai rispondere quando il cliente scriverà di nuovo.
                </>
              )}
            </p>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)' }}>Scadenza della finestra non disponibile.</p>
          )}
          {optedOut === true ? (
            <p style={{ fontSize: 'var(--text-sm)' }}>
              Il cliente ha revocato il consenso: nessun messaggio può essergli inviato finché non
              lo ripristina scrivendo di nuovo.
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="card card-padded stack stack-4" aria-label="Cronologia messaggi">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">Nessun messaggio in archivio</p>
            <p className="empty-state-text">
              La conversazione esiste ma non ha ancora messaggi salvati. Se il cliente ha appena
              scritto, ricarica tra qualche istante.
            </p>
          </div>
        ) : (
          <ol className="stack stack-4" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </ol>
        )}

        {messages.length === MESSAGE_LIMIT ? (
          <p className="helper">Mostriamo i primi {MESSAGE_LIMIT} messaggi della conversazione.</p>
        ) : null}
      </section>

      <section
        className="stack stack-3"
        style={{ marginTop: 'var(--space-6)' }}
        aria-label="Risposta operatore"
      >
        <h2 style={{ fontSize: 'var(--text-lg)' }}>Rispondi come operatore</h2>
        <OperatorReplyForm conversationId={conversation.id} disabledReason={disabledReason} />
      </section>
    </>
  );
}

function BackLink() {
  return (
    <p style={{ marginBottom: 'var(--space-4)' }}>
      <Link href="/conversations" className="btn-link">
        ← Torna all’inbox
      </Link>
    </p>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const sender = SENDER_STYLES[message.senderType];
  const deliveryLabel = message.direction === 'outbound' ? DELIVERY_LABELS[message.status] : null;
  const body = readBody(message);

  return (
    <li style={{ display: 'flex', flexDirection: 'column', alignItems: sender.align }}>
      <div
        className="stack stack-2"
        style={{
          maxWidth: '68ch',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          background: sender.background,
          border: sender.border,
        }}
      >
        <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              letterSpacing: 'var(--tracking-wider)',
              textTransform: 'uppercase',
            }}
          >
            {sender.label}
          </span>
          <time
            dateTime={message.createdAt}
            className="muted"
            style={{ fontSize: 'var(--text-xs)' }}
          >
            {formatDateTime(message.createdAt)}
          </time>
          {deliveryLabel !== null ? (
            <span
              className="muted"
              style={{
                fontSize: 'var(--text-xs)',
                color: message.status === 'failed' ? 'var(--color-danger)' : undefined,
              }}
            >
              · {deliveryLabel}
            </span>
          ) : null}
          {message.intent !== null ? (
            <span className="badge badge-neutral mono">{message.intent}</span>
          ) : null}
        </div>

        {body.label !== null ? (
          <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            {body.label}
          </span>
        ) : null}

        {body.text !== null ? (
          <p style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>{body.text}</p>
        ) : (
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Contenuto testuale non disponibile.
          </p>
        )}

        {message.mediaUrls.length > 0 ? (
          <ul
            className="row"
            style={{ gap: 'var(--space-3)', flexWrap: 'wrap', listStyle: 'none', padding: 0 }}
          >
            {message.mediaUrls.map((url, index) => (
              <li key={`${url}-${index}`}>
                <a
                  href={url}
                  className="btn-link"
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ fontSize: 'var(--text-xs)' }}
                >
                  Allegato {index + 1}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function readBody(message: ConversationMessage): { text: string | null; label: string | null } {
  if (message.content !== null && message.content.trim().length > 0) {
    return { text: message.content, label: null };
  }

  if (message.transcriptText !== null && message.transcriptText.trim().length > 0) {
    return {
      text: message.transcriptText,
      label: formatVoiceLabel(message),
    };
  }

  if (message.messageType !== 'text') {
    return { text: null, label: `Messaggio di tipo ${message.messageType}` };
  }

  return { text: null, label: null };
}

function formatVoiceLabel(message: ConversationMessage): string {
  const duration =
    message.audioDurationSecs !== null && message.audioDurationSecs > 0
      ? ` · ${Math.round(message.audioDurationSecs)}s`
      : '';

  return `Trascrizione vocale${duration}`;
}

function resolveDisabledReason(input: {
  isAdmin: boolean;
  channel: ConversationChannel;
  optedOut: boolean | null;
  isWindowOpen: boolean;
}): string | null {
  if (!input.isAdmin) {
    return 'Solo owner e admin possono inviare messaggi manuali.';
  }

  if (input.channel !== 'whatsapp') {
    return 'L’invio manuale è disponibile solo sulle conversazioni WhatsApp.';
  }

  if (input.optedOut === true) {
    return 'Il cliente ha revocato il consenso: non è possibile inviargli messaggi.';
  }

  if (!input.isWindowOpen) {
    return 'La finestra di servizio 24 ore è chiusa. Potrai rispondere dopo un nuovo messaggio del cliente.';
  }

  return null;
}

async function readOptOut(
  session: AuthSession,
  customerIdentifier: string,
): Promise<boolean | null> {
  // Lo stato opt-out è un contorno: se il servizio non risponde o l'identifier
  // non è un numero valido, la pagina resta leggibile e l'invio viene comunque
  // rivalidato lato server.
  try {
    const status = await createWhatsAppOptOutService().getStatus({ session, customerIdentifier });

    return status.optedOut;
  } catch {
    return null;
  }
}

function formatDateTime(iso: string): string {
  const timestamp = Date.parse(iso);

  if (Number.isNaN(timestamp)) {
    return 'data non disponibile';
  }

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome',
  }).format(new Date(timestamp));
}
