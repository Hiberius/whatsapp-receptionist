import { isApiError } from '@/lib/api-client';

/**
 * Adattatore fra `apiFetch` e le schermate di configurazione.
 *
 * `apiFetch` lancia `ApiError` con messaggi in inglese pensati per chi sviluppa
 * («Business hours cannot overlap»): qui diventano un esito esplicito con un
 * testo mostrabile. `useApiForm` fa la stessa traduzione ma solo per i form in
 * POST, mentre queste route usano PUT, PATCH e DELETE.
 */
export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly message: string };

/**
 * Messaggi utente per i codici d'errore dell'API.
 *
 * I testi coincidono con quelli di `useApiForm` (lì non sono esportati): la
 * stessa condizione deve leggersi allo stesso modo in tutta l'app.
 */
const MESSAGE_BY_CODE: Readonly<Record<string, string>> = {
  rate_limited: 'Troppi tentativi ravvicinati. Riprova tra qualche minuto.',
  bad_request: 'Alcuni dati non sono validi. Controlla i campi e riprova.',
  unauthorized: 'Sessione non valida. Effettua di nuovo l’accesso.',
  forbidden: 'Non hai i permessi per completare questa operazione.',
  not_found: 'Risorsa non trovata: forse è stata modificata da un altro accesso.',
  conflict: 'Esiste già un elemento con questi dati.',
  network_error: 'Connessione non riuscita. Controlla la rete e riprova.',
  invalid_response: 'Il server ha risposto in un formato che non riconosciamo. Ricarica la pagina.',
  upstream_error: 'Il servizio non è raggiungibile in questo momento. Riprova tra poco.',
};

/** Esegue una chiamata di `api-client` restituendo l'esito invece di lanciarlo. */
export async function runRequest<T>(
  action: () => Promise<T>,
  fallbackMessage: string,
): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await action() };
  } catch (error) {
    return { ok: false, message: toUserMessage(error, fallbackMessage) };
  }
}

export function toUserMessage(error: unknown, fallbackMessage: string): string {
  if (!isApiError(error)) {
    return fallbackMessage;
  }

  return MESSAGE_BY_CODE[error.code] ?? fallbackMessage;
}
