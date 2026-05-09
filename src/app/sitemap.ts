import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ambrogio.ai';

const VERTICALS = ['dental', 'beauty', 'fitness', 'professional'] as const;
const LEGAL = ['privacy', 'terms', 'dpa', 'cookie', 'security'] as const;

const BLOG_POSTS = [
  { slug: 'come-uno-studio-dentistico-recupera-12k-anno', date: '2026-05-05' },
  { slug: 'whatsapp-business-vs-360dialog-quando-conviene', date: '2026-05-02' },
  { slug: 'gdpr-receptionist-ai-dpa-template', date: '2026-04-28' },
] as const;

const HELP_ARTICLES = [
  'come-collegare-il-numero-whatsapp-business',
  'come-autorizzare-google-calendar',
  'caricare-il-listino-servizi',
  'configurare-gli-orari-di-apertura',
  'come-funziona-il-filtro-ai',
  'quando-interviene-un-umano',
  'gestire-vocali-e-media',
  'risposte-rapide-preconfezionate',
  'come-ambrogio-prenota-appuntamenti',
  'gestire-conflitti-calendario',
  'reminder-automatici',
  'gestire-le-disdette',
  'cambiare-piano',
  'scaricare-fatture-elettroniche-sdi',
  'aggiornare-dati-piva',
  'esportare-i-miei-dati-gdpr',
  'cancellare-account',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const legalLastMod = new Date('2026-05-08');
  const helpLastMod = new Date('2026-05-08');
  const verticalsLastMod = new Date('2026-05-08');

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: verticalsLastMod,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/verticali`,
      lastModified: verticalsLastMod,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: verticalsLastMod,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/case-studies`,
      lastModified: verticalsLastMod,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/docs`,
      lastModified: helpLastMod,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/changelog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/help`,
      lastModified: helpLastMod,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: legalLastMod,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/status`,
      lastModified: now,
      changeFrequency: 'always',
      priority: 0.5,
    },
  ];

  const verticals: MetadataRoute.Sitemap = VERTICALS.map((slug) => ({
    url: `${BASE_URL}/verticali/${slug}`,
    lastModified: verticalsLastMod,
    changeFrequency: 'monthly',
    priority: 0.7,
    images: [`${BASE_URL}/verticali/${slug}/opengraph-image`],
  }));

  const legal: MetadataRoute.Sitemap = LEGAL.map((slug) => ({
    url: `${BASE_URL}/legal/${slug}`,
    lastModified: legalLastMod,
    changeFrequency: 'yearly',
    priority: 0.3,
  }));

  const blog: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.6,
    images: [`${BASE_URL}/blog/${post.slug}/opengraph-image`],
  }));

  const helpArticles: MetadataRoute.Sitemap = HELP_ARTICLES.map((slug) => ({
    url: `${BASE_URL}/help/articles/${slug}`,
    lastModified: helpLastMod,
    changeFrequency: 'monthly',
    priority: 0.4,
  }));

  return [...staticRoutes, ...verticals, ...legal, ...blog, ...helpArticles];
}
