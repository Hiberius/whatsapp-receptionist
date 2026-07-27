/**
 * Stato di caricamento del pannello cross-tenant.
 *
 * Le pagine admin eseguono probe di rete reali (health check dei provider) e
 * conteggi sul database: senza questo file la navigazione resta bloccata sulla
 * pagina precedente finché tutte le query non rispondono.
 */
export default function AdminLoading() {
  return (
    <div className="stack stack-8" role="status" aria-live="polite" aria-busy="true">
      <div className="stack stack-2">
        <span className="badge badge-warm">Cross-tenant</span>
        <h1 style={{ opacity: 0.5 }}>Caricamento…</h1>
        <p className="muted">Interrogazione di database e provider esterni in corso.</p>
      </div>

      <div
        className="card"
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '240px',
          gap: 'var(--space-4)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-full)',
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-accent)',
            animation: 'admin-spin var(--duration-slow) linear infinite',
          }}
        />
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Le misurazioni vengono eseguite a ogni caricamento, non lette da cache.
        </span>
      </div>

      <style>{`
        @keyframes admin-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
