'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary del pannello cross-tenant.
 *
 * Sostituisce l'error boundary globale per le rotte admin: qui il fallimento
 * più probabile non è un bug applicativo ma una dipendenza che non risponde
 * (database o provider esterno). Il messaggio lo dice esplicitamente invece di
 * suggerire che il dato mostrato prima fosse valido.
 */
export default function AdminError({ error, reset }: Readonly<AdminErrorProps>) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Errore · Admin';
    return () => {
      document.title = previousTitle;
    };
  }, [error]);

  return (
    <div className="stack stack-6">
      <div className="stack stack-2">
        <span className="badge badge-danger">Errore</span>
        <h1>Pannello non disponibile</h1>
        <p className="muted">
          Il caricamento dei dati cross-tenant è fallito. Nessun valore viene mostrato: preferiamo
          una pagina vuota a numeri non verificati.
        </p>
      </div>

      <section className="card stack stack-4">
        <p style={{ fontSize: 'var(--text-sm)' }}>
          Cause tipiche: database Supabase non raggiungibile, credenziali di servizio non
          configurate, o timeout di un provider esterno. Lo stato delle singole dipendenze è
          consultabile anche fuori dal pannello, su <code className="mono">/api/health/deep</code>.
        </p>

        {error.digest ? (
          <p className="muted mono" style={{ fontSize: 'var(--text-xs)' }}>
            Riferimento errore: {error.digest}
          </p>
        ) : null}

        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <button type="button" onClick={reset} className="btn btn-primary">
            Riprova
          </button>
          <Link href="/admin" className="btn btn-secondary">
            Torna alla overview
          </Link>
          <Link href="/status" className="btn btn-ghost">
            Stato dipendenze
          </Link>
        </div>
      </section>
    </div>
  );
}
