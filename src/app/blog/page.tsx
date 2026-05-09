import type { Metadata } from 'next';
import Link from 'next/link';

import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  JsonLd,
} from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

export const metadata: Metadata = {
  title: 'Blog · Reception AI che funziona davvero',
  description:
    'Case study, guide tecniche, opinioni. Niente fluff marketing — solo cose utili a chi gestisce davvero un business in Italia.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Blog · Ambrogio.ai',
    description: 'Case study, guide tecniche, opinioni. Solo cose utili.',
    url: '/blog',
    type: 'website',
    locale: 'it_IT',
  },
};

const POSTS = [
  {
    slug: 'come-uno-studio-dentistico-recupera-12k-anno',
    title: 'Come uno studio dentistico recupera €12k/anno con la reception AI',
    excerpt:
      'Caso reale: Studio Dentistico Rossi di Milano, 38% di booking notturni in più nei primi 90 giorni.',
    date: '5 maggio 2026',
    readTime: '6 min',
    category: 'Case study',
  },
  {
    slug: 'whatsapp-business-vs-360dialog-quando-conviene',
    title: 'WhatsApp Cloud API vs 360dialog: quando conviene cosa',
    excerpt: 'Confronto tecnico ed economico tra l’API ufficiale Meta e i BSP italiani più usati.',
    date: '2 maggio 2026',
    readTime: '8 min',
    category: 'Guida',
  },
  {
    slug: 'gdpr-receptionist-ai-dpa-template',
    title: 'GDPR e receptionist AI: il DPA che serve davvero',
    excerpt: 'Cosa deve contenere un DPA per essere utile in caso di audit. Template scaricabile.',
    date: '28 aprile 2026',
    readTime: '12 min',
    category: 'GDPR',
  },
] as const;

export default async function BlogPage() {
  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Blog', url: '/blog' },
        ])}
      />
      <JsonLd
        data={buildCollectionPageSchema({
          name: 'Blog Ambrogio.ai',
          description: 'Case study, guide tecniche e opinioni dal mondo reception AI italiana.',
          url: '/blog',
          hasPart: POSTS.map((p) => ({ name: p.title, url: `/blog/${p.slug}` })),
        })}
      />
      <SiteHeader />
      <main id="main">
        <section className="section">
          <div className="container">
            <div
              className="stack stack-4"
              style={{ maxWidth: '720px', marginBottom: 'var(--space-12)' }}
            >
              <span className="badge">Blog</span>
              <h1 className="display text-balance">
                Storie di studi che hanno smesso di perdere chiamate.
              </h1>
              <p className="lead text-pretty">
                Case study, guide tecniche, opinioni. Niente fluff marketing — solo cose utili a chi
                gestisce davvero un business.
              </p>
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
            >
              {POSTS.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="card card-padded card-interactive stack stack-4"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="row" style={{ gap: 'var(--space-3)' }}>
                    <span className="badge badge-neutral">{post.category}</span>
                    <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                      {post.date} · {post.readTime}
                    </span>
                  </div>
                  <h2 style={{ fontSize: 'var(--text-xl)' }}>{post.title}</h2>
                  <p style={{ color: 'var(--color-text-secondary)' }}>{post.excerpt}</p>
                  <span
                    className="row"
                    style={{
                      gap: 'var(--space-2)',
                      color: 'var(--color-accent)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      marginTop: 'auto',
                    }}
                  >
                    Leggi articolo <span aria-hidden="true">&rarr;</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
