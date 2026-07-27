export const DEFAULT_AUTH_DESTINATION = '/dashboard';

/**
 * Valida la destinazione post-login proveniente dal parametro `next`.
 *
 * `next` arriva dalla query string, quindi è input non fidato: senza controllo
 * sarebbe un open redirect particolarmente efficace per il phishing, perché
 * porta la vittima fuori dominio subito dopo un login legittimo, sfruttando la
 * fiducia costruita da un flusso appena riuscito.
 *
 * Accettiamo solo path relativi alla nostra origin. I casi rifiutati non sono
 * ipotetici: `//host` è protocol-relative e il browser lo tratta come
 * assoluto, e alcuni browser normalizzano `\` in `/` durante il parsing
 * dell'URL, così `/\evil.example` diventa `//evil.example`.
 *
 * Vive in un modulo separato dalla route perché Next.js consente ai file
 * `route.ts` solo export riconosciuti (gli handler HTTP e poche config):
 * esportare l'helper dalla route stessa fa fallire la build.
 */
export function safeDestination(candidate: string | null): string {
  if (!candidate) return DEFAULT_AUTH_DESTINATION;
  if (!candidate.startsWith('/')) return DEFAULT_AUTH_DESTINATION;
  if (candidate.startsWith('//')) return DEFAULT_AUTH_DESTINATION;
  if (candidate.includes('\\')) return DEFAULT_AUTH_DESTINATION;
  return candidate;
}
