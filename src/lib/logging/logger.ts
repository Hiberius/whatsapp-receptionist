import pino from 'pino';

import { env } from '@/lib/env';

/**
 * Lista esplicita di path da redactare nei log Pino.
 *
 * Copre:
 * - Credenziali e header sensibili (password/token/cookie/authorization).
 * - PII personali italiane (codice fiscale, partita IVA, IBAN).
 * - Contatti (email, telefono, WhatsApp).
 * - Dati cliente (nome, indirizzo) anche annidati sotto `customer.*`.
 * - Contenuti messaggi (`messageBody`, `body`) e media URL audio
 *   (vocali utente in webhook WhatsApp).
 *
 * Pino redact path syntax: vedere https://getpino.io/#/docs/redaction.
 * Wildcard `*.<field>` matcha figli al primo livello,
 * `*.*.<field>` un secondo livello.
 */
const redactPaths: string[] = [
  // Credenziali e header
  'password',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'set-cookie',
  'headers.authorization',
  'headers.cookie',
  'headers.set-cookie',
  'credentials',
  '*.password',
  '*.token',
  '*.apiKey',
  '*.api_key',
  '*.secret',
  '*.access_token',
  '*.refresh_token',
  '*.authorization',
  '*.cookie',

  // Contatti
  'email',
  'phone',
  'phoneNumber',
  'whatsapp_number',
  'whatsappNumber',
  '*.email',
  '*.*.email',
  '*.phone',
  '*.phoneNumber',
  '*.whatsapp_number',
  '*.whatsappNumber',

  // PII fiscali italiane
  'fiscal_code',
  'fiscalCode',
  'tax_id',
  'taxId',
  'cf',
  '*.fiscal_code',
  '*.fiscalCode',
  '*.tax_id',
  '*.taxId',
  '*.cf',
  'vat_number',
  'vatNumber',
  'partita_iva',
  'vat',
  '*.vat_number',
  '*.vatNumber',
  '*.partita_iva',
  '*.vat',
  'iban',
  '*.iban',

  // Dati cliente
  'customer_name',
  'customerName',
  '*.customer_name',
  '*.customerName',
  '*.customer.name',
  '*.customer.email',
  'address.line1',
  'address.line2',
  'address.street',
  'address.city',
  'address.zip',
  'address.postal_code',
  '*.address.line1',
  '*.address.line2',
  '*.address.street',
  '*.address.city',
  '*.address.zip',
  '*.address.postal_code',

  // Contenuto messaggi e media
  'messageBody',
  'body',
  '*.messageBody',
  '*.body',
  'audio_url',
  'audioUrl',
  '*.audio_url',
  '*.audioUrl',
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: {
    service: 'ambrogio-ai',
    environment: env.APP_ENV,
  },
  redact: {
    paths: redactPaths,
    censor: '[redacted]',
  },
});
