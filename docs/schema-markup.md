# Schema markup & AI Visibility (AEO)

Questa pagina documenta tutti i JSON-LD attivi sul sito Ambrogio.ai, organizzati per pagina e tipo di schema. Lo scopo è doppio:

1. **SEO classico**: rich results su Google (FAQ, breadcrumb, prodotto, articolo).
2. **AEO / AI Visibility**: dati strutturati pensati per LLM e answer engines (Google SGE, Perplexity, ChatGPT, Claude) — DefinedTermSet, QAPage, HowTo enriched, Speakable, Review.

## Architettura

I builder vivono in `src/components/marketing/schema-builders.ts` e vengono re-esportati da `src/components/marketing/JsonLd.tsx` insieme al componente `<JsonLd>` (che usa il CSP nonce).

Schemi cross-page:
- `organizationSchema` — costante con `@id: <SITE_URL>#organization`. Viene riferita via `@id` da tutti gli schemi che hanno bisogno di un publisher/provider/organizer/author.
- `softwareApplicationSchema` — descrive Ambrogio come prodotto SaaS, con `aggregateRating` e `AggregateOffer`.
- `websiteSchema` — definito in `src/app/layout.tsx`, ID `<SITE_URL>#website`.

## Schemi attivi per pagina

| Pagina | Schema attivi | Builder |
|---|---|---|
| `/` | Organization, SoftwareApplication, WebSite (layout) | `organizationSchema`, `softwareApplicationSchema`, layout |
| `/about` | Organization, Breadcrumb, Person, AboutPage, Review×3 | `buildPersonSchema`, `buildWebPageSchema`, `buildReviewSchema` |
| `/blog` | Breadcrumb | `buildBreadcrumbSchema` |
| `/blog/[slug]` | Article, Breadcrumb | `buildArticleSchema`, `buildBreadcrumbSchema` |
| `/case-studies` | Breadcrumb, CollectionPage | `buildCollectionPageSchema` |
| `/changelog` | Breadcrumb, CollectionPage, Event | `buildEventSchema`, `buildWebPageSchema` |
| `/contact` | Breadcrumb, ContactPage | `buildWebPageSchema` |
| `/docs` | Breadcrumb, CollectionPage | `buildCollectionPageSchema` |
| `/help` | Breadcrumb, CollectionPage, Speakable, **DefinedTermSet (glossary)** | `buildWebPageSchema`, `buildSpeakableSchema`, `buildDefinedTermSetSchema` |
| `/help/articles/[slug]` | Breadcrumb, **QAPage**, Speakable | `buildQAPageSchema`, `buildSpeakableSchema` |
| `/onboarding` | **HowTo enriched** (totalTime + tool + supply) | `buildHowToEnrichedSchema` |
| `/pricing` | FAQPage, Breadcrumb, Product+Offers, Speakable | `buildFaqSchema`, `buildProductOffersSchema`, `buildSpeakableSchema` |
| `/verticali` | Breadcrumb | `buildBreadcrumbSchema` |
| `/verticali/[slug]` | Breadcrumb, Service, HowTo | `buildServiceSchema`, `buildHowToSchema` |

## Builder library

Tutti i builder sono esportati da `@/components/marketing/JsonLd`. Convenzioni comuni:

- `'@context': 'https://schema.org'` su ogni root.
- `inLanguage: 'it-IT'` ovunque applicable.
- URL relativi → assoluti via `absoluteUrl()` (helper interno).
- Cross-reference Organization via `{ '@id': '<SITE_URL>#organization' }`.

### Builder SEO classici

| Funzione | Schema | Note |
|---|---|---|
| `buildArticleSchema` | Article | Per blog post. Include `articleSection` opzionale. |
| `buildBreadcrumbSchema` | BreadcrumbList | Breadcrumb su tutte le pagine. |
| `buildCollectionPageSchema` | CollectionPage | Pagine indice (blog, case-studies, docs, changelog). |
| `buildFaqSchema` | FAQPage | Solo per pagine con multiple Q+A reali (es. /pricing). |
| `buildHowToSchema` | HowTo | Versione base con steps. |
| `buildProductOffersSchema` | Product + Offer[] | Pricing tiers. |
| `buildServiceSchema` | Service | Per landing verticali. |
| `buildSpeakableSchema` | WebPage + SpeakableSpecification | Voice search optimization. |

### Builder AEO / AI Visibility

| Funzione | Schema | Use case |
|---|---|---|
| `buildQAPageSchema` | QAPage | Single Q+A (help articles). LLM/SGE preferisce QAPage a FAQPage per pagine con UNA sola domanda. |
| `buildHowToEnrichedSchema` | HowTo + tools + supplies + totalTime | Onboarding wizard. Più ricco di buildHowToSchema. |
| `buildDefinedTermSetSchema` | DefinedTermSet + DefinedTerm[] | Glossario di dominio (`Glossary` component). LLM usa DefinedTerm per citare definizioni autorevoli. |
| `buildPersonSchema` | Person | Founder/team. Cross-reference `worksFor` Organization. |
| `buildReviewSchema` | Review + Rating | Testimonial individuali. Supporta `aggregateRating` di SoftwareApplication. |
| `buildEventSchema` | Event | Lanci, webinar, beta launches. |
| `buildWebPageSchema` | WebPage / sub-types | Marca esplicitamente AboutPage / ContactPage / CollectionPage / QAPage. Supporta Speakable inline. |

## Glossario AI (`Glossary.tsx`)

Il componente `<Glossary />` inietta un `DefinedTermSet` con definizioni canoniche dei concetti di dominio:

- AI Receptionist
- WhatsApp Cloud API
- Multi-tenant SaaS
- GDPR Art. 15 / Art. 17
- RLS (Row-Level Security)
- Sistema di Interscambio (SDI)
- Codice Destinatario
- Confidenza AI / Escalation
- No-show

Vedi `src/lib/schema/glossary-terms.ts` per le definizioni complete.

Il glossario è puro JSON-LD (nessuna UI). È montato su `/help` ma può essere riutilizzato su qualsiasi pagina passando `<Glossary hostUrl="..." />`.

## Reviews placeholder

`src/lib/schema/reviews-data.ts` contiene 3 review beta da clienti pilota (Fitness Studio Beta + 2 dental/beauty anonimizzati). Vengono pubblicate come `Review` JSON-LD su `/about`. Sostituire con review reali firmate prima del lancio GA.

## Robots / AI crawler policy

`src/app/robots.ts` blocca esplicitamente gli AI training crawler:

- `GPTBot` (OpenAI training)
- `Google-Extended` (Bard training)
- `CCBot` (Common Crawl)
- `anthropic-ai` (Claude training)
- `Omgilibot`

Questo permette di:
1. Apparire negli answer engines che fanno fetch real-time (Google SGE, Perplexity, ChatGPT con browsing).
2. Negare l’uso del nostro contenuto per training di modelli base.

## Voice search & Speakable

Selectors raccomandati per `SpeakableSpecification`:

- `h1` — titolo principale.
- `.lead` — paragrafo lead.
- `.hero h1`, `.hero .lead` — variant per hero sections.
- `[data-speakable="..."]` — opt-in esplicito (es. blocco FAQ pricing).

Pagine con Speakable attivo: `/help`, `/help/articles/[slug]`, `/about`, `/contact`, `/pricing`.

## Testing JSON-LD

Per validare:

1. Visit `https://search.google.com/test/rich-results?url=<page>` per ogni pagina.
2. Per dev locale: `view-source:` sulla pagina e cercare `<script type="application/ld+json">`.
3. Validatore generico: `https://validator.schema.org/`.

Nota: tutti gli schemi vengono renderizzati server-side via `<JsonLd>` (component async che legge `x-nonce` dagli headers per CSP compliance). Niente client-side serialization.

## TODO / future

- [ ] Sostituire `BETA_REVIEWS` con review reali firmate (post-GA launch).
- [ ] Aggiungere `MedicalBusiness` schema su `/verticali/dental` quando avremo cliente con DPA medical.
- [ ] Considerare `LearningResource` per articoli help più lunghi e didattici.
- [ ] Generare automaticamente sitemap di schemi (debug visualization).
