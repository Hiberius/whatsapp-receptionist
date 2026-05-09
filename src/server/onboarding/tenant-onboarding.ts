import { randomUUID } from 'node:crypto';

import { AppError } from '@/lib/errors/app-error';
import type { AuthenticatedUser } from '@/lib/auth/session';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type OnboardingTenantProfile = {
  id: string;
  slug: string;
  name: string;
  trialEndsAt: string;
};

export type OnboardingStatus = {
  onboarded: boolean;
  tenant: OnboardingTenantProfile | null;
  role: 'owner' | 'admin' | 'member' | null;
};

export type CompleteTenantOnboardingInput = {
  tenantName: string;
  billingEmail?: string | null;
  timezone?: string;
  businessType?: string | null;
  studioName?: string | null;
  assistantName?: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  fullName?: string | null;
  services?: Array<{
    name: string;
    description?: string | null;
    durationMinutes?: number;
    priceCents?: number | null;
    active?: boolean;
  }>;
  businessHours?: Array<{
    weekday: number;
    opensAt: string;
    closesAt: string;
    active?: boolean;
  }>;
};

export type TenantOnboardingRepository = {
  getMembership(userId: string): Promise<OnboardingStatus | null>;
  createTenant(input: CreateTenantBundleInput): Promise<OnboardingTenantProfile>;
  syncAuthUserClaims(input: {
    userId: string;
    appMetadata: Record<string, unknown>;
    tenantId: string;
    role: 'owner' | 'admin' | 'member';
  }): Promise<void>;
};

type CreateTenantBundleInput = {
  userId: string;
  userEmail: string | null;
  fullName: string | null;
  tenant: {
    name: string;
    slug: string;
    billingEmail: string;
    country: 'IT';
    timezone: string;
    businessType: string | null;
    trialEndsAt: string;
  };
  config: {
    studioName: string;
    assistantName: string;
    city: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    defaultLocale: 'it-IT';
    aiDisclosureEnabled: true;
    autoReplyEnabled: false;
    voiceMessagesEnabled: true;
    voiceRepliesEnabled: false;
    bookingMinLeadMinutes: 120;
    bookingSlotStepMinutes: 15;
    bookingBufferMinutes: 0;
    bookingMaxDaysAhead: 30;
    elevenlabsVoiceId: null;
    elevenlabsSttModel: 'scribe_v2';
    elevenlabsTtsModel: 'eleven_flash_v2_5';
    humanEscalationEmail: string | null;
  };
  services: NormalizedOnboardingService[];
  businessHours: NormalizedBusinessHour[];
  audit: {
    ipAddress: string | null;
    userAgent: string | null;
  };
};

type NormalizedOnboardingService = {
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number | null;
  active: boolean;
};

type NormalizedBusinessHour = {
  weekday: number;
  opensAt: string;
  closesAt: string;
  active: boolean;
};

export class TenantOnboardingService {
  constructor(private readonly repository: TenantOnboardingRepository) {}

  async getStatus(input: { user: AuthenticatedUser }): Promise<OnboardingStatus> {
    const membership = await this.repository.getMembership(input.user.userId);

    if (!membership?.tenant) {
      return {
        onboarded: false,
        tenant: null,
        role: null,
      };
    }

    await this.repository.syncAuthUserClaims({
      userId: input.user.userId,
      appMetadata: input.user.appMetadata,
      tenantId: membership.tenant.id,
      role: membership.role ?? 'member',
    });

    return membership;
  }

  async complete(input: {
    user: AuthenticatedUser;
    payload: CompleteTenantOnboardingInput;
    now?: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<OnboardingStatus> {
    const existing = await this.getStatus({ user: input.user });

    if (existing.onboarded) {
      return existing;
    }

    if (typeof input.user.appMetadata['tenant_id'] === 'string') {
      throw new AppError('conflict', 'User already has tenant auth claims');
    }

    const bundle = normalizeOnboardingPayload({
      user: input.user,
      payload: input.payload,
      now: input.now ?? new Date(),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
    const tenant = await this.repository.createTenant(bundle);
    await this.repository.syncAuthUserClaims({
      userId: input.user.userId,
      appMetadata: input.user.appMetadata,
      tenantId: tenant.id,
      role: 'owner',
    });

    return {
      onboarded: true,
      tenant,
      role: 'owner',
    };
  }
}

export class SupabaseTenantOnboardingRepository implements TenantOnboardingRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getMembership(userId: string): Promise<OnboardingStatus | null> {
    const user = await this.supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', userId)
      .maybeSingle();

    if (user.error) {
      throw toRepositoryError('Failed to read user tenant membership', user.error);
    }

    if (!user.data) {
      return null;
    }

    const tenant = await this.supabase
      .from('tenants')
      .select('id, slug, name, trial_ends_at')
      .eq('id', user.data.tenant_id as string)
      .maybeSingle();

    if (tenant.error) {
      throw toRepositoryError('Failed to read tenant membership', tenant.error);
    }

    if (!tenant.data) {
      return null;
    }

    return {
      onboarded: true,
      tenant: tenantProfileFromRow(tenant.data as TenantOnboardingRow),
      role: user.data.role as 'owner' | 'admin' | 'member',
    };
  }

  async createTenant(input: CreateTenantBundleInput): Promise<OnboardingTenantProfile> {
    const { data, error } = await this.supabase.rpc('create_tenant_onboarding', {
      p_user_id: input.userId,
      p_user_email: input.userEmail,
      p_full_name: input.fullName,
      p_tenant: input.tenant,
      p_config: input.config,
      p_services: input.services,
      p_business_hours: input.businessHours,
      p_audit: input.audit,
    });

    if (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('conflict', 'User already has a tenant membership', {
          cause: error,
          expose: true,
        });
      }

      throw toRepositoryError('Failed to create tenant onboarding', error);
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      throw new AppError('upstream_error', 'Tenant onboarding returned no tenant', {
        expose: false,
      });
    }

    return {
      id: String(row.tenant_id),
      slug: String(row.tenant_slug),
      name: String(row.tenant_name),
      trialEndsAt: String(row.trial_ends_at),
    };
  }

  async syncAuthUserClaims(input: {
    userId: string;
    appMetadata: Record<string, unknown>;
    tenantId: string;
    role: 'owner' | 'admin' | 'member';
  }): Promise<void> {
    const { error } = await this.supabase.auth.admin.updateUserById(input.userId, {
      app_metadata: {
        ...input.appMetadata,
        tenant_id: input.tenantId,
        role: input.role,
      },
    });

    if (error) {
      throw toRepositoryError('Failed to sync tenant auth claims', error);
    }
  }
}

export function createTenantOnboardingService(): TenantOnboardingService {
  return new TenantOnboardingService(new SupabaseTenantOnboardingRepository());
}

type TenantOnboardingRow = {
  id: string;
  slug: string;
  name: string;
  trial_ends_at: string;
};

function normalizeOnboardingPayload(input: {
  user: AuthenticatedUser;
  payload: CompleteTenantOnboardingInput;
  now: Date;
  ipAddress: string | null;
  userAgent: string | null;
}): CreateTenantBundleInput {
  const tenantName = normalizeRequiredText(input.payload.tenantName, 'Tenant name', 120);
  const billingEmail = normalizeNullableEmail(
    input.payload.billingEmail ?? input.user.email,
    'Billing email',
  );

  if (!billingEmail) {
    throw new AppError('bad_request', 'Billing email is required');
  }

  return {
    userId: input.user.userId,
    userEmail: input.user.email,
    fullName: normalizeNullableText(input.payload.fullName, 'Full name', 120),
    tenant: {
      name: tenantName,
      slug: makeTenantSlug(tenantName),
      billingEmail,
      country: 'IT',
      timezone: normalizeTimezone(input.payload.timezone ?? 'Europe/Rome'),
      businessType: normalizeNullableText(input.payload.businessType, 'Business type', 80),
      trialEndsAt: addDays(input.now, 14).toISOString(),
    },
    config: {
      studioName: normalizeRequiredText(input.payload.studioName ?? tenantName, 'Studio name', 120),
      assistantName: normalizeRequiredText(
        input.payload.assistantName ?? 'Ambrogio',
        'Assistant name',
        80,
      ),
      city: normalizeNullableText(input.payload.city, 'City', 80),
      address: normalizeNullableText(input.payload.address, 'Address', 240),
      phone: normalizeNullableText(input.payload.phone, 'Phone', 40),
      email: normalizeNullableEmail(input.payload.email ?? billingEmail, 'Studio email'),
      defaultLocale: 'it-IT',
      aiDisclosureEnabled: true,
      autoReplyEnabled: false,
      voiceMessagesEnabled: true,
      voiceRepliesEnabled: false,
      bookingMinLeadMinutes: 120,
      bookingSlotStepMinutes: 15,
      bookingBufferMinutes: 0,
      bookingMaxDaysAhead: 30,
      elevenlabsVoiceId: null,
      elevenlabsSttModel: 'scribe_v2',
      elevenlabsTtsModel: 'eleven_flash_v2_5',
      humanEscalationEmail: billingEmail,
    },
    services: normalizeServices(input.payload.services),
    businessHours: normalizeBusinessHours(input.payload.businessHours),
    audit: {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  };
}

function normalizeServices(
  services: CompleteTenantOnboardingInput['services'],
): NormalizedOnboardingService[] {
  const normalized =
    services && services.length > 0
      ? services
      : [
          {
            name: 'Prima visita',
            durationMinutes: 30,
            active: true,
          },
        ];

  if (normalized.length > 20) {
    throw new AppError('bad_request', 'Too many services');
  }

  return normalized.map((service) => ({
    name: normalizeRequiredText(service.name, 'Service name', 120),
    description: normalizeNullableText(service.description, 'Description', 500),
    durationMinutes: normalizeInteger(service.durationMinutes ?? 30, 'Duration minutes', 5, 480),
    priceCents: normalizeNullableInteger(service.priceCents, 'Price cents', 0, 1_000_000),
    active: service.active ?? true,
  }));
}

function normalizeBusinessHours(
  hours: CompleteTenantOnboardingInput['businessHours'],
): NormalizedBusinessHour[] {
  const normalized =
    hours && hours.length > 0
      ? hours
      : [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          opensAt: '09:00',
          closesAt: '18:00',
          active: true,
        }));

  if (normalized.length > 28) {
    throw new AppError('bad_request', 'Too many business hour rows');
  }

  const result = normalized
    .map((hour) => ({
      weekday: normalizeInteger(hour.weekday, 'Weekday', 0, 6),
      opensAt: normalizeTime(hour.opensAt, 'opensAt'),
      closesAt: normalizeTime(hour.closesAt, 'closesAt'),
      active: hour.active ?? true,
    }))
    .sort((left, right) => {
      if (left.weekday !== right.weekday) {
        return left.weekday - right.weekday;
      }

      return timeToMinutes(left.opensAt) - timeToMinutes(right.opensAt);
    });

  for (const hour of result) {
    if (timeToMinutes(hour.opensAt) >= timeToMinutes(hour.closesAt)) {
      throw new AppError('bad_request', 'Business hour opensAt must be before closesAt');
    }
  }

  for (let index = 1; index < result.length; index += 1) {
    const previous = result[index - 1];
    const current = result[index];

    if (
      previous &&
      current &&
      previous.weekday === current.weekday &&
      previous.active &&
      current.active &&
      timeToMinutes(previous.closesAt) > timeToMinutes(current.opensAt)
    ) {
      throw new AppError('bad_request', 'Business hours cannot overlap');
    }
  }

  return result;
}

function makeTenantSlug(name: string): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'studio';

  return `${base}-${randomUUID().slice(0, 8)}`;
}

function tenantProfileFromRow(row: TenantOnboardingRow): OnboardingTenantProfile {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    trialEndsAt: row.trial_ends_at,
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

function normalizeInteger(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AppError('bad_request', `${label} is out of range`);
  }

  return value;
}

function normalizeNullableInteger(
  value: number | null | undefined,
  label: string,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeInteger(value, label, min, max);
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

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
