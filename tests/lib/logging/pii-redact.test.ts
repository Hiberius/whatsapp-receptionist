import { Writable } from 'node:stream';

import pino from 'pino';
import { describe, expect, it } from 'vitest';

/**
 * Test isolato del comportamento redact: ricreiamo un'istanza Pino con
 * la stessa configurazione di redact del logger applicativo per evitare
 * di dipendere dal `level: 'silent'` che il logger esportato usa in test.
 *
 * I percorsi qui replicati DEVONO restare allineati a `src/lib/logging/logger.ts`.
 */
const REDACT_PATHS: string[] = [
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

const REDACTED = '[redacted]';

type LogRecord = Record<string, unknown>;

function createTestLogger(): { logger: pino.Logger; readLast: () => LogRecord } {
  const records: LogRecord[] = [];

  const stream = new Writable({
    write(chunk, _encoding, callback) {
      const text = chunk.toString('utf-8').trim();
      if (text.length > 0) {
        records.push(JSON.parse(text) as LogRecord);
      }
      callback();
    },
  });

  const logger = pino(
    {
      level: 'info',
      redact: {
        paths: REDACT_PATHS,
        censor: REDACTED,
      },
    },
    stream,
  );

  return {
    logger,
    readLast: () => {
      const last = records.at(-1);
      if (!last) {
        throw new Error('No log records captured');
      }
      return last;
    },
  };
}

describe('logger PII redact', () => {
  it('redacts credentials at root and nested levels', () => {
    const { logger, readLast } = createTestLogger();

    logger.info(
      {
        password: 'topsecret',
        token: 'jwt-token',
        apiKey: 'key',
        api_key: 'key',
        authorization: 'Bearer abc',
        cookie: 'sb=...',
        credentials: { user: 'x', password: 'y' },
        headers: {
          authorization: 'Bearer xyz',
          cookie: 'sid=...',
        },
        nested: {
          password: 'p',
          token: 't',
          secret: 's',
          access_token: 'at',
          refresh_token: 'rt',
        },
      },
      'auth',
    );

    const record = readLast();
    expect(record['password']).toBe(REDACTED);
    expect(record['token']).toBe(REDACTED);
    expect(record['apiKey']).toBe(REDACTED);
    expect(record['api_key']).toBe(REDACTED);
    expect(record['authorization']).toBe(REDACTED);
    expect(record['cookie']).toBe(REDACTED);
    expect(record['credentials']).toBe(REDACTED);
    expect((record['headers'] as LogRecord)['authorization']).toBe(REDACTED);
    expect((record['headers'] as LogRecord)['cookie']).toBe(REDACTED);
    const nested = record['nested'] as LogRecord;
    expect(nested['password']).toBe(REDACTED);
    expect(nested['token']).toBe(REDACTED);
    expect(nested['secret']).toBe(REDACTED);
    expect(nested['access_token']).toBe(REDACTED);
    expect(nested['refresh_token']).toBe(REDACTED);
  });

  it('redacts contact fields (email, phone, whatsapp) at root', () => {
    const { logger, readLast } = createTestLogger();

    logger.info(
      {
        email: 'mario@example.it',
        phone: '+39 333 1234567',
        phoneNumber: '+39 333 1234567',
        whatsapp_number: '+39333',
        whatsappNumber: '+39333',
      },
      'contacts',
    );

    const record = readLast();
    expect(record['email']).toBe(REDACTED);
    expect(record['phone']).toBe(REDACTED);
    expect(record['phoneNumber']).toBe(REDACTED);
    expect(record['whatsapp_number']).toBe(REDACTED);
    expect(record['whatsappNumber']).toBe(REDACTED);
  });

  it('redacts contact fields nested inside a wildcard parent (*.email, *.phone)', () => {
    const { logger, readLast } = createTestLogger();

    logger.info(
      {
        user: {
          email: 'mario@example.it',
          phone: '+39 333 1234567',
          whatsapp_number: '+39333',
        },
      },
      'contacts-nested',
    );

    const user = readLast()['user'] as LogRecord;
    expect(user['email']).toBe(REDACTED);
    expect(user['phone']).toBe(REDACTED);
    expect(user['whatsapp_number']).toBe(REDACTED);
  });

  it('redacts email at second nesting level (*.*.email)', () => {
    const { logger, readLast } = createTestLogger();

    logger.info(
      {
        request: {
          payload: {
            email: 'leak@example.it',
          },
        },
      },
      'deep-nested-email',
    );

    const payload = (readLast()['request'] as LogRecord)['payload'] as LogRecord;
    expect(payload['email']).toBe(REDACTED);
  });

  it('redacts Italian fiscal PII (codice fiscale, partita IVA, IBAN)', () => {
    const { logger, readLast } = createTestLogger();

    logger.info(
      {
        fiscal_code: 'RSSMRA80A01H501U',
        fiscalCode: 'RSSMRA80A01H501U',
        tax_id: 'IT12345678901',
        taxId: 'IT12345678901',
        cf: 'RSSMRA80A01H501U',
        vat_number: 'IT12345678901',
        vatNumber: 'IT12345678901',
        partita_iva: '12345678901',
        vat: 'IT12345678901',
        iban: 'IT60X0542811101000000123456',
      },
      'fiscal',
    );

    const record = readLast();
    expect(record['fiscal_code']).toBe(REDACTED);
    expect(record['fiscalCode']).toBe(REDACTED);
    expect(record['tax_id']).toBe(REDACTED);
    expect(record['taxId']).toBe(REDACTED);
    expect(record['cf']).toBe(REDACTED);
    expect(record['vat_number']).toBe(REDACTED);
    expect(record['vatNumber']).toBe(REDACTED);
    expect(record['partita_iva']).toBe(REDACTED);
    expect(record['vat']).toBe(REDACTED);
    expect(record['iban']).toBe(REDACTED);
  });

  it('redacts fiscal PII inside a wildcard parent', () => {
    const { logger, readLast } = createTestLogger();

    logger.info(
      {
        tenant: {
          fiscal_code: 'RSSMRA80A01H501U',
          vat_number: 'IT12345678901',
          iban: 'IT60X0542811101000000123456',
        },
      },
      'fiscal-nested',
    );

    const tenant = readLast()['tenant'] as LogRecord;
    expect(tenant['fiscal_code']).toBe(REDACTED);
    expect(tenant['vat_number']).toBe(REDACTED);
    expect(tenant['iban']).toBe(REDACTED);
  });

  it('redacts customer fields including nested customer object', () => {
    const { logger, readLast } = createTestLogger();

    logger.info(
      {
        customer_name: 'Mario Rossi',
        customerName: 'Mario Rossi',
        invoice: {
          customer: {
            name: 'Mario Rossi',
            email: 'mario@example.it',
          },
        },
      },
      'customer',
    );

    const record = readLast();
    expect(record['customer_name']).toBe(REDACTED);
    expect(record['customerName']).toBe(REDACTED);
    const customer = (readLast()['invoice'] as LogRecord)['customer'] as LogRecord;
    expect(customer['name']).toBe(REDACTED);
    expect(customer['email']).toBe(REDACTED);
  });

  it('redacts address sub-fields (line1, line2, street, city, zip, postal_code)', () => {
    const { logger, readLast } = createTestLogger();

    logger.info(
      {
        address: {
          line1: 'Via Roma 1',
          line2: 'Scala B',
          street: 'Via Roma',
          city: 'Roma',
          zip: '00100',
          postal_code: '00100',
        },
        billing: {
          address: {
            line1: 'Via Milano 2',
            city: 'Milano',
            postal_code: '20100',
          },
        },
      },
      'address',
    );

    const root = readLast()['address'] as LogRecord;
    expect(root['line1']).toBe(REDACTED);
    expect(root['line2']).toBe(REDACTED);
    expect(root['street']).toBe(REDACTED);
    expect(root['city']).toBe(REDACTED);
    expect(root['zip']).toBe(REDACTED);
    expect(root['postal_code']).toBe(REDACTED);

    const nested = (readLast()['billing'] as LogRecord)['address'] as LogRecord;
    expect(nested['line1']).toBe(REDACTED);
    expect(nested['city']).toBe(REDACTED);
    expect(nested['postal_code']).toBe(REDACTED);
  });

  it('redacts message body and audio URLs (root and nested)', () => {
    const { logger, readLast } = createTestLogger();

    logger.info(
      {
        messageBody: 'Salve, sono Mario, vorrei prenotare',
        body: 'libero',
        audio_url: 'https://example.com/audio.ogg',
        audioUrl: 'https://example.com/audio.ogg',
        message: {
          messageBody: 'testo nested',
          body: 'nested-body',
          audio_url: 'https://example.com/nested.ogg',
        },
      },
      'message',
    );

    const record = readLast();
    expect(record['messageBody']).toBe(REDACTED);
    expect(record['body']).toBe(REDACTED);
    expect(record['audio_url']).toBe(REDACTED);
    expect(record['audioUrl']).toBe(REDACTED);
    const message = record['message'] as LogRecord;
    expect(message['messageBody']).toBe(REDACTED);
    expect(message['body']).toBe(REDACTED);
    expect(message['audio_url']).toBe(REDACTED);
  });

  it('does not redact non-sensitive fields (sanity check)', () => {
    const { logger, readLast } = createTestLogger();

    logger.info(
      {
        requestId: 'req-1',
        durationMs: 42,
        status: 200,
        tenant: { id: 't1', slug: 'studio-roma' },
      },
      'sanity',
    );

    const record = readLast();
    expect(record['requestId']).toBe('req-1');
    expect(record['durationMs']).toBe(42);
    expect(record['status']).toBe(200);
    const tenant = record['tenant'] as LogRecord;
    expect(tenant['id']).toBe('t1');
    expect(tenant['slug']).toBe('studio-roma');
  });
});
