import { AppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type SyncedWhatsAppTemplateStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'paused'
  | 'disabled';

export type SyncedWhatsAppTemplate = {
  name: string;
  languageCode: string;
  category: 'utility' | 'marketing' | 'authentication';
  status: SyncedWhatsAppTemplateStatus;
  externalId: string | null;
  qualityRating: string | null;
  components: unknown[];
  raw: Record<string, unknown>;
};

export type SyncWhatsAppTemplatesResult = {
  fetchedTemplates: number;
  syncedTemplates: number;
  skippedTemplates: number;
};

export interface WhatsAppTemplateListClient {
  listTemplates(): Promise<unknown>;
}

export interface WhatsAppTemplateSyncRepository {
  upsertTemplates(input: {
    tenantId: string;
    templates: SyncedWhatsAppTemplate[];
    syncedAt: Date;
  }): Promise<void>;
}

type FetchLike = typeof fetch;

export class Dialog360WhatsAppTemplateClient implements WhatsAppTemplateListClient {
  constructor(
    private readonly config: {
      apiUrl?: string;
      apiKey?: string;
      fetcher?: FetchLike;
    } = {},
  ) {}

  async listTemplates(): Promise<unknown> {
    const apiKey = this.config.apiKey ?? env.WHATSAPP_API_KEY;

    if (!apiKey) {
      throw new AppError('internal', 'WhatsApp API key is not configured', {
        expose: false,
      });
    }

    const url = new URL('/v1/configs/templates', this.config.apiUrl ?? env.WHATSAPP_API_URL);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('sort', 'name');

    const response = await (this.config.fetcher ?? fetch)(url, {
      method: 'GET',
      headers: {
        'D360-API-KEY': apiKey,
      },
    });
    const rawResponse = await readJsonResponse(response);

    if (!response.ok) {
      throw new AppError('upstream_error', 'WhatsApp template sync failed', {
        cause: {
          status: response.status,
          body: rawResponse,
        },
        expose: false,
      });
    }

    return rawResponse;
  }
}

export class WhatsAppTemplateSyncService {
  constructor(
    private readonly client: WhatsAppTemplateListClient,
    private readonly repository: WhatsAppTemplateSyncRepository,
  ) {}

  async syncTenantTemplates(input: {
    tenantId: string;
    now?: Date;
  }): Promise<SyncWhatsAppTemplatesResult> {
    const rawResponse = await this.client.listTemplates();
    const rawTemplates = extractTemplateItems(rawResponse);
    const templates = rawTemplates
      .map(normalizeTemplate)
      .filter((template): template is SyncedWhatsAppTemplate => template !== null);

    if (templates.length > 0) {
      await this.repository.upsertTemplates({
        tenantId: input.tenantId,
        templates,
        syncedAt: input.now ?? new Date(),
      });
    }

    return {
      fetchedTemplates: rawTemplates.length,
      syncedTemplates: templates.length,
      skippedTemplates: rawTemplates.length - templates.length,
    };
  }
}

export class SupabaseWhatsAppTemplateSyncRepository implements WhatsAppTemplateSyncRepository {
  private readonly supabase = createSupabaseAdminClient();

  async upsertTemplates(input: {
    tenantId: string;
    templates: SyncedWhatsAppTemplate[];
    syncedAt: Date;
  }): Promise<void> {
    const rows = input.templates.map((template) => ({
      tenant_id: input.tenantId,
      provider: 'whatsapp_360dialog',
      name: template.name,
      language_code: template.languageCode,
      category: template.category,
      status: template.status,
      external_id: template.externalId,
      quality_rating: template.qualityRating,
      components: template.components,
      last_synced_at: input.syncedAt.toISOString(),
      metadata: {
        raw: template.raw,
      },
    }));

    const { error } = await this.supabase.from('whatsapp_message_templates').upsert(rows, {
      onConflict: 'tenant_id,provider,name,language_code',
    });

    if (error) {
      throw new AppError('upstream_error', 'Failed to upsert WhatsApp templates', {
        cause: error,
        expose: false,
      });
    }
  }
}

export function createWhatsAppTemplateSyncService(): WhatsAppTemplateSyncService {
  return new WhatsAppTemplateSyncService(
    new Dialog360WhatsAppTemplateClient(),
    new SupabaseWhatsAppTemplateSyncRepository(),
  );
}

export function normalizeTemplate(value: Record<string, unknown>): SyncedWhatsAppTemplate | null {
  const name = getString(value.name);
  const languageCode = getString(value.language_code) ?? getString(value.language) ?? 'it';
  const category = normalizeCategory(value.category);
  const status = normalizeStatus(value.status);

  if (!name || !category || !status) {
    return null;
  }

  return {
    name,
    languageCode,
    category,
    status,
    externalId: getString(value.external_id) ?? getString(value.id) ?? getString(value.template_id),
    qualityRating:
      getString(value.quality_rating) ?? getString(value.quality) ?? getString(value.quality_score),
    components: Array.isArray(value.components) ? value.components : [],
    raw: value,
  };
}

export function extractTemplateItems(response: unknown): Record<string, unknown>[] {
  const candidates = Array.isArray(response)
    ? response
    : getFirstArrayProperty(response, [
        'data',
        'templates',
        'business_templates',
        'message_templates',
      ]);

  return candidates.filter(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  );
}

function normalizeStatus(value: unknown): SyncedWhatsAppTemplateStatus | null {
  const normalized = getString(value)
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  switch (normalized) {
    case 'approved':
    case 'active':
    case 'active_quality_pending':
    case 'active_high_quality':
    case 'active_medium_quality':
    case 'active_low_quality':
      return 'approved';
    case 'pending':
    case 'submitted':
    case 'in_review':
      return 'pending';
    case 'rejected':
      return 'rejected';
    case 'paused':
      return 'paused';
    case 'disabled':
      return 'disabled';
    case 'draft':
      return 'draft';
    default:
      return null;
  }
}

function normalizeCategory(value: unknown): SyncedWhatsAppTemplate['category'] | null {
  const normalized = getString(value)?.trim().toLowerCase();

  switch (normalized) {
    case 'utility':
      return 'utility';
    case 'marketing':
      return 'marketing';
    case 'authentication':
      return 'authentication';
    default:
      return null;
  }
}

function getFirstArrayProperty(response: unknown, properties: string[]): unknown[] {
  if (typeof response !== 'object' || response === null) {
    return [];
  }

  const record = response as Record<string, unknown>;

  for (const property of properties) {
    if (Array.isArray(record[property])) {
      return record[property];
    }
  }

  return [];
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
