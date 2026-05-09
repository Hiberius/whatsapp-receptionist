// Fatto da Claude Code il 27 aprile 2026.
//
// Test per StripeBillingService (status, checkout, portal). Stripe SDK e
// repository sono fake per evitare chiamate di rete e dipendenze Supabase.

/* eslint-disable no-restricted-syntax -- Test fixtures: gli oggetti
Stripe.Checkout.Session / Stripe.BillingPortal.Session vengono costruiti come
literal JSON minimal e castati per soddisfare la firma del tipo SDK. */

import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';

import type { AuthSession } from '@/lib/auth/session';
import {
  StripeBillingService,
  type BillingPlan,
  type BillingTenantStatus,
  type StripeApi,
  type StripeBillingConfig,
  type StripeBillingRepository,
  type TenantBillingRow,
} from '@/server/billing/stripe-billing';

const TEST_CONFIG: StripeBillingConfig = {
  priceIdByPlan: {
    starter: 'price_starter_test',
    professional: 'price_professional_test',
  },
  checkoutSuccessUrl: 'https://app.example.com/billing?ok=1',
  checkoutCancelUrl: 'https://app.example.com/billing?cancel=1',
  portalReturnUrl: 'https://app.example.com/billing',
};

describe('StripeBillingService.getStatus', () => {
  it('returns trial status with checkout enabled for owners', async () => {
    const tenant = makeTenantRow();
    const { service } = makeService([tenant]);

    const status = await service.getStatus({ session: ownerSession() });

    expect(status).toMatchObject({
      plan: 'trial',
      status: 'active',
      trialEndsAt: '2026-05-10T12:00:00.000Z',
      hasStripeCustomer: false,
      hasActiveSubscription: false,
      canCheckout: true,
      canManageBilling: false,
      availablePlans: ['starter', 'professional'],
    });
  });

  it('marks subscription active when stripe sub is active', async () => {
    const tenant = makeTenantRow({
      plan: 'professional',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      subscriptionStatus: 'active',
      currentPeriodEnd: '2026-05-27T12:00:00.000Z',
    });
    const { service } = makeService([tenant]);

    const status = await service.getStatus({ session: ownerSession() });

    expect(status.hasActiveSubscription).toBe(true);
    expect(status.canCheckout).toBe(false);
    expect(status.canManageBilling).toBe(true);
  });

  it('does not let members manage billing', async () => {
    const tenant = makeTenantRow({ stripeCustomerId: 'cus_member' });
    const { service } = makeService([tenant]);

    const status = await service.getStatus({ session: memberSession() });

    expect(status.canCheckout).toBe(false);
    expect(status.canManageBilling).toBe(false);
  });

  it('throws when tenant snapshot is missing', async () => {
    const { service } = makeService([]);

    await expect(service.getStatus({ session: ownerSession() })).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

describe('StripeBillingService.createCheckoutSession', () => {
  it('creates lazy stripe customer and checkout session for starter plan', async () => {
    const tenant = makeTenantRow();
    const { service, stripe, repository } = makeService([tenant]);

    const result = await service.createCheckoutSession({
      session: adminSession(),
      plan: 'starter',
      ipAddress: '203.0.113.10',
      userAgent: 'Vitest',
    });

    expect(result).toEqual({ url: 'https://checkout.example.com/cs_test' });
    expect(stripe.calls.createCustomer).toHaveLength(1);
    expect(stripe.calls.createCustomer[0]).toMatchObject({
      email: 'studio@example.com',
      name: 'Studio Ambrogio',
      metadata: { tenant_id: tenant.id },
    });
    expect(stripe.calls.checkout).toHaveLength(1);
    expect(stripe.calls.checkout[0]).toMatchObject({
      mode: 'subscription',
      customer: 'cus_new_lazy',
      client_reference_id: tenant.id,
      success_url: 'https://app.example.com/billing?ok=1',
      cancel_url: 'https://app.example.com/billing?cancel=1',
      line_items: [{ price: 'price_starter_test', quantity: 1 }],
      subscription_data: {
        metadata: { tenant_id: tenant.id, plan: 'starter' },
      },
    });
    expect(repository.tenantUpdates).toContainEqual(
      expect.objectContaining({
        tenantId: tenant.id,
        stripeCustomerId: 'cus_new_lazy',
      }),
    );
    expect(repository.auditLogs).toContainEqual(
      expect.objectContaining({
        action: 'billing.checkout.created',
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
        metadata: expect.objectContaining({
          plan: 'starter',
          priceId: 'price_starter_test',
        }),
      }),
    );
  });

  it('reuses existing stripe customer when present', async () => {
    const tenant = makeTenantRow({ stripeCustomerId: 'cus_existing' });
    const { service, stripe } = makeService([tenant]);

    await service.createCheckoutSession({
      session: ownerSession(),
      plan: 'professional',
      ipAddress: null,
      userAgent: null,
    });

    expect(stripe.calls.createCustomer).toHaveLength(0);
    expect(stripe.calls.checkout[0]).toMatchObject({
      customer: 'cus_existing',
      line_items: [{ price: 'price_professional_test', quantity: 1 }],
    });
  });

  it('rejects member role with forbidden', async () => {
    const tenant = makeTenantRow();
    const { service } = makeService([tenant]);

    await expect(
      service.createCheckoutSession({
        session: memberSession(),
        plan: 'starter',
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('rejects checkout when price config is missing', async () => {
    const tenant = makeTenantRow();
    const { service } = makeService([tenant], {
      ...TEST_CONFIG,
      priceIdByPlan: { starter: '', professional: 'price_professional_test' },
    });

    await expect(
      service.createCheckoutSession({
        session: ownerSession(),
        plan: 'starter',
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ code: 'bad_request' });
  });
});

describe('StripeBillingService.createPortalSession', () => {
  it('creates portal session and audits when stripe customer exists', async () => {
    const tenant = makeTenantRow({ stripeCustomerId: 'cus_portal' });
    const { service, stripe, repository } = makeService([tenant]);

    const result = await service.createPortalSession({
      session: ownerSession(),
      ipAddress: '203.0.113.10',
      userAgent: 'Vitest',
    });

    expect(result).toEqual({ url: 'https://portal.example.com/bps_test' });
    expect(stripe.calls.portal).toHaveLength(1);
    expect(stripe.calls.portal[0]).toMatchObject({
      customer: 'cus_portal',
      return_url: 'https://app.example.com/billing',
    });
    expect(repository.auditLogs).toContainEqual(
      expect.objectContaining({
        action: 'billing.portal.created',
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
      }),
    );
  });

  it('rejects portal when tenant has no stripe customer', async () => {
    const tenant = makeTenantRow();
    const { service } = makeService([tenant]);

    await expect(
      service.createPortalSession({
        session: ownerSession(),
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ code: 'bad_request' });
  });

  it('rejects member role with forbidden', async () => {
    const tenant = makeTenantRow({ stripeCustomerId: 'cus_member' });
    const { service } = makeService([tenant]);

    await expect(
      service.createPortalSession({
        session: memberSession(),
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});

function makeService(
  tenants: TenantBillingRow[],
  config: StripeBillingConfig = TEST_CONFIG,
): {
  service: StripeBillingService;
  repository: FakeStripeBillingRepository;
  stripe: FakeStripeApi;
} {
  const repository = new FakeStripeBillingRepository(tenants);
  const stripe = new FakeStripeApi();
  const service = new StripeBillingService(repository, stripe, config);
  return { service, repository, stripe };
}

function makeTenantRow(overrides: Partial<TenantBillingRow> = {}): TenantBillingRow {
  const base: TenantBillingRow = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Studio Ambrogio',
    billingEmail: 'studio@example.com',
    plan: 'trial' as BillingPlan,
    status: 'active' as BillingTenantStatus,
    trialEndsAt: '2026-05-10T12:00:00.000Z',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };

  return { ...base, ...overrides };
}

function ownerSession(): AuthSession {
  return {
    userId: '00000000-0000-4000-8000-000000000099',
    tenantId: '00000000-0000-4000-8000-000000000001',
    role: 'owner',
  };
}

function adminSession(): AuthSession {
  return { ...ownerSession(), role: 'admin' };
}

function memberSession(): AuthSession {
  return { ...ownerSession(), role: 'member' };
}

class FakeStripeBillingRepository implements StripeBillingRepository {
  tenantUpdates: Array<{ tenantId: string; stripeCustomerId: string }> = [];
  subscriptionUpdates: Array<Parameters<StripeBillingRepository['updateTenantSubscription']>[0]> =
    [];
  billingEvents: Array<Parameters<StripeBillingRepository['recordBillingEvent']>[0]> = [];
  invoices: Array<Parameters<StripeBillingRepository['upsertInvoice']>[0]> = [];
  webhookEvents: Array<{
    tenantId: string | null;
    idempotencyKey: string;
    eventType: string;
    externalId: string;
  }> = [];
  processedWebhooks: Array<{ eventId: string; tenantId: string | null }> = [];
  auditLogs: Array<Parameters<StripeBillingRepository['recordAuditLog']>[0]> = [];

  constructor(private readonly tenants: TenantBillingRow[]) {}

  async getTenantBillingSnapshot(tenantId: string): Promise<TenantBillingRow | null> {
    return this.tenants.find((t) => t.id === tenantId) ?? null;
  }

  async findTenantByStripeCustomerId(customerId: string): Promise<TenantBillingRow | null> {
    return this.tenants.find((t) => t.stripeCustomerId === customerId) ?? null;
  }

  async updateTenantStripeCustomer(input: {
    tenantId: string;
    stripeCustomerId: string;
  }): Promise<void> {
    this.tenantUpdates.push(input);
    const tenant = this.tenants.find((t) => t.id === input.tenantId);
    if (tenant) {
      tenant.stripeCustomerId = input.stripeCustomerId;
    }
  }

  async updateTenantSubscription(
    input: Parameters<StripeBillingRepository['updateTenantSubscription']>[0],
  ): Promise<void> {
    this.subscriptionUpdates.push(input);
    const tenant = this.tenants.find((t) => t.id === input.tenantId);
    if (tenant) {
      tenant.plan = input.plan;
      tenant.status = input.status;
      tenant.stripeSubscriptionId = input.stripeSubscriptionId;
      tenant.subscriptionStatus = input.subscriptionStatus;
      tenant.currentPeriodEnd = input.currentPeriodEnd
        ? input.currentPeriodEnd.toISOString()
        : null;
      tenant.cancelAtPeriodEnd = input.cancelAtPeriodEnd;
    }
  }

  async recordBillingEvent(
    input: Parameters<StripeBillingRepository['recordBillingEvent']>[0],
  ): Promise<void> {
    this.billingEvents.push(input);
  }

  async upsertInvoice(
    input: Parameters<StripeBillingRepository['upsertInvoice']>[0],
  ): Promise<void> {
    this.invoices.push(input);
  }

  async recordWebhookEvent(input: {
    tenantId: string | null;
    idempotencyKey: string;
    eventType: string;
    externalId: string;
    payload: Record<string, unknown>;
  }): Promise<{ eventId: string; alreadyProcessed: boolean }> {
    const existing = this.webhookEvents.find((e) => e.idempotencyKey === input.idempotencyKey);

    if (existing) {
      return {
        eventId: input.externalId,
        alreadyProcessed: true,
      };
    }

    this.webhookEvents.push({
      tenantId: input.tenantId,
      idempotencyKey: input.idempotencyKey,
      eventType: input.eventType,
      externalId: input.externalId,
    });

    return { eventId: input.externalId, alreadyProcessed: false };
  }

  async markWebhookEventProcessed(input: {
    eventId: string;
    tenantId: string | null;
  }): Promise<void> {
    this.processedWebhooks.push(input);
  }

  async recordAuditLog(
    input: Parameters<StripeBillingRepository['recordAuditLog']>[0],
  ): Promise<void> {
    this.auditLogs.push(input);
  }
}

class FakeStripeApi implements StripeApi {
  calls: {
    createCustomer: Stripe.CustomerCreateParams[];
    checkout: Stripe.Checkout.SessionCreateParams[];
    portal: Stripe.BillingPortal.SessionCreateParams[];
  } = {
    createCustomer: [],
    checkout: [],
    portal: [],
  };

  async createCustomer(params: Stripe.CustomerCreateParams): Promise<Stripe.Customer> {
    this.calls.createCustomer.push(params);
    return {
      id: 'cus_new_lazy',
      object: 'customer',
    } as Stripe.Customer;
  }

  async createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<Stripe.Checkout.Session> {
    this.calls.checkout.push(params);
    return {
      id: 'cs_test',
      object: 'checkout.session',
      url: 'https://checkout.example.com/cs_test',
    } as unknown as Stripe.Checkout.Session;
  }

  async createBillingPortalSession(
    params: Stripe.BillingPortal.SessionCreateParams,
  ): Promise<Stripe.BillingPortal.Session> {
    this.calls.portal.push(params);
    return {
      id: 'bps_test',
      object: 'billing_portal.session',
      url: 'https://portal.example.com/bps_test',
    } as unknown as Stripe.BillingPortal.Session;
  }
}
