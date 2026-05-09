import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Components Preview · Dev',
  robots: { index: false, follow: false },
};

/**
 * Component gallery — visibile solo in dev.
 * Permette di ispezionare tutti i pattern del design system.
 */
export default function ComponentsPreviewPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <main
      id="main"
      className="container"
      style={{ paddingBlock: 'var(--space-12)', maxWidth: '1080px' }}
    >
      <div className="stack stack-12">
        <div className="stack stack-3">
          <span className="badge badge-warm">Dev only</span>
          <h1 className="display">Component Gallery</h1>
          <p className="lead">
            Tutti i pattern del design system in una sola pagina. Visibile solo in dev.
          </p>
        </div>

        <Section title="Typography">
          <h1>Heading H1 default</h1>
          <h2>Heading H2 default</h2>
          <h3>Heading H3 default</h3>
          <h4>Heading H4 default</h4>
          <p className="display">Display class</p>
          <p className="lead">Lead paragraph for hero introductions and key messages.</p>
          <p>
            Paragrafo body standard. <strong>Bold</strong>, <em>italic</em>, e{' '}
            <a href="#" className="btn-link">
              link inline
            </a>
            .
          </p>
          <p className="muted">Muted text for secondary content.</p>
          <p className="mono">.mono class for technical IDs and timestamps.</p>
          <span className="eyebrow">Eyebrow accent</span>
        </Section>

        <Section title="Buttons">
          <div className="row">
            <button type="button" className="btn btn-primary">
              Primary
            </button>
            <button type="button" className="btn btn-primary btn-lg">
              Primary lg
            </button>
            <button type="button" className="btn btn-primary btn-sm">
              Primary sm
            </button>
            <button type="button" className="btn btn-secondary">
              Secondary
            </button>
            <button type="button" className="btn btn-ghost">
              Ghost
            </button>
            <a href="#" className="btn-link">
              Link button
            </a>
          </div>
        </Section>

        <Section title="Badges">
          <div className="row">
            <span className="badge">Default</span>
            <span className="badge badge-warm">Warm</span>
            <span className="badge badge-success">Success</span>
            <span className="badge badge-danger">Danger</span>
            <span className="badge badge-neutral">Neutral</span>
          </div>
        </Section>

        <Section title="Cards">
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
          >
            <article className="card stack stack-2">
              <h3>Card base</h3>
              <p className="muted">Bordo + radius + padding default.</p>
            </article>
            <article className="card card-padded stack stack-2">
              <h3>Card padded</h3>
              <p className="muted">Padding XL.</p>
            </article>
            <article className="card card-interactive stack stack-2">
              <h3>Card interactive</h3>
              <p className="muted">Hover lift + shadow.</p>
            </article>
            <article className="surface-raised stack stack-2" style={{ padding: 'var(--space-6)' }}>
              <h3>Surface raised</h3>
              <p className="muted">Background con shadow medium.</p>
            </article>
          </div>
        </Section>

        <Section title="KPI">
          <div className="kpi-grid">
            <article className="kpi">
              <span className="kpi-label">Conversazioni</span>
              <span className="kpi-value">1.247</span>
              <span className="kpi-trend kpi-trend-up">↑ +12%</span>
            </article>
            <article className="kpi">
              <span className="kpi-label">MRR</span>
              <span className="kpi-value">€11.450</span>
              <span className="kpi-trend kpi-trend-up">↑ +€990</span>
            </article>
            <article className="kpi">
              <span className="kpi-label">Churn</span>
              <span className="kpi-value">2.1%</span>
              <span className="kpi-trend kpi-trend-down">↓ -0.4%</span>
            </article>
          </div>
        </Section>

        <Section title="Forms">
          <form className="stack stack-4" style={{ maxWidth: '420px' }}>
            <div className="field">
              <label htmlFor="demo-input" className="label">
                Input testuale
              </label>
              <input id="demo-input" type="text" className="input" placeholder="Placeholder" />
              <p className="helper">Helper text sotto il campo.</p>
            </div>
            <div className="field">
              <label htmlFor="demo-select" className="label">
                Select
              </label>
              <select id="demo-select" className="select">
                <option>Opzione 1</option>
                <option>Opzione 2</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="demo-textarea" className="label">
                Textarea
              </label>
              <textarea id="demo-textarea" className="textarea" rows={3} />
            </div>
          </form>
        </Section>

        <Section title="Empty state">
          <div
            className="card empty-state"
            style={{ minHeight: '240px', justifyContent: 'center' }}
          >
            <span aria-hidden="true" style={{ fontSize: 'var(--text-3xl)' }}>
              ◇
            </span>
            <h3 className="empty-state-title">Niente da mostrare</h3>
            <p className="empty-state-text">
              Quando ci saranno conversazioni o appuntamenti li vedrai qui.
            </p>
            <button type="button" className="btn btn-primary btn-sm">
              Crea il primo
            </button>
          </div>
        </Section>

        <Section title="Color palette">
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
          >
            {(
              [
                ['accent', 'var(--color-accent)'],
                ['accent-soft', 'var(--color-accent-soft)'],
                ['accent-warm', 'var(--color-accent-warm)'],
                ['success', 'var(--color-success)'],
                ['warning', 'var(--color-warning)'],
                ['danger', 'var(--color-danger)'],
                ['info', 'var(--color-info)'],
                ['surface', 'var(--color-surface)'],
                ['surface-sunken', 'var(--color-surface-sunken)'],
                ['border', 'var(--color-border)'],
                ['border-strong', 'var(--color-border-strong)'],
                ['text', 'var(--color-text)'],
              ] as const
            ).map(([name, value]) => (
              <div key={name} className="stack stack-2">
                <div
                  style={{
                    height: '64px',
                    background: value,
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                  aria-hidden="true"
                />
                <p style={{ fontSize: 'var(--text-xs)' }}>
                  <span className="mono">{name}</span>
                </p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="stack stack-4">
      <h2 style={{ fontSize: 'var(--text-2xl)' }}>{title}</h2>
      <div className="card card-padded">{children}</div>
    </section>
  );
}
