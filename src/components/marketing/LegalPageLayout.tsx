import type { ReactNode } from 'react';

import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export interface LegalPageProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export function LegalPageLayout({ title, lastUpdated, children }: Readonly<LegalPageProps>) {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <article className="section">
          <div className="container-narrow stack stack-6">
            <div className="stack stack-2">
              <span className="eyebrow">Documenti legali</span>
              <h1 className="text-balance">{title}</h1>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Ultimo aggiornamento: {lastUpdated}
              </p>
            </div>
            <hr className="divider" />
            <div
              className="stack stack-6"
              style={{
                fontSize: 'var(--text-base)',
                lineHeight: 'var(--leading-relaxed)',
              }}
            >
              {children}
            </div>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
