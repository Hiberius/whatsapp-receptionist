import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buildArticleSchema, buildBreadcrumbSchema, JsonLd } from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

import { ARTICLES, type HelpArticle } from './articles-data';

export function generateStaticParams() {
  return Object.keys(ARTICLES).map((slug) => ({ slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES[slug];
  if (!article) {
    return {
      title: 'Articolo non trovato',
      robots: { index: false, follow: false },
    };
  }
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/help/articles/${article.slug}` },
    openGraph: {
      title: `${article.title} · Centro assistenza Ambrogio.ai`,
      description: article.description,
      type: 'article',
      url: `/help/articles/${article.slug}`,
      locale: 'it_IT',
    },
  };
}

export default async function HelpArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = ARTICLES[slug];
  if (!article) {
    notFound();
  }

  const articleSchema = buildArticleSchema({
    headline: article.title,
    description: article.description,
    datePublished: '2026-05-08',
    url: `/help/articles/${article.slug}`,
    category: article.category,
  });

  const relatedArticles = article.related
    .map((relSlug) => ARTICLES[relSlug])
    .filter((a): a is HelpArticle => a !== undefined);

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Centro assistenza', url: '/help' },
          { name: article.title, url: `/help/articles/${article.slug}` },
        ])}
      />
      <SiteHeader />
      <main id="main">
        <article className="section">
          <div className="container-narrow stack stack-6">
            <div className="stack stack-3">
              <Link href="/help" className="btn-link" style={{ fontSize: 'var(--text-sm)' }}>
                ← Centro assistenza
              </Link>
              <span className="badge badge-neutral">{article.category}</span>
              <h1 className="text-balance">{article.title}</h1>
            </div>
            <hr className="divider" />
            <div
              style={{
                fontSize: 'var(--text-base)',
                lineHeight: 'var(--leading-relaxed)',
                color: 'var(--color-text-secondary)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {article.body}
            </div>
            <hr className="divider" />

            {relatedArticles.length > 0 && (
              <section className="stack stack-3" aria-labelledby="related-heading">
                <h2 id="related-heading" style={{ fontSize: 'var(--text-lg)' }}>
                  Articoli correlati
                </h2>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)',
                  }}
                >
                  {relatedArticles.map((rel) => (
                    <li key={rel.slug}>
                      <Link
                        href={`/help/articles/${rel.slug}`}
                        className="btn-link"
                        style={{ fontSize: 'var(--text-sm)' }}
                      >
                        → {rel.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div
              className="card stack stack-3"
              style={{ background: 'var(--color-surface-sunken)' }}
            >
              <h3 style={{ fontSize: 'var(--text-lg)' }}>Non hai trovato risposta?</h3>
              <Link href="/contact" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                Contattaci →
              </Link>
            </div>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
