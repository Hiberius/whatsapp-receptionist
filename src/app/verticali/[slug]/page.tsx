import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CtaSection } from '@/components/marketing/CtaSection';
import {
  buildBreadcrumbSchema,
  buildHowToSchema,
  buildServiceSchema,
  JsonLd,
} from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

import { VERTICALS_DATA } from './verticals-data';

export function generateStaticParams() {
  return Object.keys(VERTICALS_DATA).map((slug) => ({ slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = VERTICALS_DATA[slug];
  if (!data) {
    return {
      title: 'Verticale non trovato',
      robots: { index: false, follow: false },
    };
  }
  return {
    title: data.metaTitle,
    description: data.metaDescription,
    openGraph: {
      title: `${data.metaTitle} · Ambrogio.ai`,
      description: data.metaDescription,
      url: `/verticali/${data.slug}`,
      type: 'website',
      locale: 'it_IT',
    },
    alternates: { canonical: `/verticali/${data.slug}` },
  };
}

export default async function VerticalPage({ params }: PageProps) {
  const { slug } = await params;
  const data = VERTICALS_DATA[slug];
  if (!data) {
    notFound();
  }

  const otherVerticals = Object.values(VERTICALS_DATA).filter((v) => v.slug !== data.slug);

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Verticali', url: '/verticali' },
          { name: data.title, url: `/verticali/${data.slug}` },
        ])}
      />
      <JsonLd
        data={buildServiceSchema({
          name: `Ambrogio.ai per ${data.title}`,
          serviceType: data.serviceType,
          description: data.metaDescription,
          url: `/verticali/${data.slug}`,
        })}
      />
      <JsonLd
        data={buildHowToSchema({
          name: `Come funziona Ambrogio.ai per ${data.title}`,
          description: `Tre scenari tipici gestiti automaticamente da Ambrogio.ai per ${data.title}.`,
          steps: data.scenarios.map((s) => ({ name: s.title, text: s.body })),
        })}
      />
      <SiteHeader />
      <main id="main">
        <section className="hero" aria-labelledby="vertical-h1">
          <div className="container hero-grid">
            <div className="stack stack-6">
              <span className="hero-eyebrow">{data.hero.eyebrow}</span>
              <h1 id="vertical-h1" className="display text-balance">
                {data.hero.h1}
              </h1>
              <p className="lead text-pretty">{data.hero.body}</p>
              <div className="row" style={{ gap: 'var(--space-3)' }}>
                <Link href={`/register?vertical=${data.slug}`} className="btn btn-primary btn-lg">
                  Prova per il tuo studio
                </Link>
                <Link
                  href={`/pricing?ref=vertical-${data.slug}`}
                  className="btn btn-secondary btn-lg"
                >
                  Vedi piani
                </Link>
              </div>
              <div
                className="card stack stack-2"
                style={{
                  padding: 'var(--space-5)',
                  background: 'var(--color-accent-soft)',
                  borderColor: 'oklch(85% 0.05 175)',
                  maxWidth: '320px',
                }}
              >
                <span className="eyebrow">Risultato medio</span>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-3xl)',
                    fontWeight: 700,
                  }}
                >
                  {data.metric.value}
                </p>
                <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                  {data.metric.label}
                </p>
              </div>
            </div>
            <div style={{ position: 'relative', minHeight: '320px' }}>
              <Image
                src={data.icon}
                alt={`Illustrazione: AI Receptionist per ${data.title}`}
                width={520}
                height={420}
                loading="lazy"
                style={{ width: '100%', height: 'auto', maxWidth: '520px', marginInline: 'auto' }}
              />
            </div>
          </div>
        </section>

        <section className="section section-divider" aria-labelledby="pains-heading">
          <div className="container stack stack-12">
            <div className="stack stack-3" style={{ maxWidth: '52ch' }}>
              <span className="eyebrow">I problemi che risolve</span>
              <h2 id="pains-heading">Tre dolori reali, tre risposte concrete.</h2>
            </div>
            <div className="feature-grid">
              {data.pains.map((p) => (
                <article key={p.title} className="card stack stack-3">
                  <h3 style={{ fontSize: 'var(--text-xl)' }}>{p.title}</h3>
                  <p style={{ color: 'var(--color-text-secondary)' }}>{p.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="section section-divider"
          style={{ background: 'var(--color-surface-sunken)' }}
          aria-labelledby="scenarios-heading"
        >
          <div className="container stack stack-12">
            <div className="stack stack-3" style={{ maxWidth: '52ch' }}>
              <span className="eyebrow">Conversazioni reali</span>
              <h2 id="scenarios-heading">Tre scenari tipici, gestiti automaticamente.</h2>
            </div>
            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
            >
              {data.scenarios.map((s, i) => (
                <article
                  key={s.title}
                  className="card stack stack-3"
                  style={{ background: 'var(--color-surface)' }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-2xl)',
                      fontWeight: 700,
                      color: 'var(--color-accent)',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 style={{ fontSize: 'var(--text-lg)' }}>{s.title}</h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    {s.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-divider" aria-labelledby="other-verticals-heading">
          <div className="container stack stack-6">
            <h2 id="other-verticals-heading" style={{ fontSize: 'var(--text-2xl)' }}>
              Altri verticali coperti
            </h2>
            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
            >
              {otherVerticals.map((v) => (
                <Link
                  key={v.slug}
                  href={`/verticali/${v.slug}`}
                  className="card card-interactive stack stack-3"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <h3 style={{ fontSize: 'var(--text-base)' }}>{v.title}</h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    {v.metric.value} · {v.metric.label}
                  </p>
                  <span
                    style={{
                      color: 'var(--color-accent)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      marginTop: 'auto',
                    }}
                  >
                    Scopri →
                  </span>
                </Link>
              ))}
            </div>
            {data.relatedBlogSlug !== null && (
              <Link
                href={`/blog/${data.relatedBlogSlug}`}
                className="btn btn-secondary"
                style={{ alignSelf: 'flex-start' }}
              >
                Approfondisci con il case study →
              </Link>
            )}
          </div>
        </section>

        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
