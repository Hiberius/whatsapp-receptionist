import type { Metadata } from 'next';

import {
  KnowledgeDocumentArchiveButton,
  KnowledgeDocumentForm,
} from '@/components/dashboard/KnowledgeDocumentForm';
import { requireSession } from '@/lib/auth/session';
import { AppError } from '@/lib/errors/app-error';
import {
  createKnowledgeBaseDocumentService,
  type KnowledgeBaseDocument,
} from '@/server/knowledge-base/documents';

export const metadata: Metadata = {
  title: 'Knowledge base · Ambrogio.ai',
};

const DOCUMENT_LIMIT = 100;
const EXCERPT_LENGTH = 240;

/** Solo owner e admin possono scrivere: il servizio rifiuta gli altri ruoli. */
const EDITOR_ROLES = new Set(['owner', 'admin']);

type LoadResult =
  | {
      readonly ok: true;
      readonly documents: readonly KnowledgeBaseDocument[];
      readonly canEdit: boolean;
    }
  | { readonly ok: false; readonly message: string };

async function loadKnowledgeBase(): Promise<LoadResult> {
  try {
    const session = await requireSession();
    const service = createKnowledgeBaseDocumentService();
    const documents = await service.listDocuments({
      session,
      filters: { limit: DOCUMENT_LIMIT },
    });

    return { ok: true, documents, canEdit: EDITOR_ROLES.has(session.role) };
  } catch (error: unknown) {
    // I messaggi non `expose` (503, errori Supabase) non sono mostrabili:
    // servirebbe solo a esporre dettagli interni senza aiutare chi legge.
    const message =
      error instanceof AppError && error.expose
        ? error.message
        : 'Non è stato possibile caricare la knowledge base. Ricarica la pagina; se il problema resta, il servizio dati non è raggiungibile.';

    return { ok: false, message };
  }
}

export default async function KnowledgePage() {
  const result = await loadKnowledgeBase();

  return (
    <>
      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">Knowledge base</span>
          <h1>Quello che l’assistente sa del tuo studio</h1>
          <p className="muted" style={{ maxWidth: '60ch' }}>
            Ogni documento viene indicizzato e recuperato quando un cliente fa una domanda
            pertinente. Senza documenti l’assistente risponde solo in modo generico.
          </p>
        </div>
      </div>

      {result.ok ? (
        <KnowledgeBaseContent documents={result.documents} canEdit={result.canEdit} />
      ) : (
        <div className="card card-padded" role="alert">
          <div className="stack stack-2">
            <p style={{ fontWeight: 600 }}>Knowledge base non disponibile</p>
            <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              {result.message}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function KnowledgeBaseContent({
  documents,
  canEdit,
}: Readonly<{ documents: readonly KnowledgeBaseDocument[]; canEdit: boolean }>) {
  const activeCount = documents.filter((doc) => doc.active).length;
  const notIndexedCount = documents.filter((doc) => doc.active && !doc.hasEmbedding).length;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 'var(--space-6)',
        alignItems: 'start',
      }}
    >
      <section className="stack stack-4" aria-labelledby="knowledge-list-heading">
        <div className="row row-between">
          <h2 id="knowledge-list-heading" style={{ fontSize: 'var(--text-lg)' }}>
            Documenti
          </h2>
          {documents.length > 0 ? (
            <span className="muted mono" style={{ fontSize: 'var(--text-xs)' }}>
              {activeCount} attivi su {documents.length}
            </span>
          ) : null}
        </div>

        {notIndexedCount > 0 ? (
          <div className="card card-padded" role="status">
            <p style={{ fontSize: 'var(--text-sm)' }}>
              <strong>{notIndexedCount}</strong>{' '}
              {notIndexedCount === 1 ? 'documento attivo non è' : 'documenti attivi non sono'}{' '}
              indicizzato per la ricerca semantica. L’assistente non{' '}
              {notIndexedCount === 1 ? 'lo' : 'li'} recupera finché l’indicizzazione non viene
              rigenerata.
            </p>
          </div>
        ) : null}

        {documents.length === 0 ? (
          <EmptyKnowledgeBase canEdit={canEdit} />
        ) : (
          <ul className="stack stack-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {documents.map((doc) => (
              <li key={doc.id}>
                <KnowledgeDocumentCard document={doc} canEdit={canEdit} />
              </li>
            ))}
          </ul>
        )}

        {documents.length >= DOCUMENT_LIMIT ? (
          <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            Mostriamo i {DOCUMENT_LIMIT} documenti aggiornati più di recente.
          </p>
        ) : null}
      </section>

      <section className="card card-padded stack stack-4" aria-labelledby="knowledge-form-heading">
        <div className="stack stack-2">
          <h2 id="knowledge-form-heading" style={{ fontSize: 'var(--text-lg)' }}>
            Aggiungi un documento
          </h2>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Testo semplice. Niente allegati: quello che scrivi qui è esattamente quello che
            l’assistente può citare.
          </p>
        </div>

        {canEdit ? (
          <KnowledgeDocumentForm />
        ) : (
          <p className="helper">
            Il tuo ruolo consente la sola lettura. Chiedi a un amministratore dello studio di
            aggiungere o modificare i documenti.
          </p>
        )}
      </section>
    </div>
  );
}

function KnowledgeDocumentCard({
  document: doc,
  canEdit,
}: Readonly<{ document: KnowledgeBaseDocument; canEdit: boolean }>) {
  return (
    <article className="card card-padded stack stack-3">
      <div className="row row-between" style={{ gap: 'var(--space-3)' }}>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>{doc.title}</h3>
          {doc.category !== null ? (
            <span className="badge badge-neutral">{doc.category}</span>
          ) : null}
        </div>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {!doc.active ? (
            <span className="badge badge-neutral">Archiviato</span>
          ) : doc.hasEmbedding ? (
            <span className="badge badge-success">Indicizzato</span>
          ) : (
            <span className="badge badge-warm">Non indicizzato</span>
          )}
        </div>
      </div>

      <p className="muted" style={{ fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap' }}>
        {toExcerpt(doc.content)}
      </p>

      <div className="row row-between" style={{ gap: 'var(--space-3)' }}>
        <span className="muted mono" style={{ fontSize: 'var(--text-xs)' }}>
          Aggiornato il {formatDate(doc.updatedAt)}
        </span>
        {canEdit ? (
          <KnowledgeDocumentArchiveButton
            documentId={doc.id}
            title={doc.title}
            active={doc.active}
          />
        ) : null}
      </div>
    </article>
  );
}

function EmptyKnowledgeBase({ canEdit }: Readonly<{ canEdit: boolean }>) {
  return (
    <div className="card">
      <div className="empty-state">
        <p className="empty-state-title">Nessun documento, nessuna fonte di verità</p>
        <p className="empty-state-text">
          Finché questa lista è vuota l’assistente può rispondere solo in modo generico: non conosce
          i tuoi prezzi, i tuoi orari né le tue regole.
        </p>
        <ul
          className="stack stack-2"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 'var(--space-4) 0 0',
            textAlign: 'left',
            maxWidth: '46ch',
            fontSize: 'var(--text-sm)',
          }}
        >
          <li>
            <strong>Listino</strong> — prestazioni e prezzi, con eventuali fasce o pacchetti.
          </li>
          <li>
            <strong>Politica di disdetta</strong> — entro quante ore, con quale penale, e le
            eccezioni.
          </li>
          <li>
            <strong>Come raggiungere lo studio</strong> — indirizzo, piano, parcheggio, mezzi.
          </li>
          <li>
            <strong>Domande frequenti</strong> — quelle che ti fanno ogni settimana al telefono.
          </li>
        </ul>
        {canEdit ? (
          <p className="helper" style={{ marginTop: 'var(--space-4)' }}>
            Inizia dal riquadro qui a fianco: un documento basta per cambiare la qualità delle
            risposte.
          </p>
        ) : (
          <p className="helper" style={{ marginTop: 'var(--space-4)' }}>
            Chiedi a un amministratore dello studio di caricare il primo documento.
          </p>
        )}
      </div>
    </div>
  );
}

function toExcerpt(content: string): string {
  const normalized = content.trim();

  if (normalized.length <= EXCERPT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, EXCERPT_LENGTH).trimEnd()}…`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Rome',
});

function formatDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'data non disponibile';
  }

  return DATE_FORMATTER.format(parsed);
}
