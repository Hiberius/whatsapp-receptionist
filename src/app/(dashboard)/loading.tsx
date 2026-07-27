/**
 * Skeleton dell'area autenticata. Sta al livello del gruppo `(dashboard)` così
 * ogni schermata ha uno stato di caricamento coerente senza doverlo ridichiarare.
 * Struttura volutamente neutra: intestazione, riga di KPI, contenuto a due colonne.
 */
const KPI_PLACEHOLDERS = ['kpi-1', 'kpi-2', 'kpi-3', 'kpi-4'] as const;
const ROW_PLACEHOLDERS = ['row-1', 'row-2', 'row-3', 'row-4'] as const;

export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Caricamento dei dati in corso</span>

      <div className="dashboard-header" aria-hidden="true">
        <div className="stack stack-2" style={{ flex: 1 }}>
          <SkeletonBlock width="120px" height="14px" />
          <SkeletonBlock width="min(320px, 60%)" height="34px" />
          <SkeletonBlock width="min(240px, 45%)" height="16px" />
        </div>
      </div>

      <div className="kpi-grid" aria-hidden="true">
        {KPI_PLACEHOLDERS.map((key) => (
          <article className="kpi" key={key}>
            <SkeletonBlock width="60%" height="12px" />
            <SkeletonBlock width="45%" height="30px" />
            <SkeletonBlock width="80%" height="14px" />
          </article>
        ))}
      </div>

      <div className="dashboard-content-grid" aria-hidden="true">
        <section className="card stack stack-4">
          <SkeletonBlock width="40%" height="22px" />
          <div className="stack stack-3">
            {ROW_PLACEHOLDERS.map((key) => (
              <SkeletonBlock key={key} width="100%" height="60px" radius="var(--radius-md)" />
            ))}
          </div>
        </section>

        <aside className="stack stack-4">
          <div className="card stack stack-3">
            <SkeletonBlock width="50%" height="12px" />
            <SkeletonBlock width="35%" height="28px" />
            <SkeletonBlock width="90%" height="14px" />
            <SkeletonBlock width="100%" height="6px" radius="var(--radius-full)" />
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes dashboardSkeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }

        @media (prefers-reduced-motion: reduce) {
          .dashboard-skeleton { animation: none; }
        }
      `}</style>
    </div>
  );
}

function SkeletonBlock({
  width,
  height,
  radius = 'var(--radius-sm)',
}: Readonly<{ width: string; height: string; radius?: string }>) {
  return (
    <span
      className="dashboard-skeleton"
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        background: 'var(--color-surface-sunken)',
        animation:
          'dashboardSkeletonPulse calc(var(--duration-slow) * 3) ease-in-out infinite alternate',
      }}
    />
  );
}
