'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary dell'area autenticata. Resta dentro la shell della dashboard,
 * quindi l'utente mantiene la navigazione laterale invece di essere buttato
 * sulla pagina di errore globale.
 */
export default function DashboardError({ error, reset }: Readonly<DashboardErrorProps>) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Errore · Ambrogio.ai';

    return () => {
      document.title = previousTitle;
    };
  }, [error]);

  return (
    <section className="card card-padded stack stack-4" role="alert">
      <div className="stack stack-2">
        <span className="eyebrow">Errore</span>
        <h1 style={{ fontSize: 'var(--text-2xl)' }}>Non siamo riusciti a caricare questi dati.</h1>
        <p className="muted">
          Il problema è dalla nostra parte, non dalla tua: nessuna conversazione è andata persa e
          Ambrogio continua a rispondere su WhatsApp. Riprova tra qualche secondo.
        </p>
      </div>

      {error.digest ? (
        <p className="muted mono" style={{ fontSize: 'var(--text-xs)' }}>
          Riferimento errore: {error.digest}
        </p>
      ) : null}

      <div className="row" style={{ gap: 'var(--space-3)' }}>
        <button type="button" onClick={reset} className="btn btn-primary">
          Riprova
        </button>
        <Link href="/dashboard" className="btn btn-secondary">
          Torna alla panoramica
        </Link>
        <Link href="/help" className="btn btn-ghost">
          Contattaci
        </Link>
      </div>
    </section>
  );
}
