// Fatto da Claude Code il 8 maggio 2026.
//
// Type guards e Zod schemas per i payload Stripe utilizzati dal webhook handler.
//
// Stripe espone tipi TypeScript completi via il pacchetto `stripe`, ma il
// payload `event.data.object` è tipizzato come union (`Stripe.Event.Data.Object`)
// e nei nostri test fixture usiamo letterali JSON. Questi helper permettono di
// usare type-narrowing runtime (preferito) o, in casi limitati, validazione Zod
// dei campi che leggiamo davvero.
//
// Convenzione: ogni guard verifica solo il discriminante `object` e l'esistenza
// del campo `id`. Stripe non cambia la struttura di questi campi, quindi è
// sicuro narrowing senza Zod completo.

import { z } from 'zod';
import type Stripe from 'stripe';

/**
 * Verifica che `value` sia un oggetto plain (non null, non array).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard per Stripe Checkout Session.
 *
 * Verifica `object === 'checkout.session'` e l'esistenza di `id` come stringa.
 * Stripe garantisce questi campi su ogni evento `checkout.session.*`.
 */
export function isStripeCheckoutSession(value: unknown): value is Stripe.Checkout.Session {
  return (
    isPlainObject(value) && value.object === 'checkout.session' && typeof value.id === 'string'
  );
}

/**
 * Type guard per Stripe Subscription.
 */
export function isStripeSubscription(value: unknown): value is Stripe.Subscription {
  return isPlainObject(value) && value.object === 'subscription' && typeof value.id === 'string';
}

/**
 * Type guard per Stripe Invoice.
 */
export function isStripeInvoice(value: unknown): value is Stripe.Invoice {
  return isPlainObject(value) && value.object === 'invoice';
}

/**
 * Type guard per Stripe Customer.
 */
export function isStripeCustomer(value: unknown): value is Stripe.Customer {
  return isPlainObject(value) && value.object === 'customer' && typeof value.id === 'string';
}

/**
 * Schema generico per il discriminante `object` su un payload Stripe.
 * Utile per peek-and-route prima di eseguire un guard più specifico.
 */
export const StripeObjectDiscriminatorSchema = z
  .object({
    object: z.string().optional(),
    id: z.string().optional(),
    customer: z.unknown().optional(),
  })
  .passthrough();

export type StripeObjectDiscriminator = z.infer<typeof StripeObjectDiscriminatorSchema>;

/**
 * Estrae il discriminante `object` da un payload Stripe sconosciuto.
 * Ritorna `null` se il payload non è oggetto.
 */
export function readStripeObjectDiscriminator(value: unknown): StripeObjectDiscriminator | null {
  const result = StripeObjectDiscriminatorSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Schema Zod per serializzare un Stripe.Event in `Record<string, unknown>`.
 *
 * Usato dal webhook handler per il payload archiviato in `webhook_events.payload`.
 * Garantisce a runtime che il valore sia un oggetto serializzabile in JSON.
 */
export const StripeEventEnvelopeSchema = z
  .object({
    id: z.string(),
    object: z.literal('event'),
    type: z.string(),
    data: z
      .object({
        object: z.unknown(),
      })
      .passthrough(),
  })
  .passthrough();

export type StripeEventEnvelope = z.infer<typeof StripeEventEnvelopeSchema>;

/**
 * Serializza un Stripe.Event come `Record<string, unknown>` per persistenza.
 *
 * Stripe.Event è un tipo TypeScript ricco (con union su `data.object`) che
 * non si converte direttamente al type `Record<string, unknown>` richiesto
 * dalla repository. Questa funzione applica una validazione Zod runtime e
 * ritorna un record sicuro.
 */
export function toEventPayload(event: Stripe.Event): Record<string, unknown> {
  const result = StripeEventEnvelopeSchema.safeParse(event);

  if (result.success) {
    return result.data as Record<string, unknown>;
  }

  // Fallback: l'envelope è atipico (raro). Salviamo un payload minimale
  // mantenendo l'invariante "Record<string, unknown>".
  return {
    id: event.id,
    object: 'event',
    type: event.type,
    data: { object: null },
  };
}
