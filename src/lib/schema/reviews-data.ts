/**
 * Recensioni testimoniali clienti pilota Ambrogio.ai (placeholder beta).
 *
 * Vengono pubblicate come `Review` JSON-LD sulla home/about per supportare
 * l’`aggregateRating` 4.9/5 esposto sul `SoftwareApplication`. Sostituire con
 * recensioni reali firmate dal cliente prima del lancio GA.
 */

export interface ReviewData {
  readonly authorName: string;
  readonly authorJobTitle: string;
  readonly reviewBody: string;
  readonly ratingValue: number;
  readonly datePublished: string;
}

/**
 * Beta reviews placeholder. Numbers and quotes consistent con metric claim
 * sulla home (+38% booking notturni, -68% no-show).
 */
export const BETA_REVIEWS: ReadonlyArray<ReviewData> = [
  {
    authorName: 'Studio Pilota Beta · Dental',
    authorJobTitle: 'Direttore Sanitario',
    reviewBody:
      'Le chiamate fuori orario non sono più un problema. Ambrogio qualifica le urgenze e prenota direttamente sul calendario. La segretaria torna a fare il suo lavoro vero.',
    ratingValue: 5,
    datePublished: '2026-04-20',
  },
  {
    authorName: 'Fitness Studio Beta (pilot)',
    authorJobTitle: 'Founder',
    reviewBody:
      'Lezioni di gruppo gestite end-to-end via WhatsApp. Ridotti i no-show grazie ai reminder automatici. Setup in mezza giornata.',
    ratingValue: 5,
    datePublished: '2026-04-28',
  },
  {
    authorName: 'Studio Pilota Beta · Beauty',
    authorJobTitle: 'Titolare centro estetico',
    reviewBody:
      'Listino complesso, pacchetti, gift card. Ambrogio li ha digeriti tutti senza fare confusione. I clienti pensano sia una segretaria umana.',
    ratingValue: 5,
    datePublished: '2026-05-02',
  },
] as const;
