/**
 * Schema.org builders — AEO (Answer Engine Optimization) extensions.
 * Per Google SGE, Perplexity, ChatGPT, Claude. Estratti da schema-builders.ts
 * per rispettare il vincolo di file <250 righe.
 */

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://ambrogio.ai';

function absoluteUrl(url: string): string {
  return url.startsWith('http') ? url : `${SITE_URL}${url}`;
}

interface QAPageInput {
  question: string;
  answer: string;
  url: string;
  datePublished?: string;
  author?: string;
}

/** QAPage: singola Q+A autorevole. Più adatto di FAQPage per articoli help. */
export function buildQAPageSchema(input: QAPageInput): Record<string, unknown> {
  const url = absoluteUrl(input.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    '@id': url,
    inLanguage: 'it-IT',
    isPartOf: { '@id': `${SITE_URL}#website` },
    mainEntity: {
      '@type': 'Question',
      name: input.question,
      ...(input.datePublished ? { dateCreated: input.datePublished } : {}),
      author: { '@id': `${SITE_URL}#organization` },
      acceptedAnswer: {
        '@type': 'Answer',
        text: input.answer,
        ...(input.datePublished ? { dateCreated: input.datePublished } : {}),
        author: input.author
          ? { '@type': 'Organization', name: input.author }
          : { '@id': `${SITE_URL}#organization` },
        upvoteCount: 1,
        url,
      },
    },
  };
}

interface HowToStepRich {
  name: string;
  text: string;
  url?: string;
}

interface HowToEnrichedInput {
  name: string;
  description: string;
  steps: ReadonlyArray<HowToStepRich>;
  totalTime?: string;
  tool?: ReadonlyArray<string>;
  supply?: ReadonlyArray<string>;
  url?: string;
}

/** HowTo enriched con totalTime, tool, supply per tutorial step-by-step. */
export function buildHowToEnrichedSchema(input: HowToEnrichedInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: input.name,
    description: input.description,
    inLanguage: 'it-IT',
    ...(input.totalTime ? { totalTime: input.totalTime } : {}),
    ...(input.tool && input.tool.length > 0
      ? { tool: input.tool.map((t) => ({ '@type': 'HowToTool', name: t })) }
      : {}),
    ...(input.supply && input.supply.length > 0
      ? { supply: input.supply.map((s) => ({ '@type': 'HowToSupply', name: s })) }
      : {}),
    ...(input.url ? { url: absoluteUrl(input.url) } : {}),
    publisher: { '@id': `${SITE_URL}#organization` },
    step: input.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.url ? { url: absoluteUrl(step.url) } : {}),
    })),
  };
}

interface DefinedTerm {
  name: string;
  description: string;
  url?: string;
  termCode?: string;
}

interface DefinedTermSetInput {
  name: string;
  description: string;
  url: string;
  terms: ReadonlyArray<DefinedTerm>;
}

/** DefinedTermSet: glossario semantico per AI/LLM citation. */
export function buildDefinedTermSetSchema(input: DefinedTermSetInput): Record<string, unknown> {
  const setUrl = absoluteUrl(input.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${setUrl}#glossary`,
    name: input.name,
    description: input.description,
    url: setUrl,
    inLanguage: 'it-IT',
    publisher: { '@id': `${SITE_URL}#organization` },
    hasDefinedTerm: input.terms.map((term) => ({
      '@type': 'DefinedTerm',
      name: term.name,
      description: term.description,
      inDefinedTermSet: `${setUrl}#glossary`,
      ...(term.termCode ? { termCode: term.termCode } : {}),
      ...(term.url ? { url: absoluteUrl(term.url) } : {}),
    })),
  };
}

interface ReviewSchemaInput {
  authorName: string;
  authorJobTitle?: string;
  reviewBody: string;
  ratingValue: number;
  datePublished: string;
  itemReviewedName?: string;
}

/** Review singola (testimonial) con rating e autore dedicati. */
export function buildReviewSchema(input: ReviewSchemaInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    reviewBody: input.reviewBody,
    datePublished: input.datePublished,
    inLanguage: 'it-IT',
    author: {
      '@type': 'Person',
      name: input.authorName,
      ...(input.authorJobTitle ? { jobTitle: input.authorJobTitle } : {}),
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: input.ratingValue.toString(),
      bestRating: '5',
      worstRating: '1',
    },
    itemReviewed: {
      '@type': 'SoftwareApplication',
      name: input.itemReviewedName ?? 'Ambrogio.ai',
    },
    publisher: { '@id': `${SITE_URL}#organization` },
  };
}

interface EventSchemaInput {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  url?: string;
  eventStatus?: 'EventScheduled' | 'EventCancelled' | 'EventPostponed' | 'EventMovedOnline';
  eventAttendanceMode?:
    | 'OnlineEventAttendanceMode'
    | 'OfflineEventAttendanceMode'
    | 'MixedEventAttendanceMode';
}

/** Event: annunci, lanci, webinar. Utile per changelog di tipo "lancio". */
export function buildEventSchema(input: EventSchemaInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.name,
    description: input.description,
    startDate: input.startDate,
    inLanguage: 'it-IT',
    ...(input.endDate ? { endDate: input.endDate } : {}),
    ...(input.url ? { url: absoluteUrl(input.url) } : {}),
    eventStatus: `https://schema.org/${input.eventStatus ?? 'EventScheduled'}`,
    eventAttendanceMode: `https://schema.org/${input.eventAttendanceMode ?? 'OnlineEventAttendanceMode'}`,
    location: { '@type': 'VirtualLocation', url: SITE_URL },
    organizer: { '@id': `${SITE_URL}#organization` },
    publisher: { '@id': `${SITE_URL}#organization` },
  };
}

type WebPageSubType =
  | 'WebPage'
  | 'AboutPage'
  | 'ContactPage'
  | 'FAQPage'
  | 'CollectionPage'
  | 'ItemPage'
  | 'QAPage';

interface WebPageSchemaInput {
  type?: WebPageSubType;
  name: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  primaryImageOfPage?: string;
  speakableSelectors?: ReadonlyArray<string>;
}

/** WebPage tipato per AEO: AboutPage, ContactPage, FAQPage, ItemPage, QAPage. */
export function buildWebPageSchema(input: WebPageSchemaInput): Record<string, unknown> {
  const url = absoluteUrl(input.url);
  return {
    '@context': 'https://schema.org',
    '@type': input.type ?? 'WebPage',
    '@id': url,
    name: input.name,
    description: input.description,
    url,
    inLanguage: 'it-IT',
    isPartOf: { '@id': `${SITE_URL}#website` },
    publisher: { '@id': `${SITE_URL}#organization` },
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.primaryImageOfPage
      ? {
          primaryImageOfPage: {
            '@type': 'ImageObject',
            url: absoluteUrl(input.primaryImageOfPage),
          },
        }
      : {}),
    ...(input.speakableSelectors && input.speakableSelectors.length > 0
      ? {
          speakable: {
            '@type': 'SpeakableSpecification',
            cssSelector: [...input.speakableSelectors],
          },
        }
      : {}),
  };
}
