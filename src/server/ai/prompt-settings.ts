import type { AuthSession } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  AI_PROMPT_IMMUTABLE_SECTIONS,
  composeDomainReplySystemPrompt,
  defaultPersonaPrompt,
  type PromptSection,
} from '@/server/ai/domain-reply';

/** Chiave del prompt gestito da questa schermata (vedi `AiContextProvider.load`). */
export const AI_PROMPT_KEY = 'domain_reply';

const MIN_PERSONA_LENGTH = 20;
const MAX_PERSONA_LENGTH = 4000;
const MAX_VERSIONS_RETURNED = 20;

export type AiPromptVersion = {
  id: string;
  version: number;
  model: string;
  promptText: string;
  active: boolean;
  createdAt: string;
};

export type AiPromptSettings = {
  promptKey: string;
  assistantName: string;
  /** Personalita' usata quando il tenant non ha ancora pubblicato nulla. */
  defaultPersona: string;
  activeVersion: AiPromptVersion | null;
  versions: AiPromptVersion[];
  immutableSections: readonly PromptSection[];
  /** Anteprima del system prompt che il modello ricevera' davvero. */
  composedPreview: string;
  limits: {
    minLength: number;
    maxLength: number;
  };
};

export type AiPromptSettingsRepository = {
  getAssistantName(tenantId: string): Promise<string>;
  listVersions(input: { tenantId: string; promptKey: string }): Promise<AiPromptVersion[]>;
  insertVersion(input: {
    tenantId: string;
    promptKey: string;
    version: number;
    model: string;
    promptText: string;
    createdBy: string;
  }): Promise<AiPromptVersion>;
  activateVersion(input: {
    tenantId: string;
    promptKey: string;
    versionId: string;
  }): Promise<AiPromptVersion | null>;
  deactivateOtherVersions(input: {
    tenantId: string;
    promptKey: string;
    keepId: string;
  }): Promise<void>;
  recordAuditLog(input: {
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Record<string, unknown>;
  }): Promise<void>;
};

export class AiPromptSettingsService {
  constructor(private readonly repository: AiPromptSettingsRepository) {}

  async getSettings(input: { session: AuthSession }): Promise<AiPromptSettings> {
    const [assistantName, versions] = await Promise.all([
      this.repository.getAssistantName(input.session.tenantId),
      this.repository.listVersions({
        tenantId: input.session.tenantId,
        promptKey: AI_PROMPT_KEY,
      }),
    ]);

    return buildSettings({ assistantName, versions });
  }

  /**
   * Pubblica una nuova versione della personalita' e disattiva le precedenti.
   *
   * L'inserimento precede la disattivazione: nella finestra tra le due query
   * possono risultare due righe attive, e `selectActivePrompt` sceglie quella
   * con `version` piu' alta, cioe' la nuova. L'ordine inverso lascerebbe invece
   * una finestra senza prompt attivo, in cui le risposte tornano alla
   * personalita' di default senza che nessuno l'abbia chiesto.
   */
  async publishPersona(input: {
    session: AuthSession;
    promptText: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<AiPromptSettings> {
    assertTenantAdmin(input.session);
    const promptText = normalizePersona(input.promptText);
    const versions = await this.repository.listVersions({
      tenantId: input.session.tenantId,
      promptKey: AI_PROMPT_KEY,
    });

    if (versions.some((version) => version.active && version.promptText === promptText)) {
      throw new AppError(
        'conflict',
        'La personalita attiva e gia questa: nessuna modifica da salvare',
      );
    }

    const created = await this.repository.insertVersion({
      tenantId: input.session.tenantId,
      promptKey: AI_PROMPT_KEY,
      version: nextVersionNumber(versions),
      model: promptModel(),
      promptText,
      createdBy: input.session.userId,
    });
    await this.repository.deactivateOtherVersions({
      tenantId: input.session.tenantId,
      promptKey: AI_PROMPT_KEY,
      keepId: created.id,
    });
    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'settings.ai_prompt.published',
      resourceType: 'ai_prompt',
      resourceId: created.id,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        promptKey: AI_PROMPT_KEY,
        version: created.version,
        length: promptText.length,
      },
    });

    return this.getSettings({ session: input.session });
  }

  /** Riattiva una versione precedente, senza crearne una nuova. */
  async activateVersion(input: {
    session: AuthSession;
    versionId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<AiPromptSettings> {
    assertTenantAdmin(input.session);
    const activated = await this.repository.activateVersion({
      tenantId: input.session.tenantId,
      promptKey: AI_PROMPT_KEY,
      versionId: input.versionId,
    });

    if (!activated) {
      throw new AppError('not_found', 'Versione del prompt non trovata');
    }

    await this.repository.deactivateOtherVersions({
      tenantId: input.session.tenantId,
      promptKey: AI_PROMPT_KEY,
      keepId: activated.id,
    });
    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'settings.ai_prompt.activated',
      resourceType: 'ai_prompt',
      resourceId: activated.id,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        promptKey: AI_PROMPT_KEY,
        version: activated.version,
      },
    });

    return this.getSettings({ session: input.session });
  }
}

export class SupabaseAiPromptSettingsRepository implements AiPromptSettingsRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getAssistantName(tenantId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('tenant_config')
      .select('assistant_name')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read assistant name', error);
    }

    const row = data as { assistant_name: string | null } | null;

    return row?.assistant_name?.trim() || 'Ambrogio';
  }

  async listVersions(input: { tenantId: string; promptKey: string }): Promise<AiPromptVersion[]> {
    const { data, error } = await this.supabase
      .from('ai_prompts')
      .select('id, version, model, prompt_text, active, created_at')
      .eq('tenant_id', input.tenantId)
      .eq('prompt_key', input.promptKey)
      .order('version', { ascending: false })
      .limit(MAX_VERSIONS_RETURNED);

    if (error) {
      throw toRepositoryError('Failed to read AI prompt versions', error);
    }

    return ((data ?? []) as AiPromptRow[]).map(versionFromRow);
  }

  async insertVersion(input: {
    tenantId: string;
    promptKey: string;
    version: number;
    model: string;
    promptText: string;
    createdBy: string;
  }): Promise<AiPromptVersion> {
    const { data, error } = await this.supabase
      .from('ai_prompts')
      .insert({
        tenant_id: input.tenantId,
        prompt_key: input.promptKey,
        version: input.version,
        model: input.model,
        prompt_text: input.promptText,
        active: true,
        created_by: input.createdBy,
      })
      .select('id, version, model, prompt_text, active, created_at')
      .single();

    if (error) {
      throw toRepositoryError('Failed to insert AI prompt version', error);
    }

    return versionFromRow(data as AiPromptRow);
  }

  async activateVersion(input: {
    tenantId: string;
    promptKey: string;
    versionId: string;
  }): Promise<AiPromptVersion | null> {
    const { data, error } = await this.supabase
      .from('ai_prompts')
      .update({ active: true })
      .eq('tenant_id', input.tenantId)
      .eq('prompt_key', input.promptKey)
      .eq('id', input.versionId)
      .select('id, version, model, prompt_text, active, created_at')
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to activate AI prompt version', error);
    }

    return data ? versionFromRow(data as AiPromptRow) : null;
  }

  async deactivateOtherVersions(input: {
    tenantId: string;
    promptKey: string;
    keepId: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('ai_prompts')
      .update({ active: false })
      .eq('tenant_id', input.tenantId)
      .eq('prompt_key', input.promptKey)
      .eq('active', true)
      .neq('id', input.keepId);

    if (error) {
      throw toRepositoryError('Failed to deactivate previous AI prompt versions', error);
    }
  }

  async recordAuditLog(input: {
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from('audit_log').insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      metadata: input.metadata,
    });

    if (error) {
      throw toRepositoryError('Failed to write AI prompt audit log', error);
    }
  }
}

export function createAiPromptSettingsService(
  repository: AiPromptSettingsRepository = new SupabaseAiPromptSettingsRepository(),
): AiPromptSettingsService {
  return new AiPromptSettingsService(repository);
}

type AiPromptRow = {
  id: string;
  version: number;
  model: string;
  prompt_text: string;
  active: boolean;
  created_at: string;
};

function buildSettings(input: {
  assistantName: string;
  versions: AiPromptVersion[];
}): AiPromptSettings {
  const versions = [...input.versions].sort((left, right) => right.version - left.version);
  const activeVersion = versions.find((version) => version.active) ?? null;
  const defaultPersona = defaultPersonaPrompt(input.assistantName);

  return {
    promptKey: AI_PROMPT_KEY,
    assistantName: input.assistantName,
    defaultPersona,
    activeVersion,
    versions,
    immutableSections: AI_PROMPT_IMMUTABLE_SECTIONS,
    composedPreview: composeDomainReplySystemPrompt({
      persona: activeVersion?.promptText ?? defaultPersona,
    }),
    limits: {
      minLength: MIN_PERSONA_LENGTH,
      maxLength: MAX_PERSONA_LENGTH,
    },
  };
}

function nextVersionNumber(versions: AiPromptVersion[]): number {
  return versions.reduce((max, version) => Math.max(max, version.version), 0) + 1;
}

/**
 * `ANTHROPIC_MODEL_PRIMARY` ha default vuoto in `env.ts`, ma la colonna `model`
 * e' NOT NULL: registriamo `unset` invece di inventare un identificativo.
 */
function promptModel(): string {
  return env.ANTHROPIC_MODEL_PRIMARY.trim() || 'unset';
}

function normalizePersona(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').trim();

  if (normalized.length < MIN_PERSONA_LENGTH) {
    throw new AppError(
      'bad_request',
      `La personalita deve contenere almeno ${MIN_PERSONA_LENGTH} caratteri`,
    );
  }

  if (normalized.length > MAX_PERSONA_LENGTH) {
    throw new AppError(
      'bad_request',
      `La personalita non puo superare ${MAX_PERSONA_LENGTH} caratteri`,
    );
  }

  return normalized;
}

function assertTenantAdmin(session: AuthSession): void {
  if (session.role !== 'owner' && session.role !== 'admin') {
    throw new AppError('forbidden', 'Admin role required');
  }
}

function versionFromRow(row: AiPromptRow): AiPromptVersion {
  return {
    id: row.id,
    version: row.version,
    model: row.model,
    promptText: row.prompt_text,
    active: row.active,
    createdAt: row.created_at,
  };
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
