import { AppError } from '@/lib/errors/app-error';
import type { AuthSession } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type TenantProfile = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  timezone: string;
  businessType: string | null;
};

export type TenantConfigSettings = {
  id: string | null;
  studioName: string;
  assistantName: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  defaultLocale: string;
  aiDisclosureEnabled: boolean;
  autoReplyEnabled: boolean;
  voiceMessagesEnabled: boolean;
  voiceRepliesEnabled: boolean;
  bookingMinLeadMinutes: number;
  bookingSlotStepMinutes: number;
  bookingBufferMinutes: number;
  bookingMaxDaysAhead: number;
  elevenlabsVoiceId: string | null;
  elevenlabsSttModel: string;
  elevenlabsTtsModel: string;
  humanEscalationEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TenantServiceSettings = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BusinessHourSettings = {
  id: string;
  weekday: number;
  opensAt: string;
  closesAt: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TenantSettingsSnapshot = {
  tenant: TenantProfile;
  config: TenantConfigSettings;
  services: TenantServiceSettings[];
  businessHours: BusinessHourSettings[];
};

export type TenantSettingsPatch = Partial<{
  name: string;
  timezone: string;
  businessType: string | null;
  studioName: string;
  assistantName: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  defaultLocale: string;
  aiDisclosureEnabled: boolean;
  autoReplyEnabled: boolean;
  voiceMessagesEnabled: boolean;
  voiceRepliesEnabled: boolean;
  bookingMinLeadMinutes: number;
  bookingSlotStepMinutes: number;
  bookingBufferMinutes: number;
  bookingMaxDaysAhead: number;
  elevenlabsVoiceId: string | null;
  elevenlabsSttModel: string;
  elevenlabsTtsModel: string;
  humanEscalationEmail: string | null;
}>;

export type CreateTenantServiceInput = {
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceCents?: number | null;
  active?: boolean;
};

export type UpdateTenantServiceInput = Partial<{
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number | null;
  active: boolean;
}>;

export type ReplaceBusinessHourInput = {
  weekday: number;
  opensAt: string;
  closesAt: string;
  active?: boolean;
};

export type TenantSettingsRepository = {
  getSnapshot(tenantId: string): Promise<TenantSettingsSnapshot | null>;
  updateTenantProfile(input: {
    tenantId: string;
    patch: Partial<{
      name: string;
      timezone: string;
      businessType: string | null;
    }>;
  }): Promise<void>;
  upsertTenantConfig(input: TenantConfigUpsert): Promise<void>;
  listServices(tenantId: string): Promise<TenantServiceSettings[]>;
  createService(input: {
    tenantId: string;
    service: CreateTenantServiceNormalized;
  }): Promise<TenantServiceSettings>;
  updateService(input: {
    tenantId: string;
    serviceId: string;
    patch: UpdateTenantServiceNormalized;
  }): Promise<TenantServiceSettings | null>;
  replaceBusinessHours(input: {
    tenantId: string;
    hours: ReplaceBusinessHourNormalized[];
  }): Promise<BusinessHourSettings[]>;
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

type TenantConfigUpsert = {
  tenantId: string;
  studioName: string;
  assistantName: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  defaultLocale: string;
  aiDisclosureEnabled: boolean;
  autoReplyEnabled: boolean;
  voiceMessagesEnabled: boolean;
  voiceRepliesEnabled: boolean;
  bookingMinLeadMinutes: number;
  bookingSlotStepMinutes: number;
  bookingBufferMinutes: number;
  bookingMaxDaysAhead: number;
  elevenlabsVoiceId: string | null;
  elevenlabsSttModel: string;
  elevenlabsTtsModel: string;
  humanEscalationEmail: string | null;
};

type CreateTenantServiceNormalized = {
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number | null;
  active: boolean;
};

type UpdateTenantServiceNormalized = Partial<{
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number | null;
  active: boolean;
}>;

type ReplaceBusinessHourNormalized = {
  weekday: number;
  opensAt: string;
  closesAt: string;
  active: boolean;
};

export class TenantSettingsService {
  constructor(private readonly repository: TenantSettingsRepository) {}

  async getSnapshot(input: { session: AuthSession }): Promise<TenantSettingsSnapshot> {
    const snapshot = await this.repository.getSnapshot(input.session.tenantId);

    if (!snapshot) {
      throw new AppError('not_found', 'Tenant settings not found');
    }

    return snapshot;
  }

  async updateSettings(input: {
    session: AuthSession;
    patch: TenantSettingsPatch;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<TenantSettingsSnapshot> {
    assertTenantAdmin(input.session);
    const current = await this.getSnapshot({ session: input.session });
    const tenantPatch = normalizeTenantPatch(input.patch);

    if (Object.keys(tenantPatch).length > 0) {
      await this.repository.updateTenantProfile({
        tenantId: input.session.tenantId,
        patch: tenantPatch,
      });
    }

    if (hasConfigPatch(input.patch)) {
      await this.repository.upsertTenantConfig(
        normalizeConfigPatch(
          input.session.tenantId,
          input.patch,
          current.config,
          current.tenant.name,
        ),
      );
    }

    if (Object.keys(tenantPatch).length > 0 || hasConfigPatch(input.patch)) {
      await this.repository.recordAuditLog({
        tenantId: input.session.tenantId,
        userId: input.session.userId,
        action: 'settings.tenant.updated',
        resourceType: 'tenant_settings',
        resourceId: input.session.tenantId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: {
          tenantFields: Object.keys(tenantPatch),
          configFields: configPatchKeys(input.patch),
        },
      });
    }

    return this.getSnapshot({ session: input.session });
  }

  async listServices(input: { session: AuthSession }): Promise<TenantServiceSettings[]> {
    await this.getSnapshot({ session: input.session });
    return this.repository.listServices(input.session.tenantId);
  }

  async createService(input: {
    session: AuthSession;
    service: CreateTenantServiceInput;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<TenantServiceSettings> {
    assertTenantAdmin(input.session);
    const service = await this.repository.createService({
      tenantId: input.session.tenantId,
      service: normalizeCreateService(input.service),
    });
    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'settings.service.created',
      resourceType: 'service',
      resourceId: service.id,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        name: service.name,
        durationMinutes: service.durationMinutes,
        active: service.active,
      },
    });

    return service;
  }

  async updateService(input: {
    session: AuthSession;
    serviceId: string;
    patch: UpdateTenantServiceInput;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<TenantServiceSettings> {
    assertTenantAdmin(input.session);
    const patch = normalizeUpdateService(input.patch);

    if (Object.keys(patch).length === 0) {
      throw new AppError('bad_request', 'Service update payload is empty');
    }

    const service = await this.repository.updateService({
      tenantId: input.session.tenantId,
      serviceId: input.serviceId,
      patch,
    });

    if (!service) {
      throw new AppError('not_found', 'Service not found');
    }

    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'settings.service.updated',
      resourceType: 'service',
      resourceId: service.id,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        fields: Object.keys(patch),
        active: service.active,
      },
    });

    return service;
  }

  async archiveService(input: {
    session: AuthSession;
    serviceId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<TenantServiceSettings> {
    assertTenantAdmin(input.session);
    const service = await this.repository.updateService({
      tenantId: input.session.tenantId,
      serviceId: input.serviceId,
      patch: { active: false },
    });

    if (!service) {
      throw new AppError('not_found', 'Service not found');
    }

    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'settings.service.archived',
      resourceType: 'service',
      resourceId: service.id,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        name: service.name,
        active: service.active,
      },
    });

    return service;
  }

  async listBusinessHours(input: { session: AuthSession }): Promise<BusinessHourSettings[]> {
    const snapshot = await this.getSnapshot({ session: input.session });
    return snapshot.businessHours;
  }

  async replaceBusinessHours(input: {
    session: AuthSession;
    hours: ReplaceBusinessHourInput[];
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<BusinessHourSettings[]> {
    assertTenantAdmin(input.session);
    const hours = normalizeBusinessHours(input.hours);
    const saved = await this.repository.replaceBusinessHours({
      tenantId: input.session.tenantId,
      hours,
    });
    await this.repository.recordAuditLog({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      action: 'settings.business_hours.replaced',
      resourceType: 'business_hours',
      resourceId: input.session.tenantId,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        count: saved.length,
        activeCount: saved.filter((hour) => hour.active).length,
      },
    });

    return saved;
  }
}

export class SupabaseTenantSettingsRepository implements TenantSettingsRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getSnapshot(tenantId: string): Promise<TenantSettingsSnapshot | null> {
    const tenant = await this.supabase
      .from('tenants')
      .select('id, name, slug, plan, status, timezone, business_type')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenant.error) {
      throw toRepositoryError('Failed to read tenant', tenant.error);
    }

    if (!tenant.data) {
      return null;
    }

    const config = await this.supabase
      .from('tenant_config')
      .select(
        [
          'id',
          'studio_name',
          'assistant_name',
          'city',
          'address',
          'phone',
          'email',
          'default_locale',
          'ai_disclosure_enabled',
          'auto_reply_enabled',
          'voice_messages_enabled',
          'voice_replies_enabled',
          'booking_min_lead_minutes',
          'booking_slot_step_minutes',
          'booking_buffer_minutes',
          'booking_max_days_ahead',
          'elevenlabs_voice_id',
          'elevenlabs_stt_model',
          'elevenlabs_tts_model',
          'human_escalation_email',
          'created_at',
          'updated_at',
        ].join(', '),
      )
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (config.error) {
      throw toRepositoryError('Failed to read tenant config', config.error);
    }

    const services = await this.listServices(tenantId);
    const businessHours = await this.listBusinessHours(tenantId);
    const tenantRow = tenant.data as TenantRow;

    return {
      tenant: tenantFromRow(tenantRow),
      config: configFromRow(config.data as TenantConfigRow | null, tenantRow.name),
      services,
      businessHours,
    };
  }

  async updateTenantProfile(input: {
    tenantId: string;
    patch: Partial<{
      name: string;
      timezone: string;
      businessType: string | null;
    }>;
  }): Promise<void> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.patch.name !== undefined) {
      patch.name = input.patch.name;
    }

    if (input.patch.timezone !== undefined) {
      patch.timezone = input.patch.timezone;
    }

    if (input.patch.businessType !== undefined) {
      patch.business_type = input.patch.businessType;
    }

    const { error } = await this.supabase.from('tenants').update(patch).eq('id', input.tenantId);

    if (error) {
      throw toRepositoryError('Failed to update tenant profile', error);
    }
  }

  async upsertTenantConfig(input: TenantConfigUpsert): Promise<void> {
    const { error } = await this.supabase.from('tenant_config').upsert(
      {
        tenant_id: input.tenantId,
        studio_name: input.studioName,
        assistant_name: input.assistantName,
        city: input.city,
        address: input.address,
        phone: input.phone,
        email: input.email,
        default_locale: input.defaultLocale,
        ai_disclosure_enabled: input.aiDisclosureEnabled,
        auto_reply_enabled: input.autoReplyEnabled,
        voice_messages_enabled: input.voiceMessagesEnabled,
        voice_replies_enabled: input.voiceRepliesEnabled,
        booking_min_lead_minutes: input.bookingMinLeadMinutes,
        booking_slot_step_minutes: input.bookingSlotStepMinutes,
        booking_buffer_minutes: input.bookingBufferMinutes,
        booking_max_days_ahead: input.bookingMaxDaysAhead,
        elevenlabs_voice_id: input.elevenlabsVoiceId,
        elevenlabs_stt_model: input.elevenlabsSttModel,
        elevenlabs_tts_model: input.elevenlabsTtsModel,
        human_escalation_email: input.humanEscalationEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' },
    );

    if (error) {
      throw toRepositoryError('Failed to update tenant config', error);
    }
  }

  async listServices(tenantId: string): Promise<TenantServiceSettings[]> {
    const { data, error } = await this.supabase
      .from('services')
      .select(
        'id, name, description, duration_minutes, price_cents, active, created_at, updated_at',
      )
      .eq('tenant_id', tenantId)
      .order('active', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      throw toRepositoryError('Failed to read services', error);
    }

    return ((data ?? []) as ServiceRow[]).map(serviceFromRow);
  }

  async createService(input: {
    tenantId: string;
    service: CreateTenantServiceNormalized;
  }): Promise<TenantServiceSettings> {
    const { data, error } = await this.supabase
      .from('services')
      .insert({
        tenant_id: input.tenantId,
        name: input.service.name,
        description: input.service.description,
        duration_minutes: input.service.durationMinutes,
        price_cents: input.service.priceCents,
        active: input.service.active,
      })
      .select(
        'id, name, description, duration_minutes, price_cents, active, created_at, updated_at',
      )
      .single();

    if (error) {
      throw toRepositoryError('Failed to create service', error);
    }

    return serviceFromRow(data as ServiceRow);
  }

  async updateService(input: {
    tenantId: string;
    serviceId: string;
    patch: UpdateTenantServiceNormalized;
  }): Promise<TenantServiceSettings | null> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.patch.name !== undefined) {
      patch.name = input.patch.name;
    }

    if (input.patch.description !== undefined) {
      patch.description = input.patch.description;
    }

    if (input.patch.durationMinutes !== undefined) {
      patch.duration_minutes = input.patch.durationMinutes;
    }

    if (input.patch.priceCents !== undefined) {
      patch.price_cents = input.patch.priceCents;
    }

    if (input.patch.active !== undefined) {
      patch.active = input.patch.active;
    }

    const { data, error } = await this.supabase
      .from('services')
      .update(patch)
      .eq('tenant_id', input.tenantId)
      .eq('id', input.serviceId)
      .select(
        'id, name, description, duration_minutes, price_cents, active, created_at, updated_at',
      )
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to update service', error);
    }

    return data ? serviceFromRow(data as ServiceRow) : null;
  }

  async replaceBusinessHours(input: {
    tenantId: string;
    hours: ReplaceBusinessHourNormalized[];
  }): Promise<BusinessHourSettings[]> {
    const { data, error } = await this.supabase.rpc('replace_tenant_business_hours', {
      p_tenant_id: input.tenantId,
      p_hours: input.hours,
    });

    if (error) {
      throw toRepositoryError('Failed to replace business hours', error);
    }

    return ((data ?? []) as BusinessHourRow[]).map(businessHourFromRow);
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
      throw toRepositoryError('Failed to write settings audit log', error);
    }
  }

  private async listBusinessHours(tenantId: string): Promise<BusinessHourSettings[]> {
    const { data, error } = await this.supabase
      .from('business_hours')
      .select('id, weekday, opens_at, closes_at, active, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('weekday', { ascending: true })
      .order('opens_at', { ascending: true });

    if (error) {
      throw toRepositoryError('Failed to read business hours', error);
    }

    return ((data ?? []) as BusinessHourRow[]).map(businessHourFromRow);
  }
}

export function createTenantSettingsService(): TenantSettingsService {
  return new TenantSettingsService(new SupabaseTenantSettingsRepository());
}

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  timezone: string;
  business_type: string | null;
};

type TenantConfigRow = {
  id: string;
  studio_name: string;
  assistant_name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  default_locale: string;
  ai_disclosure_enabled: boolean;
  auto_reply_enabled: boolean;
  voice_messages_enabled: boolean;
  voice_replies_enabled: boolean;
  booking_min_lead_minutes: number;
  booking_slot_step_minutes: number;
  booking_buffer_minutes: number;
  booking_max_days_ahead: number;
  elevenlabs_voice_id: string | null;
  elevenlabs_stt_model: string;
  elevenlabs_tts_model: string;
  human_escalation_email: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type BusinessHourRow = {
  id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const CONFIG_PATCH_KEYS = [
  'studioName',
  'assistantName',
  'city',
  'address',
  'phone',
  'email',
  'defaultLocale',
  'aiDisclosureEnabled',
  'autoReplyEnabled',
  'voiceMessagesEnabled',
  'voiceRepliesEnabled',
  'bookingMinLeadMinutes',
  'bookingSlotStepMinutes',
  'bookingBufferMinutes',
  'bookingMaxDaysAhead',
  'elevenlabsVoiceId',
  'elevenlabsSttModel',
  'elevenlabsTtsModel',
  'humanEscalationEmail',
] as const satisfies readonly (keyof TenantSettingsPatch)[];

function assertTenantAdmin(
  session: AuthSession,
): asserts session is AuthSession & { role: 'owner' | 'admin' } {
  if (session.role !== 'owner' && session.role !== 'admin') {
    throw new AppError('forbidden', 'Admin role required');
  }
}

function normalizeTenantPatch(
  patch: TenantSettingsPatch,
): Partial<{ name: string; timezone: string; businessType: string | null }> {
  const normalized: Partial<{
    name: string;
    timezone: string;
    businessType: string | null;
  }> = {};

  if (patch.name !== undefined) {
    normalized.name = normalizeRequiredText(patch.name, 'Tenant name', 120);
  }

  if (patch.timezone !== undefined) {
    normalized.timezone = normalizeTimezone(patch.timezone);
  }

  if (patch.businessType !== undefined) {
    normalized.businessType = normalizeNullableText(patch.businessType, 'Business type', 80);
  }

  return normalized;
}

function normalizeConfigPatch(
  tenantId: string,
  patch: TenantSettingsPatch,
  current: TenantConfigSettings,
  tenantName: string,
): TenantConfigUpsert {
  return {
    tenantId,
    studioName:
      patch.studioName !== undefined
        ? normalizeRequiredText(patch.studioName, 'Studio name', 120)
        : current.studioName || tenantName,
    assistantName:
      patch.assistantName !== undefined
        ? normalizeRequiredText(patch.assistantName, 'Assistant name', 80)
        : current.assistantName,
    city: patch.city !== undefined ? normalizeNullableText(patch.city, 'City', 80) : current.city,
    address:
      patch.address !== undefined
        ? normalizeNullableText(patch.address, 'Address', 240)
        : current.address,
    phone:
      patch.phone !== undefined ? normalizeNullableText(patch.phone, 'Phone', 40) : current.phone,
    email: patch.email !== undefined ? normalizeNullableEmail(patch.email, 'Email') : current.email,
    defaultLocale:
      patch.defaultLocale !== undefined
        ? normalizeLocale(patch.defaultLocale)
        : current.defaultLocale,
    aiDisclosureEnabled: patch.aiDisclosureEnabled ?? current.aiDisclosureEnabled,
    autoReplyEnabled: patch.autoReplyEnabled ?? current.autoReplyEnabled,
    voiceMessagesEnabled: patch.voiceMessagesEnabled ?? current.voiceMessagesEnabled,
    voiceRepliesEnabled: patch.voiceRepliesEnabled ?? current.voiceRepliesEnabled,
    bookingMinLeadMinutes:
      patch.bookingMinLeadMinutes !== undefined
        ? normalizePositiveInteger(
            patch.bookingMinLeadMinutes,
            'Booking min lead minutes',
            0,
            10_080,
          )
        : current.bookingMinLeadMinutes,
    bookingSlotStepMinutes:
      patch.bookingSlotStepMinutes !== undefined
        ? normalizePositiveInteger(
            patch.bookingSlotStepMinutes,
            'Booking slot step minutes',
            5,
            240,
          )
        : current.bookingSlotStepMinutes,
    bookingBufferMinutes:
      patch.bookingBufferMinutes !== undefined
        ? normalizePositiveInteger(patch.bookingBufferMinutes, 'Booking buffer minutes', 0, 240)
        : current.bookingBufferMinutes,
    bookingMaxDaysAhead:
      patch.bookingMaxDaysAhead !== undefined
        ? normalizePositiveInteger(patch.bookingMaxDaysAhead, 'Booking max days ahead', 1, 365)
        : current.bookingMaxDaysAhead,
    elevenlabsVoiceId:
      patch.elevenlabsVoiceId !== undefined
        ? normalizeNullableText(patch.elevenlabsVoiceId, 'ElevenLabs voice id', 160)
        : current.elevenlabsVoiceId,
    elevenlabsSttModel:
      patch.elevenlabsSttModel !== undefined
        ? normalizeRequiredText(patch.elevenlabsSttModel, 'ElevenLabs STT model', 80)
        : current.elevenlabsSttModel,
    elevenlabsTtsModel:
      patch.elevenlabsTtsModel !== undefined
        ? normalizeRequiredText(patch.elevenlabsTtsModel, 'ElevenLabs TTS model', 80)
        : current.elevenlabsTtsModel,
    humanEscalationEmail:
      patch.humanEscalationEmail !== undefined
        ? normalizeNullableEmail(patch.humanEscalationEmail, 'Human escalation email')
        : current.humanEscalationEmail,
  };
}

function normalizeCreateService(input: CreateTenantServiceInput): CreateTenantServiceNormalized {
  return {
    name: normalizeRequiredText(input.name, 'Service name', 120),
    description: normalizeNullableText(input.description ?? null, 'Description', 500),
    durationMinutes: normalizePositiveInteger(input.durationMinutes, 'Duration minutes', 5, 480),
    priceCents: normalizeNullableNonNegativeInteger(
      input.priceCents ?? null,
      'Price cents',
      1_000_000,
    ),
    active: input.active ?? true,
  };
}

function normalizeUpdateService(input: UpdateTenantServiceInput): UpdateTenantServiceNormalized {
  const patch: UpdateTenantServiceNormalized = {};

  if (input.name !== undefined) {
    patch.name = normalizeRequiredText(input.name, 'Service name', 120);
  }

  if (input.description !== undefined) {
    patch.description = normalizeNullableText(input.description, 'Description', 500);
  }

  if (input.durationMinutes !== undefined) {
    patch.durationMinutes = normalizePositiveInteger(
      input.durationMinutes,
      'Duration minutes',
      5,
      480,
    );
  }

  if (input.priceCents !== undefined) {
    patch.priceCents = normalizeNullableNonNegativeInteger(
      input.priceCents,
      'Price cents',
      1_000_000,
    );
  }

  if (input.active !== undefined) {
    patch.active = input.active;
  }

  return patch;
}

function normalizeBusinessHours(
  input: ReplaceBusinessHourInput[],
): ReplaceBusinessHourNormalized[] {
  const hours = input.map((hour) => ({
    weekday: normalizeWeekday(hour.weekday),
    opensAt: normalizeTime(hour.opensAt, 'opensAt'),
    closesAt: normalizeTime(hour.closesAt, 'closesAt'),
    active: hour.active ?? true,
  }));

  for (const hour of hours) {
    if (timeToMinutes(hour.opensAt) >= timeToMinutes(hour.closesAt)) {
      throw new AppError('bad_request', 'Business hour opensAt must be before closesAt');
    }
  }

  const exactKeys = new Set<string>();

  for (const hour of hours) {
    const key = `${hour.weekday}:${hour.opensAt}:${hour.closesAt}`;

    if (exactKeys.has(key)) {
      throw new AppError('bad_request', 'Business hours cannot contain duplicates');
    }

    exactKeys.add(key);
  }

  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
    const activeHours = hours
      .filter((hour) => hour.weekday === weekday && hour.active)
      .sort((left, right) => timeToMinutes(left.opensAt) - timeToMinutes(right.opensAt));

    for (let index = 1; index < activeHours.length; index += 1) {
      const previous = activeHours[index - 1];
      const current = activeHours[index];

      if (
        previous &&
        current &&
        timeToMinutes(previous.closesAt) > timeToMinutes(current.opensAt)
      ) {
        throw new AppError('bad_request', 'Business hours cannot overlap');
      }
    }
  }

  return hours.sort((left, right) => {
    if (left.weekday !== right.weekday) {
      return left.weekday - right.weekday;
    }

    return timeToMinutes(left.opensAt) - timeToMinutes(right.opensAt);
  });
}

function hasConfigPatch(patch: TenantSettingsPatch): boolean {
  return CONFIG_PATCH_KEYS.some((key) => patch[key] !== undefined);
}

function configPatchKeys(patch: TenantSettingsPatch): string[] {
  return CONFIG_PATCH_KEYS.filter((key) => patch[key] !== undefined);
}

function tenantFromRow(row: TenantRow): TenantProfile {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    status: row.status,
    timezone: row.timezone,
    businessType: row.business_type,
  };
}

function configFromRow(row: TenantConfigRow | null, tenantName: string): TenantConfigSettings {
  return {
    id: row?.id ?? null,
    studioName: row?.studio_name ?? tenantName,
    assistantName: row?.assistant_name ?? 'Ambrogio',
    city: row?.city ?? null,
    address: row?.address ?? null,
    phone: row?.phone ?? null,
    email: row?.email ?? null,
    defaultLocale: row?.default_locale ?? 'it-IT',
    aiDisclosureEnabled: row?.ai_disclosure_enabled ?? true,
    autoReplyEnabled: row?.auto_reply_enabled ?? false,
    voiceMessagesEnabled: row?.voice_messages_enabled ?? true,
    voiceRepliesEnabled: row?.voice_replies_enabled ?? false,
    bookingMinLeadMinutes: row?.booking_min_lead_minutes ?? 120,
    bookingSlotStepMinutes: row?.booking_slot_step_minutes ?? 15,
    bookingBufferMinutes: row?.booking_buffer_minutes ?? 0,
    bookingMaxDaysAhead: row?.booking_max_days_ahead ?? 30,
    elevenlabsVoiceId: row?.elevenlabs_voice_id ?? null,
    elevenlabsSttModel: row?.elevenlabs_stt_model ?? 'scribe_v2',
    elevenlabsTtsModel: row?.elevenlabs_tts_model ?? 'eleven_flash_v2_5',
    humanEscalationEmail: row?.human_escalation_email ?? null,
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function serviceFromRow(row: ServiceRow): TenantServiceSettings {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function businessHourFromRow(row: BusinessHourRow): BusinessHourSettings {
  return {
    id: row.id,
    weekday: row.weekday,
    opensAt: formatTime(row.opens_at),
    closesAt: formatTime(row.closes_at),
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRequiredText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new AppError('bad_request', `${label} is required`);
  }

  if (normalized.length > maxLength) {
    throw new AppError('bad_request', `${label} is too long`);
  }

  return normalized;
}

function normalizeNullableText(
  value: string | null | undefined,
  label: string,
  maxLength: number,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new AppError('bad_request', `${label} is too long`);
  }

  return normalized;
}

function normalizeNullableEmail(value: string | null | undefined, label: string): string | null {
  const normalized = normalizeNullableText(value, label, 254);

  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AppError('bad_request', `${label} must be a valid email`);
  }

  return normalized?.toLowerCase() ?? null;
}

function normalizeLocale(value: string): string {
  const normalized = value.trim();

  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(normalized)) {
    throw new AppError('bad_request', 'Default locale is invalid');
  }

  return normalized;
}

function normalizeTimezone(value: string): string {
  const normalized = normalizeRequiredText(value, 'Timezone', 80);

  try {
    new Intl.DateTimeFormat('it-IT', { timeZone: normalized });
  } catch (error) {
    throw new AppError('bad_request', 'Timezone is invalid', {
      cause: error,
      expose: true,
    });
  }

  return normalized;
}

function normalizePositiveInteger(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AppError('bad_request', `${label} is out of range`);
  }

  return value;
}

function normalizeNullableNonNegativeInteger(
  value: number | null | undefined,
  label: string,
  max: number,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new AppError('bad_request', `${label} is out of range`);
  }

  return value;
}

function normalizeWeekday(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    throw new AppError('bad_request', 'Weekday must be between 0 and 6');
  }

  return value;
}

function normalizeTime(value: string, label: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/.exec(value.trim());

  if (!match) {
    throw new AppError('bad_request', `${label} must use HH:mm format`);
  }

  return `${match[1]}:${match[2]}:00`;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);

  if (hours === undefined || minutes === undefined) {
    throw new AppError('bad_request', 'Time is invalid');
  }

  return hours * 60 + minutes;
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
