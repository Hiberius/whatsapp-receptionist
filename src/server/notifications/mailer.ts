/**
 * Trasporto email transazionale.
 *
 * Il layer di rendering vive in `email-templates.ts` e produce `{ subject, text, html }`:
 * questo modulo si occupa solo della spedizione.
 *
 * Due implementazioni:
 * - `ResendEmailSender` — HTTP su https://api.resend.com/emails (nessuna dipendenza npm, solo fetch).
 * - `NoopEmailSender` — logga il messaggio senza spedirlo, usato quando RESEND_API_KEY manca.
 */

import { z } from 'zod';

import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';

// ---------- Contratto ----------

export const emailMessageSchema = z
  .object({
    to: z.string().email(),
    subject: z.string().min(1).max(200),
    text: z.string().min(1),
    html: z.string().min(1),
    replyTo: z.string().email().optional(),
  })
  .strict();

export type EmailMessage = z.infer<typeof emailMessageSchema>;

/** `failed` è riservato all'esito di `sendEmailQuietly` quando la spedizione è stata assorbita. */
export type EmailProvider = 'resend' | 'noop' | 'failed';

export interface EmailSendResult {
  /**
   * `false` quando il messaggio è stato solo loggato (NoopEmailSender).
   * Chi legge questo risultato non deve poter confondere "chiamata riuscita"
   * con "email realmente consegnata al provider".
   */
  delivered: boolean;
  provider: EmailProvider;
  providerMessageId: string | null;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** Sottoinsieme di Pino usato qui: tenerlo stretto permette di iniettare un fake nei test. */
export interface MailerLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface EmailSenderConfig {
  apiKey: string;
  from: string;
  apiUrl: string;
  fetchFn: FetchLike;
  log: MailerLogger;
}

const NOOP_LOG_MESSAGE = 'EMAIL NON SPEDITA — trasporto email non configurato (NoopEmailSender)';
const NOOP_TEXT_PREVIEW_CHARS = 500;

// ---------- Utilità ----------

function parseMessage(message: EmailMessage): EmailMessage {
  const parsed = emailMessageSchema.safeParse(message);

  if (!parsed.success) {
    throw new AppError('bad_request', 'Invalid email message payload', {
      cause: parsed.error,
      expose: false,
    });
  }

  return parsed.data;
}

/**
 * I path di redazione di Pino coprono `email`/`*.email`, non un campo `to`.
 * Mascherare qui evita di far finire indirizzi completi nei log a causa del
 * nome di campo scelto.
 */
export function maskRecipient(address: string): string {
  const atIndex = address.lastIndexOf('@');

  if (atIndex <= 0) {
    return '***';
  }

  return `${address.slice(0, 1)}***${address.slice(atIndex)}`;
}

// ---------- Resend ----------

const resendSuccessSchema = z.object({ id: z.string().min(1) });

export class ResendEmailSender implements EmailSender {
  constructor(private readonly config: EmailSenderConfig) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const parsed = parseMessage(message);

    const payload = {
      from: this.config.from,
      to: [parsed.to],
      subject: parsed.subject,
      text: parsed.text,
      html: parsed.html,
      ...(parsed.replyTo !== undefined ? { reply_to: parsed.replyTo } : {}),
    };

    const response = await this.config.fetchFn(this.config.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.config.log.error(
        {
          status: response.status,
          recipientMasked: maskRecipient(parsed.to),
          subject: parsed.subject,
        },
        'Resend email delivery failed',
      );
      throw new AppError('upstream_error', `Resend API error: ${response.status} ${errorText}`, {
        expose: false,
      });
    }

    const body: unknown = await response.json();
    const result = resendSuccessSchema.safeParse(body);

    if (!result.success) {
      throw new AppError('upstream_error', 'Unexpected Resend API response shape', {
        cause: result.error,
        expose: false,
      });
    }

    return {
      delivered: true,
      provider: 'resend',
      providerMessageId: result.data.id,
    };
  }
}

// ---------- Noop ----------

export class NoopEmailSender implements EmailSender {
  constructor(
    private readonly log: MailerLogger,
    private readonly reason: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const parsed = parseMessage(message);

    this.log.warn(
      {
        reason: this.reason,
        delivered: false,
        recipientMasked: maskRecipient(parsed.to),
        subject: parsed.subject,
        textPreview: parsed.text.slice(0, NOOP_TEXT_PREVIEW_CHARS),
      },
      NOOP_LOG_MESSAGE,
    );

    return {
      delivered: false,
      provider: 'noop',
      providerMessageId: null,
    };
  }
}

// ---------- Factory ----------

export function createEmailSender(overrides: Partial<EmailSenderConfig> = {}): EmailSender {
  const log = overrides.log ?? logger;
  const apiKey = overrides.apiKey ?? env.RESEND_API_KEY;
  const from = overrides.from ?? env.RESEND_FROM_EMAIL;

  if (apiKey === '') {
    return new NoopEmailSender(log, 'resend_api_key_missing');
  }

  if (from === '') {
    return new NoopEmailSender(log, 'resend_from_email_missing');
  }

  return new ResendEmailSender({
    apiKey,
    from,
    apiUrl: overrides.apiUrl ?? env.RESEND_API_URL,
    fetchFn: overrides.fetchFn ?? ((input, init) => fetch(input, init)),
    log,
  });
}

// ---------- Confine di errore ----------

/**
 * Confine oltre il quale un fallimento di spedizione non risale.
 *
 * Sta qui e non dentro `ResendEmailSender.send` perché il sender deve restare
 * onesto: un job di retry o una route che vuole rispondere 502 ha bisogno di
 * vedere l'errore. I chiamanti per cui l'email è un effetto collaterale
 * (escalation, contatto, cancellazione account) usano questa funzione: l'azione
 * di dominio è già avvenuta e non va annullata perché il provider email è giù.
 */
export async function sendEmailQuietly(
  message: EmailMessage,
  sender: EmailSender = createEmailSender(),
  log: MailerLogger = logger,
): Promise<EmailSendResult> {
  try {
    return await sender.send(message);
  } catch (error) {
    log.error(
      {
        err: error,
        recipientMasked: maskRecipient(message.to),
        subject: message.subject,
      },
      'Email delivery failed, continuing without it',
    );

    return {
      delivered: false,
      provider: 'failed',
      providerMessageId: null,
    };
  }
}
