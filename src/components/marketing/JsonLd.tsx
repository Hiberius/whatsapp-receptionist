import { headers } from 'next/headers';

/**
 * JSON-LD inline component. Usa il CSP nonce se presente.
 * Server-side: produces a <script type="application/ld+json">.
 */
export async function JsonLd({ data }: Readonly<{ data: object }>) {
  const headerList = await headers();
  const nonce = headerList.get('x-nonce') ?? undefined;

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://ambrogio.ai';

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}#organization`,
  name: 'Ambrogio.ai',
  legalName: 'Ambrogio.ai',
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/icon.svg`,
    width: 512,
    height: 512,
  },
  image: `${SITE_URL}/opengraph-image`,
  description:
    'Reception AI sempre attiva per studi e PMI italiane. WhatsApp, voce, prenotazioni automatiche.',
  email: 'hello@ambrogio.ai',
  foundingDate: '2026-04-24',
  foundingLocation: { '@type': 'Country', name: 'Italia' },
  areaServed: { '@type': 'Country', name: 'Italia' },
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'IT',
    addressLocality: 'Roma',
    addressRegion: 'RM',
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@ambrogio.ai',
      areaServed: 'IT',
      availableLanguage: ['Italian', 'English'],
    },
    {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: 'hello@ambrogio.ai',
      areaServed: 'IT',
      availableLanguage: ['Italian', 'English'],
    },
    {
      '@type': 'ContactPoint',
      contactType: 'data protection officer',
      email: 'dpo@ambrogio.ai',
      areaServed: 'EU',
      availableLanguage: ['Italian', 'English'],
    },
  ],
  knowsLanguage: ['it', 'en'],
  sameAs: ['https://twitter.com/ambrogio_ai', 'https://linkedin.com/company/ambrogio-ai'],
} as const;

export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Ambrogio.ai',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'AI Receptionist / Booking',
  operatingSystem: 'Web',
  url: SITE_URL,
  description:
    'AI Receptionist per studi e PMI italiane. WhatsApp, voce, prenotazioni automatiche, calendario sincronizzato.',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'EUR',
    lowPrice: '97',
    highPrice: '897',
    offerCount: 3,
    priceValidUntil: '2027-12-31',
  },
  // Nessun `aggregateRating`: va pubblicato solo a fronte di recensioni reali e
  // verificabili. Dichiararlo senza recensioni viola le policy sui dati
  // strutturati di Google e configura una pratica commerciale ingannevole.
  inLanguage: 'it-IT',
  publisher: { '@id': `${SITE_URL}#organization` },
} as const;

export {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildFaqSchema,
  buildHowToSchema,
  buildPersonSchema,
  buildProductOffersSchema,
  buildServiceSchema,
  buildSpeakableSchema,
} from './schema-builders';

export {
  buildDefinedTermSetSchema,
  buildEventSchema,
  buildHowToEnrichedSchema,
  buildQAPageSchema,
  buildReviewSchema,
  buildWebPageSchema,
} from './schema-builders-aeo';
