import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buildArticleSchema, buildBreadcrumbSchema, JsonLd } from '@/components/marketing/JsonLd';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/marketing/SiteHeader';

interface Post {
  slug: string;
  title: string;
  /** SEO meta title — può essere più conciso del title H1 per stare in <60 char dopo template. */
  seoTitle?: string;
  excerpt: string;
  body: string;
  date: string;
  isoDate: string;
  readTime: string;
  category: string;
  relatedVerticalSlug: string | null;
  relatedVerticalLabel: string | null;
  relatedPostSlugs: ReadonlyArray<string>;
}

const POSTS: Record<string, Post> = {
  'come-uno-studio-dentistico-recupera-12k-anno': {
    slug: 'come-uno-studio-dentistico-recupera-12k-anno',
    title: 'Come uno studio dentistico recupera €12k/anno con la reception AI',
    seoTitle: 'Studio dentistico: +€12k con AI reception',
    excerpt:
      'Caso reale: Studio Dentistico Rossi di Milano, 38% di booking notturni in più nei primi 90 giorni.',
    body: `Lo Studio Dentistico Rossi di Milano riceveva mediamente 8 chiamate fuori orario al giorno. Di queste, solo 1 su 5 si convertiva in appuntamento il giorno dopo: il resto era cliente perso, deluso, o semplicemente trattenuto da un’altra preferenza.\n\nDopo aver attivato Ambrogio.ai, le 8 chiamate fuori orario sono diventate conversazioni WhatsApp gestite automaticamente. Il 73% di queste si è convertito in booking confermato sul calendario Google della dottoressa.\n\nNumeri concreti dei primi 90 giorni: +38% booking notturni, -68% no-show grazie ai reminder automatici, €12.400 di fatturato aggiuntivo recuperato.\n\nMa il vero impatto non è il numero: è la qualità della giornata. La segretaria non interrompe più ogni 15 minuti per rispondere al telefono. La dottoressa arriva al mattino con l’agenda già piena. I pazienti ricevono una conferma in 30 secondi anche alle 22 di sera.`,
    date: '5 maggio 2026',
    isoDate: '2026-05-05',
    readTime: '6 min',
    category: 'Case study',
    relatedVerticalSlug: 'dental',
    relatedVerticalLabel: 'Ambrogio per studi dentistici',
    relatedPostSlugs: [
      'whatsapp-business-vs-360dialog-quando-conviene',
      'gdpr-receptionist-ai-dpa-template',
    ],
  },
  'whatsapp-business-vs-360dialog-quando-conviene': {
    slug: 'whatsapp-business-vs-360dialog-quando-conviene',
    title: 'WhatsApp Cloud API vs 360dialog: quando conviene cosa',
    seoTitle: 'WhatsApp Cloud API vs 360dialog · Confronto',
    excerpt: 'Confronto tecnico ed economico tra l’API ufficiale Meta e i BSP italiani più usati.',
    body: `Quando si integra WhatsApp Business per un SaaS B2B in Italia, le opzioni sono due: Meta WhatsApp Cloud API direttamente, oppure passare per un BSP (Business Solution Provider) come 360dialog.\n\nMeta Cloud API: economico, controllo totale, supporto solo via documentazione. Ideale se hai un team tecnico.\n\n360dialog: prezzo più alto, supporto in italiano, onboarding facilitato, fattura italiana. Ideale per agenzie che gestiscono molti clienti.\n\nIl breakeven economico è intorno ai 50.000 messaggi/mese. Sotto, conviene 360dialog. Sopra, conviene Cloud API diretto.`,
    date: '2 maggio 2026',
    isoDate: '2026-05-02',
    readTime: '8 min',
    category: 'Guida',
    relatedVerticalSlug: null,
    relatedVerticalLabel: null,
    relatedPostSlugs: [
      'come-uno-studio-dentistico-recupera-12k-anno',
      'gdpr-receptionist-ai-dpa-template',
    ],
  },
  'gdpr-receptionist-ai-dpa-template': {
    slug: 'gdpr-receptionist-ai-dpa-template',
    title: 'GDPR e receptionist AI: il DPA che serve davvero',
    seoTitle: 'GDPR e DPA per AI Receptionist',
    excerpt: 'Cosa deve contenere un DPA per essere utile in caso di audit. Template scaricabile.',
    body: `Il Data Processing Agreement (DPA) è obbligatorio quando un service provider tratta dati personali per conto del titolare. Per un AI receptionist questo è particolarmente sensibile perché si processano conversazioni intere, vocali, e potenzialmente dati sanitari.\n\nUn DPA solido deve specificare: categorie di dati, finalità, durata, sub-processori, misure tecniche, procedura data breach, diritti degli interessati.\n\nAmbrogio.ai fornisce un DPA pre-compilato con: hosting EU (Supabase Frankfurt), retention 24 mesi, audit log immutabile, endpoint Art. 15/17 self-service, sub-processori dichiarati pubblicamente.`,
    date: '28 aprile 2026',
    isoDate: '2026-04-28',
    readTime: '12 min',
    category: 'GDPR',
    relatedVerticalSlug: 'professional',
    relatedVerticalLabel: 'Ambrogio per studi professionali',
    relatedPostSlugs: [
      'come-uno-studio-dentistico-recupera-12k-anno',
      'whatsapp-business-vs-360dialog-quando-conviene',
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(POSTS).map((slug) => ({ slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = POSTS[slug];
  if (!post) {
    return {
      title: 'Articolo non trovato',
      robots: { index: false, follow: false },
    };
  }
  return {
    title: post.seoTitle ?? post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.isoDate,
      url: `/blog/${post.slug}`,
      locale: 'it_IT',
    },
    alternates: { canonical: `/blog/${post.slug}` },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = POSTS[slug];
  if (!post) {
    notFound();
  }

  const articleSchema = buildArticleSchema({
    headline: post.title,
    description: post.excerpt,
    datePublished: post.isoDate,
    url: `/blog/${post.slug}`,
    category: post.category,
  });

  const relatedPosts = post.relatedPostSlugs
    .map((relSlug) => POSTS[relSlug])
    .filter((p): p is Post => p !== undefined);

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Blog', url: '/blog' },
          { name: post.title, url: `/blog/${post.slug}` },
        ])}
      />
      <SiteHeader />
      <main id="main">
        <article className="section">
          <div className="container-narrow stack stack-6">
            <div className="stack stack-3">
              <Link href="/blog" className="btn-link" style={{ fontSize: 'var(--text-sm)' }}>
                ← Tutti gli articoli
              </Link>
              <span className="badge badge-neutral">{post.category}</span>
              <h1 className="text-balance">{post.title}</h1>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                {post.date} · {post.readTime} di lettura
              </p>
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
              {post.body}
            </div>
            <hr className="divider" />

            {post.relatedVerticalSlug !== null && post.relatedVerticalLabel !== null && (
              <div
                className="card stack stack-3"
                style={{ background: 'var(--color-surface-sunken)' }}
              >
                <span className="eyebrow">Verticale correlato</span>
                <Link
                  href={`/verticali/${post.relatedVerticalSlug}`}
                  className="btn btn-secondary"
                  style={{ alignSelf: 'flex-start' }}
                >
                  {post.relatedVerticalLabel} →
                </Link>
              </div>
            )}

            {relatedPosts.length > 0 && (
              <section className="stack stack-4" aria-labelledby="related-posts-heading">
                <h2 id="related-posts-heading" style={{ fontSize: 'var(--text-xl)' }}>
                  Continua a leggere
                </h2>
                <div
                  className="grid"
                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
                >
                  {relatedPosts.map((rel) => (
                    <Link
                      key={rel.slug}
                      href={`/blog/${rel.slug}`}
                      className="card card-interactive stack stack-3"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <span className="badge badge-neutral">{rel.category}</span>
                      <h3 style={{ fontSize: 'var(--text-base)' }}>{rel.title}</h3>
                      <span
                        style={{
                          color: 'var(--color-accent)',
                          fontSize: 'var(--text-sm)',
                          fontWeight: 600,
                          marginTop: 'auto',
                        }}
                      >
                        Leggi →
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <div className="card stack stack-3" style={{ background: 'var(--color-accent-soft)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)' }}>
                Vuoi i risultati di{' '}
                {post.category.toLowerCase() === 'case study' ? 'questo studio' : 'questa guida'}?
              </h3>
              <p style={{ fontSize: 'var(--text-sm)' }}>
                Inizia la prova di 14 giorni gratis. Setup in 24h.
              </p>
              <Link
                href="/register"
                className="btn btn-primary"
                style={{ alignSelf: 'flex-start' }}
              >
                Inizia gratis →
              </Link>
            </div>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
