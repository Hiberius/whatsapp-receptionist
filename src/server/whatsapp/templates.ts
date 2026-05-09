import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type {
  EnqueueOutboundMessageInput,
  EnqueueOutboundMessageResult,
  InsertOutboundMessageInput,
  InsertOutboundMessageResult,
} from '@/server/whatsapp/repository';
import { SupabaseWhatsAppWebhookRepository } from '@/server/whatsapp/repository';

const whatsappTemplateDefinitions = {
  appointment_confirmation: {
    name: 'appointment_confirmation',
    category: 'utility',
    defaultLanguageCode: 'it',
    requiredVariables: ['customerName', 'serviceName', 'scheduledAt', 'studioName'],
    renderPreview: (variables: TemplateVariables) =>
      `Conferma appuntamento per ${variables.customerName}: ${variables.serviceName} il ${variables.scheduledAt} presso ${variables.studioName}.`,
  },
  appointment_reminder_24h: {
    name: 'appointment_reminder_24h',
    category: 'utility',
    defaultLanguageCode: 'it',
    requiredVariables: ['customerName', 'scheduledAt', 'studioName'],
    renderPreview: (variables: TemplateVariables) =>
      `Promemoria per ${variables.customerName}: appuntamento ${variables.scheduledAt} presso ${variables.studioName}.`,
  },
  appointment_reminder_1h: {
    name: 'appointment_reminder_1h',
    category: 'utility',
    defaultLanguageCode: 'it',
    requiredVariables: ['customerName', 'scheduledAt', 'studioName'],
    renderPreview: (variables: TemplateVariables) =>
      `Promemoria per ${variables.customerName}: appuntamento tra poco, ${variables.scheduledAt}, presso ${variables.studioName}.`,
  },
  appointment_cancellation: {
    name: 'appointment_cancellation',
    category: 'utility',
    defaultLanguageCode: 'it',
    requiredVariables: ['customerName', 'scheduledAt', 'studioName'],
    renderPreview: (variables: TemplateVariables) =>
      `Avviso per ${variables.customerName}: appuntamento del ${variables.scheduledAt} presso ${variables.studioName} annullato.`,
  },
} as const;

export type WhatsAppTemplateKey = keyof typeof whatsappTemplateDefinitions;
export type TemplateVariables = Record<string, string>;

export type ApprovedWhatsAppTemplate = {
  id: string;
  name: string;
  languageCode: string;
  category: 'utility' | 'marketing' | 'authentication';
};

export type EnqueueTemplateMessageInput = {
  tenantId: string;
  conversationId: string;
  recipientIdentifier: string;
  templateKey: WhatsAppTemplateKey;
  variables: TemplateVariables;
  idempotencyKey: string;
  languageCode?: string;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
};

export type EnqueueTemplateMessageResult = {
  queued: boolean;
  skippedReason: 'duplicate_outbound' | null;
  outboundMessageId: string | null;
  outboxJobId: string | null;
  templateName: string;
  languageCode: string;
};

export interface WhatsAppTemplateMessageRepository {
  findApprovedTemplate(input: {
    tenantId: string;
    name: string;
    languageCode: string;
  }): Promise<ApprovedWhatsAppTemplate | null>;
  insertOutboundMessage(input: InsertOutboundMessageInput): Promise<InsertOutboundMessageResult>;
  enqueueOutboundMessage(input: EnqueueOutboundMessageInput): Promise<EnqueueOutboundMessageResult>;
  incrementUsage(input: {
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
  }): Promise<void>;
}

type WhatsAppTemplateDefinition = (typeof whatsappTemplateDefinitions)[WhatsAppTemplateKey];

type WhatsAppMessageTemplateRow = {
  id: string;
  name: string;
  language_code: string;
  category: 'utility' | 'marketing' | 'authentication';
};

export class WhatsAppTemplateMessageService {
  constructor(private readonly repository: WhatsAppTemplateMessageRepository) {}

  async enqueueTemplateMessage(
    input: EnqueueTemplateMessageInput,
  ): Promise<EnqueueTemplateMessageResult> {
    const definition = whatsappTemplateDefinitions[input.templateKey];
    const languageCode = input.languageCode?.trim() || definition.defaultLanguageCode;
    const variables = normalizeAndValidateVariables(definition, input.variables);
    const approvedTemplate = await this.repository.findApprovedTemplate({
      tenantId: input.tenantId,
      name: definition.name,
      languageCode,
    });

    if (!approvedTemplate) {
      throw new AppError(
        'bad_request',
        `WhatsApp template ${definition.name}/${languageCode} is not approved for this tenant`,
      );
    }

    const createdAt = input.createdAt ?? new Date();
    const outbound = await this.repository.insertOutboundMessage({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      externalId: templateExternalId(definition.name, input.idempotencyKey),
      content: definition.renderPreview(variables),
      createdAt,
      metadata: {
        ...(input.metadata ?? {}),
        source: 'whatsapp_template',
        templateKey: input.templateKey,
        templateName: approvedTemplate.name,
        templateLanguageCode: approvedTemplate.languageCode,
        templateCategory: approvedTemplate.category,
        templateId: approvedTemplate.id,
        idempotencyKey: input.idempotencyKey,
      },
    });

    if (!outbound.created || !outbound.messageId) {
      return {
        queued: false,
        skippedReason: 'duplicate_outbound',
        outboundMessageId: null,
        outboxJobId: null,
        templateName: approvedTemplate.name,
        languageCode: approvedTemplate.languageCode,
      };
    }

    await this.repository.incrementUsage({
      tenantId: input.tenantId,
      metricMonth: toMetricMonth(createdAt),
      messagesDelta: 1,
    });

    const outbox = await this.repository.enqueueOutboundMessage({
      tenantId: input.tenantId,
      messageId: outbound.messageId,
      recipientIdentifier: input.recipientIdentifier,
      payload: {
        type: 'template',
        template: {
          name: approvedTemplate.name,
          languageCode: approvedTemplate.languageCode,
          components: [
            {
              type: 'body',
              parameters: definition.requiredVariables.map((variableName) => ({
                type: 'text',
                text: variables[variableName],
              })),
            },
          ],
        },
        metadata: {
          ...(input.metadata ?? {}),
          source: 'whatsapp_template',
          templateKey: input.templateKey,
          templateName: approvedTemplate.name,
          templateLanguageCode: approvedTemplate.languageCode,
          templateCategory: approvedTemplate.category,
          templateId: approvedTemplate.id,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    return {
      queued: Boolean(outbox.created && outbox.jobId),
      skippedReason: outbox.created ? null : 'duplicate_outbound',
      outboundMessageId: outbound.messageId,
      outboxJobId: outbox.jobId,
      templateName: approvedTemplate.name,
      languageCode: approvedTemplate.languageCode,
    };
  }
}

export class SupabaseWhatsAppTemplateMessageRepository implements WhatsAppTemplateMessageRepository {
  private readonly supabase = createSupabaseAdminClient();
  private readonly outboundRepository = new SupabaseWhatsAppWebhookRepository();

  async findApprovedTemplate(input: {
    tenantId: string;
    name: string;
    languageCode: string;
  }): Promise<ApprovedWhatsAppTemplate | null> {
    const { data, error } = await this.supabase
      .from('whatsapp_message_templates')
      .select('id, name, language_code, category')
      .eq('tenant_id', input.tenantId)
      .eq('provider', 'whatsapp_360dialog')
      .eq('name', input.name)
      .eq('language_code', input.languageCode)
      .eq('status', 'approved')
      .maybeSingle();

    if (error) {
      throw new AppError('upstream_error', 'Failed to read WhatsApp template', {
        cause: error,
        expose: false,
      });
    }

    if (!data) {
      return null;
    }

    const row = data as WhatsAppMessageTemplateRow;

    return {
      id: row.id,
      name: row.name,
      languageCode: row.language_code,
      category: row.category,
    };
  }

  async insertOutboundMessage(
    input: InsertOutboundMessageInput,
  ): Promise<InsertOutboundMessageResult> {
    return this.outboundRepository.insertOutboundMessage(input);
  }

  async enqueueOutboundMessage(
    input: EnqueueOutboundMessageInput,
  ): Promise<EnqueueOutboundMessageResult> {
    return this.outboundRepository.enqueueOutboundMessage(input);
  }

  async incrementUsage(input: {
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
  }): Promise<void> {
    await this.outboundRepository.incrementUsage(input);
  }
}

export function createWhatsAppTemplateMessageService(): WhatsAppTemplateMessageService {
  return new WhatsAppTemplateMessageService(new SupabaseWhatsAppTemplateMessageRepository());
}

export function getWhatsAppTemplateDefinition(
  key: WhatsAppTemplateKey,
): WhatsAppTemplateDefinition {
  return whatsappTemplateDefinitions[key];
}

function normalizeAndValidateVariables(
  definition: WhatsAppTemplateDefinition,
  variables: TemplateVariables,
): TemplateVariables {
  const normalized: TemplateVariables = {};

  for (const variableName of definition.requiredVariables) {
    const value = variables[variableName]?.trim();

    if (!value) {
      throw new AppError('bad_request', `Missing WhatsApp template variable: ${variableName}`);
    }

    normalized[variableName] = value;
  }

  return normalized;
}

function templateExternalId(templateName: string, idempotencyKey: string): string {
  const key = idempotencyKey.trim();

  if (!key) {
    throw new AppError('bad_request', 'WhatsApp template idempotency key is required');
  }

  return `template:${templateName}:${key}`;
}

function toMetricMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `${year}-${month}-01`;
}
