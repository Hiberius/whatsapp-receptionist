'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global client-side error boundary.
 *
 * Since error.tsx is a client component it cannot export `metadata`.
 * We inject `noindex` and a contextual title into the document head on mount
 * so SERPs do not capture transient error states.
 */
export default function GlobalError({ error, reset }: Readonly<ErrorPageProps>) {
  useEffect(() => {
    // Le digest sono disponibili lato client per matching con i log server.
    // Niente console.log su PII; il logger server gestisce il dettaglio.

    // Inject noindex meta + custom title for crawlers that may still pick up
    // this rendered output. Cleaned up on unmount to avoid leaking state.
    const previousTitle = document.title;
    document.title = 'Errore · Ambrogio.ai';

    const robotsMeta = document.createElement('meta');
    robotsMeta.setAttribute('name', 'robots');
    robotsMeta.setAttribute('content', 'noindex, nofollow, noarchive');
    document.head.appendChild(robotsMeta);

    return () => {
      document.title = previousTitle;
      robotsMeta.remove();
    };
  }, [error]);

  return (
    <main
      id="main"
      style={{
        minHeight: '70vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-section) 0',
        background: 'var(--color-bg)',
      }}
    >
      <div className="container-narrow stack stack-6 text-center">
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-5xl)',
            fontWeight: 700,
            color: 'var(--color-danger)',
          }}
          aria-hidden="true"
        >
          ⚠
        </span>
        <div className="stack stack-3" style={{ alignItems: 'center' }}>
          <h1 className="text-balance">Qualcosa è andato storto.</h1>
          <p className="lead text-pretty">
            Abbiamo già ricevuto la segnalazione e ci stiamo lavorando. Nel frattempo, prova a
            ricaricare. Se persiste, scrivici dal centro assistenza.
          </p>
          {error.digest ? (
            <p className="muted mono" style={{ fontSize: 'var(--text-xs)' }}>
              Riferimento errore: {error.digest}
            </p>
          ) : null}
        </div>
        <div className="row" style={{ gap: 'var(--space-3)', justifyContent: 'center' }}>
          <button type="button" onClick={reset} className="btn btn-primary btn-lg">
            Riprova
          </button>
          <Link href="/" className="btn btn-secondary btn-lg">
            Torna alla home
          </Link>
          <Link href="/help" className="btn btn-ghost btn-lg">
            Contattaci
          </Link>
        </div>
      </div>
    </main>
  );
}
