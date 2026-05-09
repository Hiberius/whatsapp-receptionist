export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Caricamento in corso"
      style={{
        minHeight: '60vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-section) 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-accent)',
            animation: 'spin var(--duration-slow) linear infinite',
          }}
        />
        <span className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          Un attimo...
        </span>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
