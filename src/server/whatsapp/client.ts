import { AppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';
import { fetchWithTimeout } from '@/lib/http/fetch-with-timeout';
import { logger } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { readCredentialSecret } from '@/server/integrations/credential-encryption';
import { WHATSAPP_PROVIDER } from '@/server/whatsapp/webhook-events';

export type SendWhatsAppTextInput = {
  to: string;
  body: string;
  previewUrl?: boolean;
};

export type SendWhatsAppTextResult = {
  providerMessageId: string;
  rawResponse: unknown;
};

export type WhatsAppTemplateTextParameter = {
  type: 'text';
  text: string;
};

export type WhatsAppTemplateParameter = WhatsAppTemplateTextParameter;

export type WhatsAppTemplateComponent = {
  type: 'header' | 'body' | 'button';
  subType?: 'quick_reply' | 'url';
  index?: string | number;
  parameters?: WhatsAppTemplateParameter[];
};

export type SendWhatsAppTemplateInput = {
  to: string;
  name: string;
  languageCode: string;
  components?: WhatsAppTemplateComponent[];
};

export type SendWhatsAppTemplateResult = SendWhatsAppTextResult;

export interface WhatsAppMessageSender {
  sendText(input: SendWhatsAppTextInput): Promise<SendWhatsAppTextResult>;
  sendTemplate(input: SendWhatsAppTemplateInput): Promise<SendWhatsAppTemplateResult>;
}

type FetchLike = typeof fetch;

export class Dialog360WhatsAppClient implements WhatsAppMessageSender {
  constructor(
    private readonly config: {
      apiUrl?: string;
      apiKey?: string;
      fetcher?: FetchLike;
      /**
       * Invocato quando il provider rifiuta la chiave (401/403). Serve a chi
       * mantiene una cache di credenziali per scartare subito un valore stale
       * invece di riprovarlo fino alla scadenza del TTL.
       */
      onAuthFailure?: () => void;
    } = {},
  ) {}

  async sendText(input: SendWhatsAppTextInput): Promise<SendWhatsAppTextResult> {
    return this.sendMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to,
      type: 'text',
      text: {
        body: input.body,
        preview_url: input.previewUrl ?? false,
      },
    });
  }

  async sendTemplate(input: SendWhatsAppTemplateInput): Promise<SendWhatsAppTemplateResult> {
    return this.sendMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to,
      type: 'template',
      template: {
        name: input.name,
        language: {
          code: input.languageCode,
        },
        ...(input.components && input.components.length > 0
          ? { components: toProviderTemplateComponents(input.components) }
          : {}),
      },
    });
  }

  private async sendMessage(body: Record<string, unknown>): Promise<SendWhatsAppTextResult> {
    const apiKey = this.config.apiKey ?? env.WHATSAPP_API_KEY;

    if (!apiKey) {
      throw new AppError('internal', 'WhatsApp API key is not configured', {
        expose: false,
      });
    }

    const response = await fetchWithTimeout(
      new URL('/messages', this.config.apiUrl ?? env.WHATSAPP_API_URL),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'D360-API-KEY': apiKey,
        },
        body: JSON.stringify(body),
      },
      {
        label: 'WhatsApp send',
        ...(this.config.fetcher !== undefined ? { fetchImpl: this.config.fetcher } : {}),
      },
    );

    const rawResponse = await readJsonResponse(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.config.onAuthFailure?.();
      }

      throw new AppError('upstream_error', 'WhatsApp send failed', {
        cause: {
          status: response.status,
          body: rawResponse,
        },
        expose: false,
      });
    }

    const providerMessageId = extractProviderMessageId(rawResponse);

    if (!providerMessageId) {
      throw new AppError('upstream_error', 'WhatsApp send response did not include a message id', {
        cause: rawResponse,
        expose: false,
      });
    }

    return {
      providerMessageId,
      rawResponse,
    };
  }
}

/**
 * Credenziali WhatsApp per tenant.
 *
 * Il client nasceva senza configurazione e ricadeva su `env.WHATSAPP_API_KEY`:
 * una sola chiave globale, quindi un solo numero WhatsApp per tutti i tenant.
 * Identità di brand, quota di invio e rischio di ban erano condivisi, e il
 * secondo cliente pagante avrebbe risposto dal numero del primo.
 */
export type WhatsAppCredentials = {
  readonly apiKey: string;
  /** `global` segnala una configurazione legacy da migrare, non lo stato normale. */
  readonly source: 'tenant' | 'global';
};

export interface WhatsAppCredentialsResolver {
  resolve(tenantId: string): Promise<WhatsAppCredentials>;
  invalidate(tenantId: string): void;
}

export interface WhatsAppCredentialsStore {
  findActiveCredentials(tenantId: string): Promise<Record<string, unknown> | null>;
}

type CredentialsLogger = {
  warn(context: Record<string, unknown>, message: string): void;
};

/**
 * 5 minuti: evita di rileggere e decifrare la chiave a ogni messaggio di una
 * stessa raffica, e allo stesso tempo fa sparire da sola una chiave ruotata o
 * revocata senza bisogno di riavviare il processo.
 */
const CREDENTIALS_CACHE_TTL_MS = 5 * 60 * 1000;

type CredentialsCacheEntry = {
  readonly credentials: WhatsAppCredentials;
  readonly expiresAt: number;
};

export class TenantWhatsAppCredentialsResolver implements WhatsAppCredentialsResolver {
  private readonly cache = new Map<string, CredentialsCacheEntry>();
  private readonly log: CredentialsLogger;

  constructor(
    private readonly store: WhatsAppCredentialsStore,
    private readonly options: {
      ttlMs?: number;
      globalApiKey?: string;
      now?: () => number;
      logger?: CredentialsLogger;
    } = {},
  ) {
    this.log = options.logger ?? logger;
  }

  async resolve(tenantId: string): Promise<WhatsAppCredentials> {
    const now = (this.options.now ?? Date.now)();
    const cached = this.cache.get(tenantId);

    if (cached && cached.expiresAt > now) {
      return cached.credentials;
    }

    const credentials = await this.load(tenantId);

    this.cache.set(tenantId, {
      credentials,
      expiresAt: now + (this.options.ttlMs ?? CREDENTIALS_CACHE_TTL_MS),
    });

    return credentials;
  }

  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  private async load(tenantId: string): Promise<WhatsAppCredentials> {
    const credentials = await this.store.findActiveCredentials(tenantId);
    const tenantApiKey = credentials ? readCredentialSecret(credentials, 'api_key') : null;

    if (tenantApiKey) {
      return { apiKey: tenantApiKey, source: 'tenant' };
    }

    const globalApiKey = (this.options.globalApiKey ?? env.WHATSAPP_API_KEY).trim();

    if (!globalApiKey) {
      throw new AppError('internal', 'No WhatsApp API key is configured for this tenant', {
        expose: false,
      });
    }

    this.log.warn(
      { tenantId, hasIntegration: credentials !== null },
      'Nessuna credenziale WhatsApp sul tenant: fallback alla chiave globale, configurazione da migrare',
    );

    return { apiKey: globalApiKey, source: 'global' };
  }
}

export class SupabaseWhatsAppCredentialsStore implements WhatsAppCredentialsStore {
  private client: ReturnType<typeof createSupabaseAdminClient> | null = null;

  async findActiveCredentials(tenantId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.supabase()
      .from('integrations')
      .select('credentials')
      .eq('tenant_id', tenantId)
      .eq('provider', WHATSAPP_PROVIDER)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw new AppError('upstream_error', 'Failed to read WhatsApp integration credentials', {
        cause: error,
        expose: false,
      });
    }

    const row = data as { credentials: Record<string, unknown> | null } | null;

    return row?.credentials ?? null;
  }

  private supabase(): ReturnType<typeof createSupabaseAdminClient> {
    // Client creato al primo uso: costruirlo nel campo farebbe fallire
    // l'import del modulo negli ambienti senza credenziali Supabase.
    this.client ??= createSupabaseAdminClient();

    return this.client;
  }
}

export interface WhatsAppMessageSenderResolver {
  resolveSender(tenantId: string): Promise<WhatsAppMessageSender>;
}

export class TenantWhatsAppMessageSenderResolver implements WhatsAppMessageSenderResolver {
  constructor(
    private readonly credentials: WhatsAppCredentialsResolver,
    private readonly config: {
      apiUrl?: string;
      fetcher?: FetchLike;
    } = {},
  ) {}

  async resolveSender(tenantId: string): Promise<WhatsAppMessageSender> {
    const resolved = await this.credentials.resolve(tenantId);

    return new Dialog360WhatsAppClient({
      apiKey: resolved.apiKey,
      ...(this.config.apiUrl !== undefined ? { apiUrl: this.config.apiUrl } : {}),
      ...(this.config.fetcher !== undefined ? { fetcher: this.config.fetcher } : {}),
      onAuthFailure: () => this.credentials.invalidate(tenantId),
    });
  }
}

let sharedCredentialsResolver: WhatsAppCredentialsResolver | null = null;

/**
 * Istanza condivisa di processo: la cache ha senso solo se sopravvive alla
 * singola invocazione del worker.
 */
export function whatsAppCredentialsResolver(): WhatsAppCredentialsResolver {
  sharedCredentialsResolver ??= new TenantWhatsAppCredentialsResolver(
    new SupabaseWhatsAppCredentialsStore(),
  );

  return sharedCredentialsResolver;
}

/** Da chiamare quando un tenant collega o scollega il proprio numero. */
export function invalidateWhatsAppCredentials(tenantId: string): void {
  sharedCredentialsResolver?.invalidate(tenantId);
}

export function createWhatsAppMessageSenderResolver(
  credentials: WhatsAppCredentialsResolver = whatsAppCredentialsResolver(),
): WhatsAppMessageSenderResolver {
  return new TenantWhatsAppMessageSenderResolver(credentials);
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractProviderMessageId(rawResponse: unknown): string | null {
  if (
    typeof rawResponse !== 'object' ||
    rawResponse === null ||
    !('messages' in rawResponse) ||
    !Array.isArray(rawResponse.messages)
  ) {
    return null;
  }

  const firstMessage = rawResponse.messages[0];

  if (
    typeof firstMessage !== 'object' ||
    firstMessage === null ||
    !('id' in firstMessage) ||
    typeof firstMessage.id !== 'string'
  ) {
    return null;
  }

  return firstMessage.id;
}

function toProviderTemplateComponents(
  components: WhatsAppTemplateComponent[],
): Array<Record<string, unknown>> {
  return components.map((component) => ({
    type: component.type,
    ...(component.subType ? { sub_type: component.subType } : {}),
    ...(component.index !== undefined ? { index: component.index } : {}),
    ...(component.parameters && component.parameters.length > 0
      ? { parameters: component.parameters }
      : {}),
  }));
}
