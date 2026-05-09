/**
 * Schema.org builders helpers.
 * Tutti i builder ritornano oggetti serializzabili JSON pronti per essere
 * incollati in <script type="application/ld+json"> via il componente JsonLd.
 *
 * Convenzione: tutti gli URL relativi vengono normalizzati con SITE_URL come
 * prefisso. Un URL già assoluto (http/https) viene lasciato intatto.
 */

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://ambrogio.ai';

function absoluteUrl(url: string): string {
  return url.startsWith('http') ? url : `${SITE_URL}${url}`;
}

export function buildFaqSchema(
  faqs: ReadonlyArray<{ q: string; a: string }>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };
}

export function buildBreadcrumbSchema(
  items: ReadonlyArray<{ name: string; url: string }>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

interface ServiceSchemaInput {
  name: string;
  serviceType: string;
  description: string;
  url: string;
  areaServed?: string;
}

export function buildServiceSchema(input: ServiceSchemaInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: input.name,
    serviceType: input.serviceType,
    description: input.description,
    url: absoluteUrl(input.url),
    areaServed: { '@type': 'Country', name: input.areaServed ?? 'Italia' },
    provider: { '@id': `${SITE_URL}#organization` },
    inLanguage: 'it-IT',
  };
}

interface PlanOffer {
  name: string;
  price: string;
  description: string;
  url: string;
}

export function buildProductOffersSchema(plans: ReadonlyArray<PlanOffer>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Ambrogio.ai',
    description: 'AI Receptionist per studi e PMI italiane.',
    brand: { '@id': `${SITE_URL}#organization` },
    offers: plans.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: plan.price,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      validFrom: '2026-05-08',
      url: absoluteUrl(plan.url),
      description: plan.description,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: plan.price,
        priceCurrency: 'EUR',
        billingIncrement: 1,
        unitText: 'month',
      },
    })),
  };
}

interface SpeakableSchemaInput {
  url: string;
  cssSelector: string[];
}

export function buildSpeakableSchema(input: SpeakableSchemaInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': absoluteUrl(input.url),
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: input.cssSelector,
    },
  };
}

interface HowToStep {
  name: string;
  text: string;
}

export function buildHowToSchema(params: {
  name: string;
  description: string;
  steps: ReadonlyArray<HowToStep>;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: params.name,
    description: params.description,
    inLanguage: 'it-IT',
    step: params.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

interface ArticleSchemaInput {
  headline: string;
  description: string;
  datePublished: string;
  url: string;
  category?: string;
}

export function buildArticleSchema(input: ArticleSchemaInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    url: absoluteUrl(input.url),
    inLanguage: 'it-IT',
    author: { '@id': `${SITE_URL}#organization` },
    publisher: { '@id': `${SITE_URL}#organization` },
    isPartOf: { '@id': `${SITE_URL}#website` },
    ...(input.category ? { articleSection: input.category } : {}),
  };
}

interface PersonSchemaInput {
  name: string;
  jobTitle: string;
  description?: string;
  sameAs?: ReadonlyArray<string>;
  url?: string;
}

export function buildPersonSchema(input: PersonSchemaInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: input.name,
    jobTitle: input.jobTitle,
    worksFor: { '@id': `${SITE_URL}#organization` },
    ...(input.url ? { url: input.url } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.sameAs && input.sameAs.length > 0 ? { sameAs: [...input.sameAs] } : {}),
    knowsLanguage: ['it', 'en'],
  };
}

interface CollectionPageInput {
  name: string;
  description: string;
  url: string;
  hasPart?: ReadonlyArray<{ name: string; url: string }>;
}

export function buildCollectionPageSchema(input: CollectionPageInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.url),
    inLanguage: 'it-IT',
    isPartOf: { '@id': `${SITE_URL}#website` },
    ...(input.hasPart && input.hasPart.length > 0
      ? {
          hasPart: input.hasPart.map((p) => ({
            '@type': 'WebPage',
            name: p.name,
            url: absoluteUrl(p.url),
          })),
        }
      : {}),
  };
}
