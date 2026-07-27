import { z } from 'zod';

import { apiFetch } from '@/lib/api-client';

import { runRequest, type ApiResult } from './settings-api';

export const SERVICES_ENDPOINT = '/api/settings/services';

/** Proiezione client di `TenantServiceSettings` (vedi nota in business-hours-model). */
export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  durationMinutes: z.number().int(),
  priceCents: z.number().int().nullable(),
  active: z.boolean(),
});

export type ServiceView = z.output<typeof ServiceSchema>;

/** Campi così come li digita l'utente: tutto stringa, nessuna conversione. */
export interface ServiceDraft {
  readonly name: string;
  readonly description: string;
  readonly durationMinutes: string;
  /** Euro come li scrive l'utente: `35`, `35,50`, `35.50`. */
  readonly price: string;
  readonly active: boolean;
}

/** Valori normalizzati, pronti per l'API: il prezzo è in centesimi interi. */
export interface NormalizedService {
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number;
  readonly priceCents: number | null;
  readonly active: boolean;
}

export type ServiceField = 'name' | 'description' | 'durationMinutes' | 'price';

export type ServiceFieldErrors = Partial<Record<ServiceField, string>>;

export type ServiceValidation =
  | { readonly ok: true; readonly value: NormalizedService }
  | { readonly ok: false; readonly errors: ServiceFieldErrors };

export const EMPTY_SERVICE_DRAFT: ServiceDraft = {
  name: '',
  description: '',
  durationMinutes: '30',
  price: '',
  active: true,
};

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 480;
/** Stesso tetto della route: 1.000.000 centesimi = 10.000 €. */
const MAX_PRICE_CENTS = 1_000_000;

/** Fino a due decimali, separati da virgola o punto. */
const PRICE_PATTERN = /^(\d{1,7})(?:[.,](\d{1,2}))?$/;

export function toServiceDraft(service: ServiceView): ServiceDraft {
  return {
    name: service.name,
    description: service.description ?? '',
    durationMinutes: String(service.durationMinutes),
    price: centsToPriceInput(service.priceCents),
    active: service.active,
  };
}

export function validateServiceDraft(draft: ServiceDraft): ServiceValidation {
  const name = draft.name.trim();
  const description = draft.description.trim();
  const duration = parseDurationMinutes(draft.durationMinutes);
  const price = parsePriceToCents(draft.price);

  const errors: ServiceFieldErrors = {
    ...(name.length === 0 ? { name: 'Il nome del servizio è obbligatorio.' } : {}),
    ...(name.length > MAX_NAME_LENGTH
      ? { name: `Il nome non può superare ${MAX_NAME_LENGTH} caratteri.` }
      : {}),
    ...(description.length > MAX_DESCRIPTION_LENGTH
      ? { description: `La descrizione non può superare ${MAX_DESCRIPTION_LENGTH} caratteri.` }
      : {}),
    ...(duration === null
      ? {
          durationMinutes: `La durata deve essere un numero intero di minuti tra ${MIN_DURATION_MINUTES} e ${MAX_DURATION_MINUTES}.`,
        }
      : {}),
    ...(price === 'invalid'
      ? { price: 'Il prezzo deve essere un importo in euro con al massimo due decimali.' }
      : {}),
    ...(typeof price === 'number' && price > MAX_PRICE_CENTS
      ? { price: 'Il prezzo supera il massimo consentito (10.000 €).' }
      : {}),
  };

  if (Object.keys(errors).length > 0 || duration === null || price === 'invalid') {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      description: description.length === 0 ? null : description,
      durationMinutes: duration,
      priceCents: price,
      active: draft.active,
    },
  };
}

/**
 * Solo i campi davvero cambiati.
 *
 * L'API rifiuta un patch vuoto e registra in audit log l'elenco dei campi
 * toccati: inviare tutto ogni volta renderebbe quel log inutilizzabile.
 */
export function buildServicePatch(
  current: ServiceView,
  next: NormalizedService,
): Partial<NormalizedService> {
  return {
    ...(next.name !== current.name ? { name: next.name } : {}),
    ...(next.description !== current.description ? { description: next.description } : {}),
    ...(next.durationMinutes !== current.durationMinutes
      ? { durationMinutes: next.durationMinutes }
      : {}),
    ...(next.priceCents !== current.priceCents ? { priceCents: next.priceCents } : {}),
    ...(next.active !== current.active ? { active: next.active } : {}),
  };
}

export async function createService(input: {
  readonly service: NormalizedService;
}): Promise<ApiResult<ServiceView>> {
  return runRequest(
    () =>
      apiFetch(SERVICES_ENDPOINT, {
        schema: ServiceSchema,
        method: 'POST',
        body: input.service,
      }),
    'Non siamo riusciti a creare il servizio. Riprova tra poco.',
  );
}

export async function updateService(input: {
  readonly serviceId: string;
  readonly patch: Partial<NormalizedService>;
}): Promise<ApiResult<ServiceView>> {
  return runRequest(
    () =>
      apiFetch(serviceUrl(input.serviceId), {
        schema: ServiceSchema,
        method: 'PATCH',
        body: input.patch,
      }),
    'Non siamo riusciti a salvare le modifiche. Riprova tra poco.',
  );
}

/**
 * DELETE non cancella: la route chiama `archiveService`, che porta `active` a
 * `false`. Gli appuntamenti già presi continuano a puntare al servizio.
 */
export async function archiveService(input: {
  readonly serviceId: string;
}): Promise<ApiResult<ServiceView>> {
  return runRequest(
    () =>
      apiFetch(serviceUrl(input.serviceId), {
        schema: ServiceSchema,
        method: 'DELETE',
      }),
    'Non siamo riusciti ad archiviare il servizio. Riprova tra poco.',
  );
}

function serviceUrl(serviceId: string): string {
  return `${SERVICES_ENDPOINT}/${encodeURIComponent(serviceId)}`;
}

/**
 * Euro digitati → centesimi interi.
 *
 * L'aritmetica resta su interi (niente `parseFloat` moltiplicato per 100, che
 * su `1,15` restituisce 114.99999999999999).
 */
export function parsePriceToCents(value: string): number | null | 'invalid' {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  const match = PRICE_PATTERN.exec(normalized);

  if (match === null) {
    return 'invalid';
  }

  const [, units = '0', decimals = ''] = match;

  return Number(units) * 100 + Number(decimals.padEnd(2, '0'));
}

export function parseDurationMinutes(value: string): number | null {
  const normalized = value.trim();

  if (!/^\d{1,4}$/.test(normalized)) {
    return null;
  }

  const minutes = Number(normalized);

  if (minutes < MIN_DURATION_MINUTES || minutes > MAX_DURATION_MINUTES) {
    return null;
  }

  return minutes;
}

/** Centesimi → valore del campo prezzo. Stringa vuota se il prezzo non c'è. */
export function centsToPriceInput(cents: number | null): string {
  if (cents === null) {
    return '';
  }

  return `${Math.trunc(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
}

export function formatPrice(cents: number | null): string {
  if (cents === null) {
    return 'Prezzo non indicato';
  }

  // La divisione serve solo alla formattazione: il dato persistito resta intero.
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.trunc(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
