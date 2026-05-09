// Fatto da Claude Code il 27 aprile 2026.
//
// Stripe billing MVP service + repository.
//
// Pattern allineato a tenant-onboarding e tenant-settings:
// - service contiene la business logic e dipende da una repository iniettata;
// - repository wrappa Supabase service-role e tutta l'interazione DB;
// - factory `createStripeBillingService()` istanzia la repository reale.
//
// Vincoli prodotto:
// - Trial 14 giorni senza carta (Codex). Stripe NON viene mai contattato
//   durante l'onboarding/trial: il customer viene creato lazy al primo
//   checkout o portal.
// - Self-checkout MVP espone solo Starter e Professional. Agency e' gestita
//   manualmente nella beta dal founder, non e' selezionabile via API.
// - Su `customer.subscription.deleted` il tenant torna a `plan='trial'` +
//   `status='cancelled'` (nessun "free tier").
// - Idempotency webhook via `webhook_events` con
//   `createWebhookIdempotencyKey({ provider: 'stripe', externalId: event.id })`.

import type Stripe from 'stripe';

import type { AuthSession } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import {
  isStripeCheckoutSession,
  isStripeCustomer,
  isStripeInvoice,
  isStripeSubscription,
  readStripeObjectDiscriminator,
  toEventPayload,
} from '@/lib/external-schemas/stripe';
import { logger } from '@/lib/logging/logger';
import { getStripeClient } from '@/lib/stripe/client';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createWebhookIdempotencyKey } from '@/lib/whatsapp/webhook-security';

export type BillingPlan = 'trial' | 'starter' | 'professional' | 'agency';
export type BillingTenantStatus = 'active' | 'expired' | 'suspended' | 'cancelled';

export type CheckoutPlan = 'starter' | 'professional';

export type BillingStatus = {
  plan: BillingPlan;
  status: BillingTenantStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionStatus: string | null;
  hasStripeCustomer: boolean;
  hasActiveSubscription: boolean;
  canCheckout: boolean;
  canManageBilling: boolean;
  availablePlans: CheckoutPlan[];
};

export type TenantBillingRow = {
  id: string;
  name: string;
  billingEmail: string;
  plan: BillingPlan;
  status: BillingTenantStatus;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type AuditLogInput = {
  tenantId: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
};

export interface StripeBillingRepository {
  getTenantBillingSnapshot(tenantId: string): Promise<TenantBillingRow | null>;
  findTenantByStripeCustomerId(customerId: string): Promise<TenantBillingRow | null>;
  updateTenantStripeCustomer(input: { tenantId: string; stripeCustomerId: string }): Promise<void>;
  updateTenantSubscription(input: {
    tenantId: string;
    plan: BillingPlan;
    status: BillingTenantStatus;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  }): Promise<void>;
  recordBillingEvent(input: {
    tenantId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    eventType: string;
    amountCents: number | null;
    currency: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
  upsertInvoice(input: {
    tenantId: string;
    stripeInvoiceId: string;
    invoiceNumber: string | null;
    amountCents: number;
    currency: string;
    status: 'draft' | 'sent' | 'paid' | 'void' | 'failed';
    issuedAt: Date | null;
  }): Promise<void>;
  recordWebhookEvent(input: {
    tenantId: string | null;
    idempotencyKey: string;
    eventType: string;
    externalId: string;
    payload: Record<string, unknown>;
  }): Promise<{ eventId: string; alreadyProcessed: boolean }>;
  markWebhookEventProcessed(input: { eventId: string; tenantId: string | null }): Promise<void>;
  recordAuditLog(input: AuditLogInput): Promise<void>;
}

export type StripeApi = {
  createCustomer(params: Stripe.CustomerCreateParams): Promise<Stripe.Customer>;
  createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<Stripe.Checkout.Session>;
  createBillingPortalSession(
    params: Stripe.BillingPortal.SessionCreateParams,
  ): Promise<Stripe.BillingPortal.Session>;
};

export type StripeBillingConfig = {
  priceIdByPlan: { starter: string; professional: string };
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  portalReturnUrl: string;
};

export type CreateCheckoutInput = {
  session: AuthSession;
  plan: CheckoutPlan;
  ipAddress: string | null;
  userAgent: string | null;
};

export type CreatePortalInput = {
  session: AuthSession;
  ipAddress: string | null;
  userAgent: string | null;
};

export type WebhookHandlerInput = {
  event: Stripe.Event;
};

export type WebhookHandlerResult = {
  processed: boolean;
  reason?: 'duplicate' | 'tenant_not_found' | 'unhandled' | 'unknown_price';
};

export class StripeBillingService {
  constructor(
    private readonly repository: StripeBillingRepository,
    private readonly stripe: StripeApi,
    private readonly config: StripeBillingConfig,
  ) {}

  async getStatus(input: { session: AuthSession }): Promise<BillingStatus> {
    const tenant = await this.repository.getTenantBillingSnapshot(input.session.tenantId);

    if (!tenant) {
      throw new AppError('not_found', 'Tenant billing snapshot not found');
    }

    return buildBillingStatus(tenant, input.session.role, this.config);
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<{ url: string }> {
    assertTenantAdmin(input.session);

    const priceId = this.resolveCheckoutPriceId(input.plan);

    if (!this.config.checkoutSuccessUrl || !this.config.checkoutCancelUrl) {
      throw new AppError('internal', 'Stripe checkout URLs are not configured', {
        expose: false,
      });
    }

    const tenant = await this.requireTenant(input.session.tenantId);

    const customerId = await this.ensureStripeCustomer(tenant);

    const session = await this.stripe.createCheckoutSession({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: tenant.id,
      success_url: this.config.checkoutSuccessUrl,
      cancel_url: this.config.checkoutCancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      subscription_data: {
        metadata: {
          tenant_id: tenant.id,
          plan: input.plan,
        },
      },
      metadata: {
        tenant_id: tenant.id,
        plan: input.plan,
      },
    });

    if (!session.url) {
      throw new AppError('upstream_error', 'Stripe checkout session has no URL', { expose: false });
    }

    await this.repository.recordAuditLog({
      tenantId: tenant.id,
      userId: input.session.userId,
      action: 'billing.checkout.created',
      resourceType: 'stripe_checkout_session',
      resourceId: session.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {
        plan: input.plan,
        priceId,
      },
    });

    return { url: session.url };
  }

  async createPortalSession(input: CreatePortalInput): Promise<{ url: string }> {
    assertTenantAdmin(input.session);

    if (!this.config.portalReturnUrl) {
      throw new AppError('internal', 'Stripe billing portal return URL is not configured', {
        expose: false,
      });
    }

    const tenant = await this.requireTenant(input.session.tenantId);

    if (!tenant.stripeCustomerId) {
      throw new AppError('bad_request', 'No Stripe customer is associated with this tenant');
    }

    const session = await this.stripe.createBillingPortalSession({
      customer: tenant.stripeCustomerId,
      return_url: this.config.portalReturnUrl,
    });

    await this.repository.recordAuditLog({
      tenantId: tenant.id,
      userId: input.session.userId,
      action: 'billing.portal.created',
      resourceType: 'stripe_billing_portal',
      resourceId: session.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {},
    });

    return { url: session.url };
  }

  async handleWebhookEvent(input: WebhookHandlerInput): Promise<WebhookHandlerResult> {
    const event = input.event;
    const idempotencyKey = createWebhookIdempotencyKey({
      provider: 'stripe',
      externalId: event.id,
    });

    const tenantHint = await this.resolveTenantForEvent(event);
    const recorded = await this.repository.recordWebhookEvent({
      tenantId: tenantHint?.id ?? null,
      idempotencyKey,
      eventType: event.type,
      externalId: event.id,
      payload: toEventPayload(event),
    });

    if (recorded.alreadyProcessed) {
      return { processed: false, reason: 'duplicate' };
    }

    const result = await this.dispatchEvent(event, tenantHint);

    await this.repository.markWebhookEventProcessed({
      eventId: recorded.eventId,
      tenantId: tenantHint?.id ?? null,
    });

    return result;
  }

  private async dispatchEvent(
    event: Stripe.Event,
    tenantHint: TenantBillingRow | null,
  ): Promise<WebhookHandlerResult> {
    switch (event.type) {
      case 'checkout.session.completed':
        return this.handleCheckoutCompleted(
          assertStripeObject<Stripe.Checkout.Session>(event, 'checkout.session'),
          tenantHint,
        );
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return this.handleSubscriptionUpserted(
          assertStripeObject<Stripe.Subscription>(event, 'subscription'),
          tenantHint,
        );
      case 'customer.subscription.deleted':
        return this.handleSubscriptionDeleted(
          assertStripeObject<Stripe.Subscription>(event, 'subscription'),
          tenantHint,
        );
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        return this.handleInvoiceStatus(
          assertStripeObject<Stripe.Invoice>(event, 'invoice'),
          tenantHint,
          'paid',
          event.type,
        );
      case 'invoice.payment_failed':
        return this.handleInvoiceStatus(
          assertStripeObject<Stripe.Invoice>(event, 'invoice'),
          tenantHint,
          'failed',
          event.type,
        );
      default:
        if (tenantHint) {
          await this.repository.recordBillingEvent({
            tenantId: tenantHint.id,
            stripeCustomerId: tenantHint.stripeCustomerId,
            stripeSubscriptionId: tenantHint.stripeSubscriptionId,
            eventType: `unhandled:${event.type}`,
            amountCents: null,
            currency: 'EUR',
            metadata: { stripeEventId: event.id },
          });
        }

        return { processed: true, reason: 'unhandled' };
    }
  }

  private async handleCheckoutCompleted(
    sessionObject: Stripe.Checkout.Session,
    tenantHint: TenantBillingRow | null,
  ): Promise<WebhookHandlerResult> {
    const tenant = tenantHint ?? (await this.resolveTenantFromCheckoutSession(sessionObject));

    if (!tenant) {
      return { processed: false, reason: 'tenant_not_found' };
    }

    const customerId = readCustomerId(sessionObject.customer);

    if (customerId && tenant.stripeCustomerId !== customerId) {
      await this.repository.updateTenantStripeCustomer({
        tenantId: tenant.id,
        stripeCustomerId: customerId,
      });
    }

    await this.repository.recordBillingEvent({
      tenantId: tenant.id,
      stripeCustomerId: customerId ?? tenant.stripeCustomerId,
      stripeSubscriptionId:
        readSubscriptionId(sessionObject.subscription) ?? tenant.stripeSubscriptionId,
      eventType: 'checkout.session.completed',
      amountCents:
        typeof sessionObject.amount_total === 'number' ? sessionObject.amount_total : null,
      currency: (sessionObject.currency ?? 'eur').toUpperCase(),
      metadata: {
        stripeSessionId: sessionObject.id,
        plan: sessionObject.metadata?.['plan'] ?? null,
      },
    });

    return { processed: true };
  }

  private async handleSubscriptionUpserted(
    subscription: Stripe.Subscription,
    tenantHint: TenantBillingRow | null,
  ): Promise<WebhookHandlerResult> {
    const tenant = tenantHint ?? (await this.resolveTenantFromSubscription(subscription));

    if (!tenant) {
      return { processed: false, reason: 'tenant_not_found' };
    }

    const priceId = readPrimaryPriceId(subscription);
    const planByPrice = priceId ? this.mapPriceIdToPlan(priceId) : null;
    const planMetadata = readPlanMetadata(subscription);
    const plan = planByPrice ?? planMetadata ?? tenant.plan;
    const status = mapSubscriptionStatusToTenantStatus(subscription.status, plan);
    const currentPeriodEndDate = readSubscriptionPeriodEnd(subscription);
    const customerId = readCustomerId(subscription.customer);

    if (customerId && tenant.stripeCustomerId !== customerId) {
      await this.repository.updateTenantStripeCustomer({
        tenantId: tenant.id,
        stripeCustomerId: customerId,
      });
    }

    await this.repository.updateTenantSubscription({
      tenantId: tenant.id,
      plan,
      status,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: currentPeriodEndDate,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    });

    await this.repository.recordBillingEvent({
      tenantId: tenant.id,
      stripeCustomerId: customerId ?? tenant.stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      eventType: priceId && !planByPrice ? `unknown_price:${priceId}` : 'subscription.upserted',
      amountCents: null,
      currency: 'EUR',
      metadata: {
        stripeStatus: subscription.status,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        priceId,
        plan,
      },
    });

    if (priceId && !planByPrice) {
      logger.warn(
        { stripeSubscriptionId: subscription.id, priceId, tenantId: tenant.id },
        'Stripe subscription with unknown price id',
      );

      return { processed: true, reason: 'unknown_price' };
    }

    return { processed: true };
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
    tenantHint: TenantBillingRow | null,
  ): Promise<WebhookHandlerResult> {
    const tenant = tenantHint ?? (await this.resolveTenantFromSubscription(subscription));

    if (!tenant) {
      return { processed: false, reason: 'tenant_not_found' };
    }

    await this.repository.updateTenantSubscription({
      tenantId: tenant.id,
      plan: 'trial',
      status: 'cancelled',
      stripeSubscriptionId: null,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: readSubscriptionPeriodEnd(subscription),
      cancelAtPeriodEnd: false,
    });

    await this.repository.recordBillingEvent({
      tenantId: tenant.id,
      stripeCustomerId: tenant.stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      eventType: 'subscription.deleted',
      amountCents: null,
      currency: 'EUR',
      metadata: {
        stripeStatus: subscription.status,
      },
    });

    return { processed: true };
  }

  private async handleInvoiceStatus(
    invoice: Stripe.Invoice,
    tenantHint: TenantBillingRow | null,
    invoiceStatus: 'paid' | 'failed',
    eventType: string,
  ): Promise<WebhookHandlerResult> {
    const tenant = tenantHint ?? (await this.resolveTenantFromInvoice(invoice));

    if (!tenant) {
      return { processed: false, reason: 'tenant_not_found' };
    }

    const issuedAt = typeof invoice.created === 'number' ? new Date(invoice.created * 1000) : null;

    await this.repository.upsertInvoice({
      tenantId: tenant.id,
      stripeInvoiceId: invoice.id ?? '',
      invoiceNumber: invoice.number ?? null,
      amountCents:
        typeof invoice.amount_paid === 'number' && invoiceStatus === 'paid'
          ? invoice.amount_paid
          : (invoice.amount_due ?? 0),
      currency: (invoice.currency ?? 'eur').toUpperCase(),
      status: invoiceStatus,
      issuedAt,
    });

    await this.repository.recordBillingEvent({
      tenantId: tenant.id,
      stripeCustomerId: readCustomerId(invoice.customer) ?? tenant.stripeCustomerId,
      stripeSubscriptionId:
        readSubscriptionId((invoice as Stripe.Invoice & { subscription?: unknown }).subscription) ??
        tenant.stripeSubscriptionId,
      eventType,
      amountCents:
        typeof invoice.amount_paid === 'number' && invoiceStatus === 'paid'
          ? invoice.amount_paid
          : (invoice.amount_due ?? null),
      currency: (invoice.currency ?? 'eur').toUpperCase(),
      metadata: {
        stripeInvoiceId: invoice.id,
        invoiceNumber: invoice.number ?? null,
        invoiceStatus,
      },
    });

    return { processed: true };
  }

  private async resolveTenantForEvent(event: Stripe.Event): Promise<TenantBillingRow | null> {
    const object = event.data.object;

    if (isStripeCheckoutSession(object)) {
      return this.resolveTenantFromCheckoutSession(object);
    }

    if (isStripeSubscription(object)) {
      return this.resolveTenantFromSubscription(object);
    }

    if (isStripeInvoice(object)) {
      return this.resolveTenantFromInvoice(object);
    }

    if (isStripeCustomer(object)) {
      return this.repository.findTenantByStripeCustomerId(object.id);
    }

    // Fallback: alcuni eventi (es. customer.* derivati) espongono un campo
    // `customer` ma non sono uno dei tipi sopra. Estraiamo il discriminante
    // generico e proviamo a risolvere via customer id.
    const discriminator = readStripeObjectDiscriminator(object);
    const customerId = readCustomerId(discriminator?.customer);

    if (customerId) {
      return this.repository.findTenantByStripeCustomerId(customerId);
    }

    return null;
  }

  private async resolveTenantFromCheckoutSession(
    sessionObject: Stripe.Checkout.Session,
  ): Promise<TenantBillingRow | null> {
    const metadataTenantId = readMetadataTenantId(sessionObject.metadata);

    if (metadataTenantId) {
      const tenant = await this.repository.getTenantBillingSnapshot(metadataTenantId);
      if (tenant) {
        return tenant;
      }
    }

    if (sessionObject.client_reference_id) {
      const tenant = await this.repository.getTenantBillingSnapshot(
        sessionObject.client_reference_id,
      );
      if (tenant) {
        return tenant;
      }
    }

    const customerId = readCustomerId(sessionObject.customer);

    if (customerId) {
      return this.repository.findTenantByStripeCustomerId(customerId);
    }

    return null;
  }

  private async resolveTenantFromSubscription(
    subscription: Stripe.Subscription,
  ): Promise<TenantBillingRow | null> {
    const metadataTenantId = readMetadataTenantId(subscription.metadata);

    if (metadataTenantId) {
      const tenant = await this.repository.getTenantBillingSnapshot(metadataTenantId);
      if (tenant) {
        return tenant;
      }
    }

    const customerId = readCustomerId(subscription.customer);

    if (customerId) {
      return this.repository.findTenantByStripeCustomerId(customerId);
    }

    return null;
  }

  private async resolveTenantFromInvoice(
    invoice: Stripe.Invoice,
  ): Promise<TenantBillingRow | null> {
    const metadataTenantId = readMetadataTenantId(invoice.metadata);

    if (metadataTenantId) {
      const tenant = await this.repository.getTenantBillingSnapshot(metadataTenantId);
      if (tenant) {
        return tenant;
      }
    }

    const customerId = readCustomerId(invoice.customer);

    if (customerId) {
      return this.repository.findTenantByStripeCustomerId(customerId);
    }

    return null;
  }

  private async requireTenant(tenantId: string): Promise<TenantBillingRow> {
    const tenant = await this.repository.getTenantBillingSnapshot(tenantId);

    if (!tenant) {
      throw new AppError('not_found', 'Tenant not found');
    }

    return tenant;
  }

  private async ensureStripeCustomer(tenant: TenantBillingRow): Promise<string> {
    if (tenant.stripeCustomerId) {
      return tenant.stripeCustomerId;
    }

    const customer = await this.stripe.createCustomer({
      email: tenant.billingEmail,
      name: tenant.name,
      metadata: {
        tenant_id: tenant.id,
      },
    });

    await this.repository.updateTenantStripeCustomer({
      tenantId: tenant.id,
      stripeCustomerId: customer.id,
    });

    return customer.id;
  }

  private resolveCheckoutPriceId(plan: CheckoutPlan): string {
    if (plan === 'starter') {
      const priceId = this.config.priceIdByPlan.starter;
      if (!priceId) {
        throw new AppError('bad_request', 'Starter plan is not available yet');
      }
      return priceId;
    }

    if (plan === 'professional') {
      const priceId = this.config.priceIdByPlan.professional;
      if (!priceId) {
        throw new AppError('bad_request', 'Professional plan is not available yet');
      }
      return priceId;
    }

    throw new AppError('bad_request', 'Plan is not selectable in self-checkout');
  }

  private mapPriceIdToPlan(priceId: string): BillingPlan | null {
    if (priceId && priceId === this.config.priceIdByPlan.starter) {
      return 'starter';
    }

    if (priceId && priceId === this.config.priceIdByPlan.professional) {
      return 'professional';
    }

    return null;
  }
}

function buildBillingStatus(
  tenant: TenantBillingRow,
  role: AuthSession['role'],
  config: StripeBillingConfig,
): BillingStatus {
  const canManage = role === 'owner' || role === 'admin';
  const hasActiveSubscription = Boolean(
    tenant.stripeSubscriptionId &&
    tenant.subscriptionStatus &&
    ['active', 'trialing', 'past_due'].includes(tenant.subscriptionStatus),
  );

  const availablePlans: CheckoutPlan[] = [];
  if (config.priceIdByPlan.starter) {
    availablePlans.push('starter');
  }
  if (config.priceIdByPlan.professional) {
    availablePlans.push('professional');
  }

  return {
    plan: tenant.plan,
    status: tenant.status,
    trialEndsAt: tenant.trialEndsAt,
    currentPeriodEnd: tenant.currentPeriodEnd,
    cancelAtPeriodEnd: tenant.cancelAtPeriodEnd,
    subscriptionStatus: tenant.subscriptionStatus,
    hasStripeCustomer: Boolean(tenant.stripeCustomerId),
    hasActiveSubscription,
    canCheckout: canManage && !hasActiveSubscription,
    canManageBilling: canManage && Boolean(tenant.stripeCustomerId),
    availablePlans,
  };
}

function mapSubscriptionStatusToTenantStatus(
  stripeStatus: Stripe.Subscription.Status,
  plan: BillingPlan,
): BillingTenantStatus {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'suspended';
    case 'canceled':
      return 'cancelled';
    case 'incomplete':
    case 'incomplete_expired':
      return plan === 'trial' ? 'expired' : 'suspended';
    case 'paused':
      return 'suspended';
    default:
      return 'active';
  }
}

/**
 * Cast `event.data.object` to the expected Stripe entity, verifying che il
 * payload runtime abbia il discriminante `object` atteso.
 *
 * Stripe's webhook envelope stores the entity under `data.object`; the SDK
 * types it as `Stripe.Event.Data.Object` (a union of every entity), so a plain
 * cast inside a `case 'checkout.session.completed'` block compiles even if the
 * payload was a Subscription. This helper short-circuits that mismatch with a
 * runtime check that throws before any handler accesses entity-specific
 * fields.
 */
function assertStripeObject<T extends { object: string }>(
  event: Stripe.Event,
  expectedObjectType: T['object'],
): T {
  // Object discriminator runtime check: throws if mismatch.
  const object: unknown = event.data.object;
  const discriminator = readStripeObjectDiscriminator(object);

  if (discriminator?.object !== expectedObjectType) {
    throw new AppError(
      'bad_request',
      `Expected Stripe payload of type "${expectedObjectType}" for event "${event.type}", got "${String(discriminator?.object)}"`,
      { expose: false },
    );
  }

  // Il check sopra garantisce che `object` ha la struttura di T (verificata
  // tramite `object` discriminator). Usiamo doppio cast intenzionale via
  // `unknown` perche' Stripe.Event.Data.Object e' un union molto ampio che
  // non si sovrappone strutturalmente a T senza passare per unknown.
  // eslint-disable-next-line no-restricted-syntax -- Cast post-asserzione runtime
  return object as unknown as T;
}

function readPrimaryPriceId(subscription: Stripe.Subscription): string | null {
  const items = subscription.items?.data ?? [];

  for (const item of items) {
    if (item.price?.id) {
      return item.price.id;
    }
  }

  return null;
}

function readPlanMetadata(subscription: Stripe.Subscription): BillingPlan | null {
  const value = subscription.metadata?.['plan'];

  if (value === 'starter' || value === 'professional' || value === 'agency') {
    return value;
  }

  return null;
}

function readSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined;

  if (item && typeof item.current_period_end === 'number') {
    return new Date(item.current_period_end * 1000);
  }

  const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;

  if (typeof periodEnd === 'number') {
    return new Date(periodEnd * 1000);
  }

  return null;
}

function readCustomerId(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string'
  ) {
    return (value as { id: string }).id;
  }

  return null;
}

function readSubscriptionId(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string'
  ) {
    return (value as { id: string }).id;
  }

  return null;
}

function readMetadataTenantId(metadata: Stripe.Metadata | null | undefined): string | null {
  const value = metadata?.['tenant_id'];

  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return null;
}

function assertTenantAdmin(session: AuthSession): void {
  if (session.role !== 'owner' && session.role !== 'admin') {
    throw new AppError('forbidden', 'Owner or admin role is required');
  }
}

export class SupabaseStripeBillingRepository implements StripeBillingRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getTenantBillingSnapshot(tenantId: string): Promise<TenantBillingRow | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select(
        'id, name, billing_email, plan, status, trial_ends_at, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, cancel_at_period_end',
      )
      .eq('id', tenantId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read tenant billing snapshot', error);
    }

    return data ? mapTenantRow(data as TenantSupabaseRow) : null;
  }

  async findTenantByStripeCustomerId(customerId: string): Promise<TenantBillingRow | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select(
        'id, name, billing_email, plan, status, trial_ends_at, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, cancel_at_period_end',
      )
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to find tenant by Stripe customer id', error);
    }

    return data ? mapTenantRow(data as TenantSupabaseRow) : null;
  }

  async updateTenantStripeCustomer(input: {
    tenantId: string;
    stripeCustomerId: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('tenants')
      .update({
        stripe_customer_id: input.stripeCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.tenantId);

    if (error) {
      throw toRepositoryError('Failed to set tenant stripe customer', error);
    }
  }

  async updateTenantSubscription(input: {
    tenantId: string;
    plan: BillingPlan;
    status: BillingTenantStatus;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('tenants')
      .update({
        plan: input.plan,
        status: input.status,
        stripe_subscription_id: input.stripeSubscriptionId,
        subscription_status: input.subscriptionStatus,
        current_period_end: input.currentPeriodEnd ? input.currentPeriodEnd.toISOString() : null,
        cancel_at_period_end: input.cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.tenantId);

    if (error) {
      throw toRepositoryError('Failed to update tenant subscription state', error);
    }
  }

  async recordBillingEvent(input: {
    tenantId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    eventType: string;
    amountCents: number | null;
    currency: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from('billing_events').insert({
      tenant_id: input.tenantId,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      event_type: input.eventType,
      amount_cents: input.amountCents,
      currency: input.currency,
      metadata: input.metadata,
    });

    if (error) {
      throw toRepositoryError('Failed to record billing event', error);
    }
  }

  async upsertInvoice(input: {
    tenantId: string;
    stripeInvoiceId: string;
    invoiceNumber: string | null;
    amountCents: number;
    currency: string;
    status: 'draft' | 'sent' | 'paid' | 'void' | 'failed';
    issuedAt: Date | null;
  }): Promise<void> {
    const { error } = await this.supabase.from('invoices').upsert(
      {
        tenant_id: input.tenantId,
        stripe_invoice_id: input.stripeInvoiceId,
        invoice_number: input.invoiceNumber,
        amount_cents: input.amountCents,
        currency: input.currency,
        status: input.status,
        issued_at: input.issuedAt ? input.issuedAt.toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_invoice_id' },
    );

    if (error) {
      throw toRepositoryError('Failed to upsert invoice', error);
    }
  }

  async recordWebhookEvent(input: {
    tenantId: string | null;
    idempotencyKey: string;
    eventType: string;
    externalId: string;
    payload: Record<string, unknown>;
  }): Promise<{ eventId: string; alreadyProcessed: boolean }> {
    const insert = await this.supabase
      .from('webhook_events')
      .insert({
        tenant_id: input.tenantId,
        provider: 'stripe',
        event_type: input.eventType,
        external_id: input.externalId,
        idempotency_key: input.idempotencyKey,
        payload: input.payload,
        status: 'received',
      })
      .select('id')
      .single();

    if (!insert.error) {
      return {
        eventId: insert.data.id as string,
        alreadyProcessed: false,
      };
    }

    if (!isUniqueViolation(insert.error)) {
      throw toRepositoryError('Failed to record Stripe webhook event', insert.error);
    }

    const existing = await this.supabase
      .from('webhook_events')
      .select('id, status')
      .eq('idempotency_key', input.idempotencyKey)
      .single();

    if (existing.error) {
      throw toRepositoryError('Failed to read existing Stripe webhook event', existing.error);
    }

    const status = existing.data.status as 'received' | 'processed' | 'duplicate' | 'failed';

    return {
      eventId: existing.data.id as string,
      alreadyProcessed: status === 'processed' || status === 'duplicate',
    };
  }

  async markWebhookEventProcessed(input: {
    eventId: string;
    tenantId: string | null;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('webhook_events')
      .update({
        tenant_id: input.tenantId,
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', input.eventId);

    if (error) {
      throw toRepositoryError('Failed to mark Stripe webhook event processed', error);
    }
  }

  async recordAuditLog(input: AuditLogInput): Promise<void> {
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
      throw toRepositoryError('Failed to write billing audit log', error);
    }
  }
}

class StripeApiAdapter implements StripeApi {
  async createCustomer(params: Stripe.CustomerCreateParams): Promise<Stripe.Customer> {
    return getStripeClient().customers.create(params);
  }

  async createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<Stripe.Checkout.Session> {
    return getStripeClient().checkout.sessions.create(params);
  }

  async createBillingPortalSession(
    params: Stripe.BillingPortal.SessionCreateParams,
  ): Promise<Stripe.BillingPortal.Session> {
    return getStripeClient().billingPortal.sessions.create(params);
  }
}

export function loadStripeBillingConfigFromEnv(): StripeBillingConfig {
  return {
    priceIdByPlan: {
      starter: env.STRIPE_PRICE_STARTER,
      professional: env.STRIPE_PRICE_PROFESSIONAL,
    },
    checkoutSuccessUrl: env.STRIPE_CHECKOUT_SUCCESS_URL,
    checkoutCancelUrl: env.STRIPE_CHECKOUT_CANCEL_URL,
    portalReturnUrl: env.STRIPE_BILLING_PORTAL_RETURN_URL,
  };
}

export function createStripeBillingService(): StripeBillingService {
  return new StripeBillingService(
    new SupabaseStripeBillingRepository(),
    new StripeApiAdapter(),
    loadStripeBillingConfigFromEnv(),
  );
}

type TenantSupabaseRow = {
  id: string;
  name: string;
  billing_email: string;
  plan: string;
  status: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

function mapTenantRow(row: TenantSupabaseRow): TenantBillingRow {
  return {
    id: row.id,
    name: row.name,
    billingEmail: row.billing_email,
    plan: normalizeBillingPlan(row.plan),
    status: normalizeBillingStatus(row.status),
    trialEndsAt: row.trial_ends_at,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    subscriptionStatus: row.subscription_status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

function normalizeBillingPlan(value: string): BillingPlan {
  if (value === 'trial' || value === 'starter' || value === 'professional' || value === 'agency') {
    return value;
  }

  return 'trial';
}

function normalizeBillingStatus(value: string): BillingTenantStatus {
  if (value === 'active' || value === 'expired' || value === 'suspended' || value === 'cancelled') {
    return value;
  }

  return 'active';
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
