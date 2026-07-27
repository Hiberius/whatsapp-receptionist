import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import {
  createEmailSender,
  maskRecipient,
  NoopEmailSender,
  ResendEmailSender,
  sendEmailQuietly,
  type EmailMessage,
  type FetchLike,
  type MailerLogger,
} from '@/server/notifications/mailer';

type LogEntry = {
  level: 'info' | 'warn' | 'error';
  obj: Record<string, unknown>;
  msg: string;
};

/** Logger fake che registra gli argomenti ricevuti, così le assert leggono il contenuto reale. */
function createRecordingLogger(): { log: MailerLogger; entries: LogEntry[] } {
  const entries: LogEntry[] = [];

  return {
    entries,
    log: {
      info: (obj, msg) => entries.push({ level: 'info', obj, msg }),
      warn: (obj, msg) => entries.push({ level: 'warn', obj, msg }),
      error: (obj, msg) => entries.push({ level: 'error', obj, msg }),
    },
  };
}

type FetchCall = { url: string; init: RequestInit };

/** Fetch fake che registra url e init di ogni chiamata. */
function createRecordingFetch(response: () => Response): {
  fetchFn: FetchLike;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];

  return {
    calls,
    fetchFn: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(response());
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const message: EmailMessage = {
  to: 'mario.rossi@studio.it',
  subject: 'Escalation richiesta',
  text: 'Un cliente ha chiesto di parlare con un operatore.',
  html: '<p>Un cliente ha chiesto di parlare con un operatore.</p>',
};

function readPayload(call: FetchCall): Record<string, unknown> {
  const body = call.init.body;
  expect(typeof body).toBe('string');
  const parsed: unknown = JSON.parse(String(body));
  expect(typeof parsed).toBe('object');
  return parsed as Record<string, unknown>;
}

describe('ResendEmailSender', () => {
  it('POSTa il payload Resend corretto con Authorization Bearer', async () => {
    const { fetchFn, calls } = createRecordingFetch(() => jsonResponse({ id: 'msg_123' }));
    const { log } = createRecordingLogger();

    const sender = new ResendEmailSender({
      apiKey: 'test-key',
      from: 'Ambrogio.ai <hello@ambrogio.ai>',
      apiUrl: 'https://api.resend.test/emails',
      fetchFn,
      log,
    });

    const result = await sender.send(message);

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://api.resend.test/emails');
    expect(call.init.method).toBe('POST');
    expect(call.init.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    });

    expect(readPayload(call)).toEqual({
      from: 'Ambrogio.ai <hello@ambrogio.ai>',
      to: ['mario.rossi@studio.it'],
      subject: 'Escalation richiesta',
      text: 'Un cliente ha chiesto di parlare con un operatore.',
      html: '<p>Un cliente ha chiesto di parlare con un operatore.</p>',
    });

    expect(result).toEqual({
      delivered: true,
      provider: 'resend',
      providerMessageId: 'msg_123',
    });
  });

  it('mappa replyTo su reply_to solo quando valorizzato', async () => {
    const { fetchFn, calls } = createRecordingFetch(() => jsonResponse({ id: 'msg_456' }));
    const { log } = createRecordingLogger();

    const sender = new ResendEmailSender({
      apiKey: 'test-key',
      from: 'Ambrogio.ai <hello@ambrogio.ai>',
      apiUrl: 'https://api.resend.test/emails',
      fetchFn,
      log,
    });

    await sender.send({ ...message, replyTo: 'operatore@studio.it' });

    expect(readPayload(calls[0]!)).toMatchObject({ reply_to: 'operatore@studio.it' });
  });

  it('lancia AppError upstream_error e logga quando Resend risponde con errore HTTP', async () => {
    const { fetchFn, calls } = createRecordingFetch(
      () => new Response('domain not verified', { status: 422 }),
    );
    const { log, entries } = createRecordingLogger();

    const sender = new ResendEmailSender({
      apiKey: 'test-key',
      from: 'Ambrogio.ai <hello@ambrogio.ai>',
      apiUrl: 'https://api.resend.test/emails',
      fetchFn,
      log,
    });

    await expect(sender.send(message)).rejects.toMatchObject({
      code: 'upstream_error',
      expose: false,
    });

    expect(calls).toHaveLength(1);

    const errorEntry = entries.find((entry) => entry.level === 'error');
    expect(errorEntry?.obj).toMatchObject({
      status: 422,
      recipientMasked: 'm***@studio.it',
      subject: 'Escalation richiesta',
    });
  });

  it('rifiuta una risposta Resend senza id', async () => {
    const { fetchFn } = createRecordingFetch(() => jsonResponse({ unexpected: true }));
    const { log } = createRecordingLogger();

    const sender = new ResendEmailSender({
      apiKey: 'test-key',
      from: 'Ambrogio.ai <hello@ambrogio.ai>',
      apiUrl: 'https://api.resend.test/emails',
      fetchFn,
      log,
    });

    await expect(sender.send(message)).rejects.toBeInstanceOf(AppError);
  });

  it('rifiuta un destinatario non valido senza chiamare la rete', async () => {
    const { fetchFn, calls } = createRecordingFetch(() => jsonResponse({ id: 'msg_789' }));
    const { log } = createRecordingLogger();

    const sender = new ResendEmailSender({
      apiKey: 'test-key',
      from: 'Ambrogio.ai <hello@ambrogio.ai>',
      apiUrl: 'https://api.resend.test/emails',
      fetchFn,
      log,
    });

    await expect(sender.send({ ...message, to: 'non-una-email' })).rejects.toMatchObject({
      code: 'bad_request',
    });
    expect(calls).toHaveLength(0);
  });
});

describe('NoopEmailSender', () => {
  it('non spedisce e segnala nel log che l email NON è partita', async () => {
    const { log, entries } = createRecordingLogger();
    const sender = new NoopEmailSender(log, 'resend_api_key_missing');

    const result = await sender.send(message);

    expect(result).toEqual({
      delivered: false,
      provider: 'noop',
      providerMessageId: null,
    });

    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.level).toBe('warn');
    expect(entry.msg).toContain('EMAIL NON SPEDITA');
    expect(entry.obj).toMatchObject({
      reason: 'resend_api_key_missing',
      delivered: false,
      recipientMasked: 'm***@studio.it',
      subject: 'Escalation richiesta',
      textPreview: 'Un cliente ha chiesto di parlare con un operatore.',
    });
  });

  it('valida comunque il messaggio', async () => {
    const { log } = createRecordingLogger();
    const sender = new NoopEmailSender(log, 'resend_api_key_missing');

    await expect(sender.send({ ...message, subject: '' })).rejects.toMatchObject({
      code: 'bad_request',
    });
  });
});

describe('createEmailSender', () => {
  it('ricade sul Noop senza lanciare quando manca la API key', async () => {
    const { log, entries } = createRecordingLogger();
    const { fetchFn, calls } = createRecordingFetch(() => jsonResponse({ id: 'msg_000' }));

    const sender = createEmailSender({ apiKey: '', log, fetchFn });
    const result = await sender.send(message);

    expect(result.provider).toBe('noop');
    expect(result.delivered).toBe(false);
    expect(calls).toHaveLength(0);
    expect(entries[0]?.obj).toMatchObject({ reason: 'resend_api_key_missing' });
  });

  it('ricade sul Noop quando manca il mittente', async () => {
    const { log, entries } = createRecordingLogger();

    const sender = createEmailSender({ apiKey: 'test-key', from: '', log });
    await sender.send(message);

    expect(entries[0]?.obj).toMatchObject({ reason: 'resend_from_email_missing' });
  });

  it('usa Resend quando la API key è configurata', async () => {
    const { log } = createRecordingLogger();
    const { fetchFn, calls } = createRecordingFetch(() => jsonResponse({ id: 'msg_999' }));

    const sender = createEmailSender({
      apiKey: 'test-key',
      from: 'Ambrogio.ai <hello@ambrogio.ai>',
      apiUrl: 'https://api.resend.test/emails',
      fetchFn,
      log,
    });

    const result = await sender.send(message);

    expect(result.provider).toBe('resend');
    expect(result.providerMessageId).toBe('msg_999');
    expect(calls[0]?.url).toBe('https://api.resend.test/emails');
  });
});

describe('sendEmailQuietly', () => {
  it('assorbe il fallimento del sender e lo registra nel log', async () => {
    const { log, entries } = createRecordingLogger();
    const failing = {
      send: () => Promise.reject(new AppError('upstream_error', 'Resend down')),
    };

    const result = await sendEmailQuietly(message, failing, log);

    expect(result).toEqual({
      delivered: false,
      provider: 'failed',
      providerMessageId: null,
    });

    const errorEntry = entries.find((entry) => entry.level === 'error');
    expect(errorEntry?.obj).toMatchObject({
      recipientMasked: 'm***@studio.it',
      subject: 'Escalation richiesta',
    });
  });

  it('propaga il risultato quando la spedizione riesce', async () => {
    const { log } = createRecordingLogger();
    const { fetchFn } = createRecordingFetch(() => jsonResponse({ id: 'msg_ok' }));

    const sender = createEmailSender({
      apiKey: 'test-key',
      from: 'Ambrogio.ai <hello@ambrogio.ai>',
      apiUrl: 'https://api.resend.test/emails',
      fetchFn,
      log,
    });

    const result = await sendEmailQuietly(message, sender, log);

    expect(result).toEqual({
      delivered: true,
      provider: 'resend',
      providerMessageId: 'msg_ok',
    });
  });
});

describe('maskRecipient', () => {
  it('mantiene solo iniziale e dominio', () => {
    expect(maskRecipient('mario.rossi@studio.it')).toBe('m***@studio.it');
  });

  it('non espone nulla per input senza local part', () => {
    expect(maskRecipient('@studio.it')).toBe('***');
    expect(maskRecipient('non-una-email')).toBe('***');
  });
});
