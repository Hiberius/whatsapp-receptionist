/**
 * Escalation a operatore umano.
 *
 * Tre effetti, in quest'ordine e con priorita' decrescente:
 * 1. `conversations.status = 'escalated'` — l'unico effetto che deve riuscire;
 * 2. avviso WhatsApp al cliente — in un momento sensibile il silenzio e' il danno peggiore;
 * 3. email all'indirizzo `tenant_config.human_escalation_email`, con abbastanza
 *    contesto da poter agire senza aprire la dashboard.
 *
 * 2 e 3 sono effetti collaterali: se falliscono vengono loggati e assorbiti.
 * Una escalation registrata e non notificata resta recuperabile dall'inbox;
 * una escalation non registrata e' persa per sempre.
 *
 * L'email viene composta qui e non in `notifications/email-templates.ts` perche'
 * il suo corpo dipende da cosa e' realmente successo (se il cliente ha gia'
 * ricevuto una risposta, se l'avviso e' partito): e' un rendering condizionale
 * sull'esito, non un template statico.
 */

import { z } from 'zod';

import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ConversationChannel, ConversationStatus } from '@/server/conversations/inbox';
import {
  createEmailSender,
  sendEmailQuietly,
  type EmailSender,
  type MailerLogger,
} from '@/server/notifications/mailer';
import type {
  EnqueueOutboundMessageInput,
  EnqueueOutboundMessageResult,
  InsertOutboundMessageInput,
  InsertOutboundMessageResult,
} from '@/server/whatsapp/repository';

// ---------- Contratto ----------

export type EscalationReason =
  | 'sensitive_handoff'
  | 'empty_voice_transcript'
  | 'low_voice_transcript_confidence'
  | 'human_handoff_intent';

export const escalateConversationInputSchema = z
  .object({
    tenantId: z.string().min(1),
    conversationId: z.string().min(1),
    customerIdentifier: z.string().min(1),
    inboundExternalId: z.string().min(1),
    messageText: z.string(),
    occurredAt: z.date(),
    reason: z.enum([
      'sensitive_handoff',
      'empty_voice_transcript',
      'low_voice_transcript_confidence',
      'human_handoff_intent',
    ]),
    /**
     * `true` quando l'auto-reply ha gia' accodato un messaggio per il cliente:
     * in quel caso l'avviso di escalation sarebbe un secondo messaggio ravvicinato.
     */
    aiReplied: z.boolean(),
  })
  .strict();

export type EscalateConversationInput = z.infer<typeof escalateConversationInputSchema>;

export type EscalationNotificationOutcome = {
  recipientConfigured: boolean;
  attempted: boolean;
  delivered: boolean;
};

export type EscalationResult = {
  escalated: boolean;
  alreadyEscalated: boolean;
  customerNotified: boolean;
  email: EscalationNotificationOutcome;
};

/**
 * Porta usata dai chiamanti (auto-reply WhatsApp e futuri canali).
 * Serve a tenere fuori dai loro test la classe concreta, che ha stato privato.
 */
export interface ConversationEscalator {
  escalate(input: EscalateConversationInput): Promise<EscalationResult>;
}

export type EscalationConversationSnapshot = {
  conversationId: string;
  tenantId: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  customerIdentifier: string;
  customerName: string | null;
};

export type EscalationTenantContact = {
  studioName: string;
  escalationEmail: string | null;
  timezone: string;
};

export interface EscalationRepository {
  getConversation(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<EscalationConversationSnapshot | null>;
  /** Ritorna `false` quando nessuna riga e' transitata (conversazione gia' escalated). */
  markConversationEscalated(input: {
    tenantId: string;
    conversationId: string;
    escalatedAt: Date;
  }): Promise<boolean>;
  getTenantEscalationContact(tenantId: string): Promise<EscalationTenantContact>;
}

/**
 * Sottoinsieme del repository WhatsApp necessario per avvisare il cliente.
 * Strutturalmente compatibile con `WhatsAppAutoReplyRepository`, cosi' il
 * chiamante puo' passare il repository che ha gia' in mano.
 */
export interface EscalationCustomerNotifier {
  insertOutboundMessage(input: InsertOutboundMessageInput): Promise<InsertOutboundMessageResult>;
  enqueueOutboundMessage(input: EnqueueOutboundMessageInput): Promise<EnqueueOutboundMessageResult>;
}

export type EscalationServiceDependencies = {
  repository: EscalationRepository;
  emailSender: EmailSender;
  customerNotifier: EscalationCustomerNotifier | null;
  log: MailerLogger;
  appUrl: string;
  now: () => Date;
};

// ---------- Testi ----------

const REASON_LABELS: Record<EscalationReason, string> = {
  sensitive_handoff: 'Messaggio con segnali sensibili (emergenza, salute, legale o sicurezza)',
  empty_voice_transcript: 'Messaggio vocale non trascrivibile',
  low_voice_transcript_confidence: 'Trascrizione del messaggio vocale poco affidabile',
  human_handoff_intent: 'Il cliente ha chiesto di parlare con una persona',
};

const CUSTOMER_NOTICES: Record<EscalationReason, string> = {
  sensitive_handoff:
    'Ho letto il tuo messaggio e ho avvisato subito una persona dello studio: ti ricontatta appena possibile. Se si tratta di un’emergenza medica chiama il 112.',
  empty_voice_transcript:
    'Non sono riuscito ad ascoltare il tuo messaggio vocale. Ho avvisato una persona dello studio: ti ricontatta appena possibile.',
  low_voice_transcript_confidence:
    'Non sono riuscito a capire bene il tuo messaggio vocale. Ho avvisato una persona dello studio: ti ricontatta appena possibile.',
  human_handoff_intent:
    'Ho passato la tua richiesta a una persona dello studio: ti ricontatta appena possibile.',
};

const EMAIL_SUBJECT_MAX_LENGTH = 200;
const EMAIL_MESSAGE_MAX_LENGTH = 2000;
const BRAND_TEAL = '#0d766e';
const BRAND_MUTED = '#5e6b64';

// ---------- Servizio ----------

export class EscalationService implements ConversationEscalator {
  constructor(private readonly deps: EscalationServiceDependencies) {}

  async escalate(rawInput: EscalateConversationInput): Promise<EscalationResult> {
    const input = parseInput(rawInput);
    const conversation = await this.deps.repository.getConversation({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
    });

    if (!conversation) {
      throw new AppError('not_found', 'Conversation not found for escalation');
    }

    if (conversation.status === 'escalated') {
      this.deps.log.info(
        {
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          reason: input.reason,
        },
        'Conversation already escalated, skipping',
      );

      return {
        escalated: false,
        alreadyEscalated: true,
        customerNotified: false,
        email: { recipientConfigured: false, attempted: false, delivered: false },
      };
    }

    const escalatedAt = this.deps.now();
    // La `neq('status','escalated')` nel repository e' la vera barriera contro
    // due webhook concorrenti sulla stessa conversazione: la lettura sopra
    // intercetta solo il caso non concorrente.
    const transitioned = await this.deps.repository.markConversationEscalated({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      escalatedAt,
    });

    if (!transitioned) {
      return {
        escalated: false,
        alreadyEscalated: true,
        customerNotified: false,
        email: { recipientConfigured: false, attempted: false, delivered: false },
      };
    }

    this.deps.log.warn(
      {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        channel: conversation.channel,
        reason: input.reason,
        customerMasked: maskIdentifier(conversation.customerIdentifier),
        aiReplied: input.aiReplied,
      },
      'Conversation escalated to human operator',
    );

    const customerNotified = input.aiReplied
      ? false
      : await this.notifyCustomer(input, conversation, escalatedAt);
    const email = await this.notifyOperator(input, conversation, { customerNotified });

    return {
      escalated: true,
      alreadyEscalated: false,
      customerNotified,
      email,
    };
  }

  private async notifyCustomer(
    input: EscalateConversationInput,
    conversation: EscalationConversationSnapshot,
    escalatedAt: Date,
  ): Promise<boolean> {
    const notifier = this.deps.customerNotifier;

    if (!notifier) {
      return false;
    }

    const body = CUSTOMER_NOTICES[input.reason];
    const metadata = {
      source: 'escalation_notice',
      reason: input.reason,
      inboundExternalId: input.inboundExternalId,
      conversationId: input.conversationId,
    };

    try {
      const outbound = await notifier.insertOutboundMessage({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        externalId: `escalation:${input.inboundExternalId}`,
        content: body,
        createdAt: escalatedAt,
        metadata,
      });

      if (!outbound.created || !outbound.messageId) {
        return false;
      }

      const job = await notifier.enqueueOutboundMessage({
        tenantId: input.tenantId,
        messageId: outbound.messageId,
        recipientIdentifier: conversation.customerIdentifier,
        payload: {
          type: 'text',
          text: { body, previewUrl: false },
          metadata,
        },
      });

      return job.created;
    } catch (error) {
      this.deps.log.error(
        {
          err: error,
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          reason: input.reason,
        },
        'Escalation customer notice failed, escalation kept',
      );

      return false;
    }
  }

  private async notifyOperator(
    input: EscalateConversationInput,
    conversation: EscalationConversationSnapshot,
    context: { customerNotified: boolean },
  ): Promise<EscalationNotificationOutcome> {
    const contact = await this.loadContactSafely(input.tenantId);

    if (!contact || !contact.escalationEmail) {
      this.deps.log.warn(
        {
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          reason: input.reason,
        },
        'Escalation not notified: no human_escalation_email configured for tenant',
      );

      return { recipientConfigured: false, attempted: false, delivered: false };
    }

    const message = buildEscalationEmail({
      to: contact.escalationEmail,
      studioName: contact.studioName,
      timezone: contact.timezone,
      conversationUrl: `${trimTrailingSlash(this.deps.appUrl)}/conversations/${input.conversationId}`,
      customerName: conversation.customerName,
      customerIdentifier: conversation.customerIdentifier,
      messageText: input.messageText,
      occurredAt: input.occurredAt,
      reason: input.reason,
      aiReplied: input.aiReplied,
      customerNotified: context.customerNotified,
    });

    const result = await sendEmailQuietly(message, this.deps.emailSender, this.deps.log);

    return {
      recipientConfigured: true,
      attempted: true,
      delivered: result.delivered,
    };
  }

  private async loadContactSafely(tenantId: string): Promise<EscalationTenantContact | null> {
    try {
      return await this.deps.repository.getTenantEscalationContact(tenantId);
    } catch (error) {
      this.deps.log.error(
        { err: error, tenantId },
        'Failed to read tenant escalation contact, escalation kept',
      );

      return null;
    }
  }
}

export function createEscalationService(
  overrides: Partial<EscalationServiceDependencies> = {},
): EscalationService {
  return new EscalationService({
    repository: overrides.repository ?? new SupabaseEscalationRepository(),
    emailSender: overrides.emailSender ?? createEmailSender(),
    customerNotifier: overrides.customerNotifier ?? null,
    log: overrides.log ?? logger,
    appUrl: overrides.appUrl ?? env.NEXT_PUBLIC_APP_URL,
    now: overrides.now ?? (() => new Date()),
  });
}

// ---------- Rendering email ----------

type EscalationEmailInput = {
  to: string;
  studioName: string;
  timezone: string;
  conversationUrl: string;
  customerName: string | null;
  customerIdentifier: string;
  messageText: string;
  occurredAt: Date;
  reason: EscalationReason;
  aiReplied: boolean;
  customerNotified: boolean;
};

export function buildEscalationEmail(input: EscalationEmailInput): {
  to: string;
  subject: string;
  text: string;
  html: string;
} {
  const label = REASON_LABELS[input.reason];
  const receivedAt = formatInTimezone(input.occurredAt, input.timezone);
  const customer = input.customerName
    ? `${input.customerName} (${input.customerIdentifier})`
    : input.customerIdentifier;
  const excerpt = truncate(input.messageText.trim(), EMAIL_MESSAGE_MAX_LENGTH);
  const statusLine = describeCustomerStatus(input);
  const subject = truncate(
    `Escalation WhatsApp — ${input.studioName} — ${shortReason(input.reason)}`,
    EMAIL_SUBJECT_MAX_LENGTH,
  );

  const text = [
    'Una conversazione WhatsApp e stata passata a un operatore umano.',
    '',
    `Motivo: ${label}`,
    `Cliente: ${customer}`,
    `Messaggio ricevuto: ${receivedAt}`,
    '',
    excerpt.length > 0 ? `"${excerpt}"` : '(nessun testo disponibile)',
    '',
    statusLine,
    '',
    `Apri la conversazione: ${input.conversationUrl}`,
    '',
    'La conversazione e ora in stato Escalation nella dashboard Ambrogio.ai.',
  ].join('\n');

  const html = [
    `<p><strong>Una conversazione WhatsApp e stata passata a un operatore umano.</strong></p>`,
    `<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:16px 0;">`,
    `<tr><td style="color:${BRAND_MUTED};">Motivo:</td><td>${escapeHtml(label)}</td></tr>`,
    `<tr><td style="color:${BRAND_MUTED};">Cliente:</td><td><strong>${escapeHtml(customer)}</strong></td></tr>`,
    `<tr><td style="color:${BRAND_MUTED};">Ricevuto:</td><td>${escapeHtml(receivedAt)}</td></tr>`,
    `</table>`,
    `<blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid ${BRAND_TEAL};background:#f3f7f5;">${
      excerpt.length > 0 ? escapeHtml(excerpt) : '<em>nessun testo disponibile</em>'
    }</blockquote>`,
    `<p>${escapeHtml(statusLine)}</p>`,
    `<p><a href="${escapeHtml(input.conversationUrl)}" style="display:inline-block;padding:12px 24px;background:${BRAND_TEAL};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Apri la conversazione</a></p>`,
    `<p style="color:${BRAND_MUTED};font-size:13px;">La conversazione e ora in stato Escalation nella dashboard Ambrogio.ai.</p>`,
  ].join('\n');

  return { to: input.to, subject, text, html };
}

function describeCustomerStatus(input: { aiReplied: boolean; customerNotified: boolean }): string {
  if (input.aiReplied) {
    return 'L assistente AI ha gia risposto al cliente su questo messaggio.';
  }

  if (input.customerNotified) {
    return 'Al cliente e stato inviato un avviso che una persona lo ricontattera al piu presto.';
  }

  return 'ATTENZIONE: il cliente non ha ricevuto nessuna risposta. Ricontattalo tu al piu presto.';
}

function shortReason(reason: EscalationReason): string {
  switch (reason) {
    case 'sensitive_handoff':
      return 'messaggio sensibile';
    case 'empty_voice_transcript':
      return 'vocale non trascrivibile';
    case 'low_voice_transcript_confidence':
      return 'vocale poco chiaro';
    case 'human_handoff_intent':
      return 'richiesta operatore';
  }
}

// ---------- Repository Supabase ----------

export class SupabaseEscalationRepository implements EscalationRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getConversation(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<EscalationConversationSnapshot | null> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('id, tenant_id, channel, status, customer_identifier, customer_name')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.conversationId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read conversation for escalation', error);
    }

    if (!data) {
      return null;
    }

    return {
      conversationId: data.id as string,
      tenantId: data.tenant_id as string,
      channel: data.channel as ConversationChannel,
      status: data.status as ConversationStatus,
      customerIdentifier: data.customer_identifier as string,
      customerName: (data.customer_name as string | null) ?? null,
    };
  }

  async markConversationEscalated(input: {
    tenantId: string;
    conversationId: string;
    escalatedAt: Date;
  }): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('conversations')
      .update({
        status: 'escalated',
        updated_at: input.escalatedAt.toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.conversationId)
      .neq('status', 'escalated')
      .select('id')
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to mark conversation escalated', error);
    }

    return Boolean(data?.id);
  }

  async getTenantEscalationContact(tenantId: string): Promise<EscalationTenantContact> {
    const tenant = await this.supabase
      .from('tenants')
      .select('name, timezone')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenant.error) {
      throw toRepositoryError('Failed to read tenant for escalation', tenant.error);
    }

    const config = await this.supabase
      .from('tenant_config')
      .select('studio_name, human_escalation_email')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (config.error) {
      throw toRepositoryError('Failed to read tenant escalation contact', config.error);
    }

    const tenantName = (tenant.data?.name as string | undefined) ?? 'Studio';

    return {
      studioName: (config.data?.studio_name as string | undefined) ?? tenantName,
      escalationEmail: (config.data?.human_escalation_email as string | null | undefined) ?? null,
      timezone: (tenant.data?.timezone as string | undefined) ?? 'Europe/Rome',
    };
  }
}

// ---------- Utilita' ----------

function parseInput(input: EscalateConversationInput): EscalateConversationInput {
  const parsed = escalateConversationInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError('bad_request', 'Invalid escalation input', {
      cause: parsed.error,
      expose: false,
    });
  }

  return parsed.data;
}

/** Il numero cliente non e' coperto dai path di redazione Pino sotto questo nome. */
function maskIdentifier(identifier: string): string {
  return identifier.length <= 4 ? '***' : `***${identifier.slice(-4)}`;
}

function formatInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('it-IT', {
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
