// Fatto da Claude Code l'8 maggio 2026.
//
// Sign-up self-service: l'utente sceglie business name + vertical e riceve un
// magic link. Creiamo un tenant in stato `suspended` (placeholder "pending":
// non e' ancora stato confermato l'accesso del proprietario) + una RPC
// magic-link a Supabase. Quando l'utente conferma l'email, l'onboarding flow
// reso' disponibile da TenantOnboardingService completera' la configurazione.
//
// Pattern: factory + DI (repository + magic-link sender). Lo schema tenants
// esistente non prevede uno stato `pending` esplicito; usiamo `suspended`
// come rappresentazione operativa "non ancora attivo".

import { randomUUID } from 'node:crypto';

import { AppError } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { type MagicLinkSender, MagicLinkService, normalizeEmail } from '@/server/auth/magic-link';

export type SignUpVertical = 'dental' | 'beauty' | 'fitness' | 'professional' | 'other';

export type SignUpInput = {
  businessName: string;
  email: string;
  vertical: SignUpVertical;
  requestId: string;
};

export type SignUpResult = {
  tenantId: string;
};

export type PendingTenantInsertInput = {
  name: string;
  slug: string;
  billingEmail: string;
  businessType: SignUpVertical;
};

export interface SignUpRepository {
  findTenantByBillingEmail(email: string): Promise<{ id: string } | null>;
  insertPendingTenant(input: PendingTenantInsertInput): Promise<{ id: string }>;
}

export class SignUpService {
  constructor(
    private readonly repository: SignUpRepository,
    private readonly magicLinkService: MagicLinkService,
  ) {}

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const businessName = normalizeBusinessName(input.businessName);
    const email = normalizeEmail(input.email);

    if (!email) {
      throw new AppError('bad_request', 'A valid email is required');
    }

    const existing = await this.repository.findTenantByBillingEmail(email);
    if (existing) {
      throw new AppError('conflict', 'A tenant with this email already exists');
    }

    const tenant = await this.repository.insertPendingTenant({
      name: businessName,
      slug: makeSlug(businessName),
      billingEmail: email,
      businessType: input.vertical,
    });

    // Magic link inviato in parallelo: non blocca la response se fallisce
    // (il tenant resta in stato pending, l'utente puo' richiedere un nuovo link).
    try {
      await this.magicLinkService.request({
        email,
        requestId: input.requestId,
      });
    } catch (error) {
      logger.warn(
        {
          requestId: input.requestId,
          tenantId: tenant.id,
          err: error,
        },
        'Sign-up magic link dispatch failed (tenant remains pending)',
      );
    }

    return { tenantId: tenant.id };
  }
}

export class SupabaseSignUpRepository implements SignUpRepository {
  private readonly supabase = createSupabaseAdminClient();

  async findTenantByBillingEmail(email: string): Promise<{ id: string } | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('billing_email', email)
      .maybeSingle();

    if (error) {
      throw new AppError('upstream_error', 'Failed to read tenants', {
        cause: error,
        expose: false,
      });
    }

    return data ? { id: String(data.id) } : null;
  }

  async insertPendingTenant(input: PendingTenantInsertInput): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from('tenants')
      .insert({
        name: input.name,
        slug: input.slug,
        billing_email: input.billingEmail,
        business_type: input.businessType,
        status: 'suspended',
        plan: 'trial',
        country: 'IT',
        timezone: 'Europe/Rome',
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new AppError('upstream_error', 'Failed to insert pending tenant', {
        cause: error,
        expose: false,
      });
    }

    return { id: String(data.id) };
  }
}

export function createSignUpService(): SignUpService {
  const redirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/callback`;
  const sender: MagicLinkSender = {
    async send(input) {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: input.email,
        options: { emailRedirectTo: input.redirectTo },
      });
      return { error: error ?? null };
    },
  };
  const magicLinkService = new MagicLinkService(sender, redirectTo);
  return new SignUpService(new SupabaseSignUpRepository(), magicLinkService);
}

function normalizeBusinessName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 120) {
    throw new AppError('bad_request', 'Business name must be 2-120 chars');
  }
  return trimmed;
}

function makeSlug(name: string): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'studio';

  return `${base}-${randomUUID().slice(0, 8)}`;
}
