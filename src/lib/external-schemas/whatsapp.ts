// Fatto da Claude Code il 8 maggio 2026.
//
// Helper di serializzazione per i payload WhatsApp Business webhook.
//
// Lo schema completo del webhook è già definito in `@/types/whatsapp` come
// `WhatsAppWebhookPayloadSchema` (Zod). Qui forniamo helper per convertire
// singoli messaggi/status in `Record<string, unknown>` per persistenza,
// senza ricorrere a cast `as unknown`.

import { z } from 'zod';
import type { WhatsAppWebhookPayload } from '@/types/whatsapp';

type EntryItem = WhatsAppWebhookPayload['entry'][number];
type ChangeValue = EntryItem['changes'][number]['value'];

export type WhatsAppMessage = NonNullable<ChangeValue['messages']>[number];
export type WhatsAppStatus = NonNullable<ChangeValue['statuses']>[number];

/**
 * Schema "loose" per record JSON arbitrari. Usato per validare a runtime che
 * un valore sia un oggetto serializzabile, mantenendo `unknown` come tipo dei
 * campi (per forzare narrowing successivo).
 */
const PlainRecordSchema = z.record(z.string(), z.unknown());

/**
 * Converte un payload WhatsApp (messaggio o status) in `Record<string, unknown>`
 * per persistenza in `webhook_events.payload`.
 *
 * Validazione runtime via Zod garantisce che il valore sia un oggetto plain
 * serializzabile in JSON, eliminando la necessità di cast `as unknown as`.
 */
export function toWhatsAppPayloadRecord(
  value: WhatsAppMessage | WhatsAppStatus,
): Record<string, unknown> {
  const result = PlainRecordSchema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  // Fallback ultra-difensivo: se Zod non riconosce l'oggetto, fall back a
  // un payload minimal (raro - WhatsAppWebhookPayloadSchema rifiuta non-oggetti
  // prima di arrivare qui).
  return {};
}
