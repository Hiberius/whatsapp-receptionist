// Fatto da Claude Code il 27 aprile 2026.
//
// Test webhook Stripe: handleWebhookEvent gestisce idempotency, mappa eventi
// subscription/invoice/checkout, deriva plan dal price ID e su delete riporta
// il tenant a trial+cancelled.

/* eslint-disable no-restricted-syntax -- Test fixtures: i payload Stripe.Event
sono costruiti come literal JSON e castati a `Stripe.Event` per riprodurre la
struttura del webhook. La validazione runtime non aggiungerebbe valore in test. */

import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';

import {
  StripeBillingService,
  type BillingPlan,
  type BillingTenantStatus,
  type StripeApi,
  type StripeBillingConfig,
  type StripeBillingRepository,
  type TenantBillingRow,
} from '@/server/billing/stripe-billing';

const TENANT_ID = '00000000-0000-4000-8000-000000000001';

const TEST_CONFIG: StripeBillingConfig = {
  priceIdByPlan: {
    starter: 'price_starter_test',
    professional: 'price_professional_test',
  },
  checkoutSuccessUrl: 'https://app.example.com/billing?ok=1',
  checkoutCancelUrl: 'https://app.example.com/billing?cancel=1',
  portalReturnUrl: 'https://app.example.com/billing',
};

describe('StripeBillingService.handleWebhookEvent', () => {
  it('promotes tenant to starter plan on subscription.created', async () => {
    const tenant = makeTenantRow({ stripeCustomerId: 'cus_starter' });
    const { service, repository } = makeService([tenant]);

    const event = makeSubscriptionEvent('customer.subscription.created', {
      id: 'sub_starter',
      customerId: 'cus_starter',
      priceId: 'price_starter_test',
      status: 'active',
      tenantMetadata: TENANT_ID,
      currentPeriodEnd: 1_777_891_200, // 2026-05-04T12:00:00Z
    });

    const result = await service.handleWebhookEvent({ event });

    expect(result).toEqual({ processed: true });
    expect(repository.subscriptionUpdates).toEqual([
      expect.objectContaining({
        tenantId: TENANT_ID,
        plan: 'starter',
        status: 'active',
        stripeSubscriptionId: 'sub_starter',
        subscriptionStatus: 'active',
        cancelAtPeriodEnd: false,
      }),
    ]);
    expect(repository.processedWebhooks).toHaveLength(1);
    expect(repository.billingEvents).toContainEqual(
      expect.objectContaining({ eventType: 'subscription.upserted' }),
    );
  });

  it('preserves plan but flags cancel_at_period_end on subscription.updated', async () => {
    const tenant = makeTenantRow({
      plan: 'professional',
      status: 'active',
      stripeCustomerId: 'cus_pro',
      stripeSubscriptionId: 'sub_pro',
      subscriptionStatus: 'active',
    });
    const { service, repository } = makeService([tenant]);

    const event = makeSubscriptionEvent('customer.subscription.updated', {
      id: 'sub_pro',
      customerId: 'cus_pro',
      priceId: 'price_professional_test',
      status: 'active',
      tenantMetadata: TENANT_ID,
      cancelAtPeriodEnd: true,
    });

    const result = await service.handleWebhookEvent({ event });

    expect(result).toEqual({ processed: true });
    expect(repository.subscriptionUpdates[0]).toMatchObject({
      tenantId: TENANT_ID,
      plan: 'professional',
      status: 'active',
      cancelAtPeriodEnd: true,
    });
  });

  it('reverts tenant to trial+cancelled on subscription.deleted', async () => {
    const tenant = makeTenantRow({
      plan: 'professional',
      status: 'active',
      stripeCustomerId: 'cus_pro',
      stripeSubscriptionId: 'sub_pro',
      subscriptionStatus: 'active',
    });
    const { service, repository } = makeService([tenant]);

    const event = makeSubscriptionEvent('customer.subscription.deleted', {
      id: 'sub_pro',
      customerId: 'cus_pro',
      priceId: 'price_professional_test',
      status: 'canceled',
      tenantMetadata: TENANT_ID,
    });

    const result = await service.handleWebhookEvent({ event });

    expect(result).toEqual({ processed: true });
    expect(repository.subscriptionUpdates[0]).toMatchObject({
      tenantId: TENANT_ID,
      plan: 'trial',
      status: 'cancelled',
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
    });
    expect(repository.billingEvents).toContainEqual(
      expect.objectContaining({ eventType: 'subscription.deleted' }),
    );
  });

  it('flags unknown_price but still records subscription update', async () => {
    const tenant = makeTenantRow({
      stripeCustomerId: 'cus_unknown',
    });
    const { service, repository } = makeService([tenant]);

    const event = makeSubscriptionEvent('customer.subscription.created', {
      id: 'sub_unknown',
      customerId: 'cus_unknown',
      priceId: 'price_unknown_xyz',
      status: 'active',
      tenantMetadata: TENANT_ID,
    });

    const result = await service.handleWebhookEvent({ event });

    expect(result).toEqual({ processed: true, reason: 'unknown_price' });
    expect(repository.billingEvents).toContainEqual(
      expect.objectContaining({
        eventType: 'unknown_price:price_unknown_xyz',
      }),
    );
  });

  it('upserts invoice and billing event on invoice.paid', async () => {
    const tenant = makeTenantRow({ stripeCustomerId: 'cus_inv' });
    const { service, repository } = makeService([tenant]);

    const event = makeInvoiceEvent('invoice.paid', {
      id: 'in_paid_1',
      customerId: 'cus_inv',
      subscriptionId: 'sub_inv',
      amountPaid: 9700,
      currency: 'eur',
      number: 'AMB-0001',
      created: 1_777_700_000,
    });

    const result = await service.handleWebhookEvent({ event });

    expect(result).toEqual({ processed: true });
    expect(repository.invoices).toEqual([
      expect.objectContaining({
        tenantId: TENANT_ID,
        stripeInvoiceId: 'in_paid_1',
        invoiceNumber: 'AMB-0001',
        amountCents: 9700,
        currency: 'EUR',
        status: 'paid',
      }),
    ]);
    expect(repository.billingEvents).toContainEqual(
      expect.objectContaining({ eventType: 'invoice.paid' }),
    );
  });

  it('upserts invoice with failed status on invoice.payment_failed', async () => {
    const tenant = makeTenantRow({ stripeCustomerId: 'cus_inv2' });
    const { service, repository } = makeService([tenant]);

    const event = makeInvoiceEvent('invoice.payment_failed', {
      id: 'in_failed_1',
      customerId: 'cus_inv2',
      subscriptionId: 'sub_inv2',
      amountDue: 9700,
      currency: 'eur',
      created: 1_777_700_000,
    });

    const result = await service.handleWebhookEvent({ event });

    expect(result).toEqual({ processed: true });
    expect(repository.invoices[0]).toMatchObject({
      status: 'failed',
      amountCents: 9700,
    });
  });

  it('returns duplicate when same event id is replayed', async () => {
    const tenant = makeTenantRow({ stripeCustomerId: 'cus_dup' });
    const { service, repository } = makeService([tenant]);

    const event = makeSubscriptionEvent('customer.subscription.created', {
      id: 'sub_dup',
      customerId: 'cus_dup',
      priceId: 'price_starter_test',
      status: 'active',
      tenantMetadata: TENANT_ID,
      stripeEventId: 'evt_replay_1',
    });

    const first = await service.handleWebhookEvent({ event });
    const second = await service.handleWebhookEvent({ event });

    expect(first).toEqual({ processed: true });
    expect(second).toEqual({ processed: false, reason: 'duplicate' });
    expect(repository.subscriptionUpdates).toHaveLength(1);
  });

  it('resolves tenant via stripe customer when metadata is missing', async () => {
    const tenant = makeTenantRow({ stripeCustomerId: 'cus_byid' });
    const { service, repository } = makeService([tenant]);

    const event = makeSubscriptionEvent('customer.subscription.created', {
      id: 'sub_byid',
      customerId: 'cus_byid',
      priceId: 'price_starter_test',
      status: 'active',
      tenantMetadata: null,
    });

    const result = await service.handleWebhookEvent({ event });

    expect(result).toEqual({ processed: true });
    expect(repository.subscriptionUpdates[0]).toMatchObject({
      tenantId: TENANT_ID,
    });
  });

  it('returns tenant_not_found without throwing when no resolution path works', async () => {
    const { service } = makeService([]);

    const event = makeSubscriptionEvent('customer.subscription.created', {
      id: 'sub_orphan',
      customerId: 'cus_orphan',
      priceId: 'price_starter_test',
      status: 'active',
      tenantMetadata: null,
    });

    const result = await service.handleWebhookEvent({ event });

    expect(result).toEqual({ processed: false, reason: 'tenant_not_found' });
  });

  it('records unhandled event type in billing_events when tenant resolved', async () => {
    const tenant = makeTenantRow({ stripeCustomerId: 'cus_other' });
    const { service, repository } = makeService([tenant]);

    const event = {
      id: 'evt_other_1',
      object: 'event',
      type: 'customer.updated',
      data: {
        object: {
          object: 'customer',
          id: 'cus_other',
        },
      },
    } as unknown as Stripe.Event;

    const result = await service.handleWebhookEvent({ event });

    expect(result).toEqual({ processed: true, reason: 'unhandled' });
    expect(repository.billingEvents).toContainEqual(
      expect.objectContaining({ eventType: 'unhandled:customer.updated' }),
    );
  });
});

function makeService(tenants: TenantBillingRow[]): {
  service: StripeBillingService;
  repository: FakeWebhookRepository;
} {
  const repository = new FakeWebhookRepository(tenants);
  const stripe = new NoopStripeApi();
  const service = new StripeBillingService(repository, stripe, TEST_CONFIG);
  return { service, repository };
}

function makeTenantRow(overrides: Partial<TenantBillingRow> = {}): TenantBillingRow {
  const base: TenantBillingRow = {
    id: TENANT_ID,
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

function makeSubscriptionEvent(
  type:
    | 'customer.subscription.created'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted',
  input: {
    id: string;
    customerId: string;
    priceId: string;
    status: Stripe.Subscription.Status;
    tenantMetadata: string | null;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: number;
    stripeEventId?: string;
  },
): Stripe.Event {
  const subscription = {
    id: input.id,
    object: 'subscription',
    customer: input.customerId,
    status: input.status,
    cancel_at_period_end: Boolean(input.cancelAtPeriodEnd),
    current_period_end: input.currentPeriodEnd ?? null,
    metadata: input.tenantMetadata ? { tenant_id: input.tenantMetadata } : {},
    items: {
      data: [
        {
          id: 'si_test',
          price: { id: input.priceId },
          current_period_end: input.currentPeriodEnd ?? null,
        },
      ],
    },
  } as unknown as Stripe.Subscription;

  return {
    id: input.stripeEventId ?? `evt_${input.id}`,
    object: 'event',
    type,
    data: { object: subscription as unknown as Stripe.Event['data']['object'] },
  } as unknown as Stripe.Event;
}

function makeInvoiceEvent(
  type: 'invoice.paid' | 'invoice.payment_failed',
  input: {
    id: string;
    customerId: string;
    subscriptionId: string;
    amountPaid?: number;
    amountDue?: number;
    currency: string;
    number?: string;
    created: number;
  },
): Stripe.Event {
  const invoice = {
    id: input.id,
    object: 'invoice',
    customer: input.customerId,
    subscription: input.subscriptionId,
    amount_paid: input.amountPaid ?? 0,
    amount_due: input.amountDue ?? 0,
    currency: input.currency,
    number: input.number ?? null,
    created: input.created,
    metadata: { tenant_id: TENANT_ID },
  } as unknown as Stripe.Invoice;

  return {
    id: `evt_${input.id}`,
    object: 'event',
    type,
    data: { object: invoice as unknown as Stripe.Event['data']['object'] },
  } as unknown as Stripe.Event;
}

class FakeWebhookRepository implements StripeBillingRepository {
  tenantUpdates: Array<{ tenantId: string; stripeCustomerId: string }> = [];
  subscriptionUpdates: Array<Parameters<StripeBillingRepository['updateTenantSubscription']>[0]> =
    [];
  billingEvents: Array<Parameters<StripeBillingRepository['recordBillingEvent']>[0]> = [];
  invoices: Array<Parameters<StripeBillingRepository['upsertInvoice']>[0]> = [];
  webhookEventsByKey = new Map<string, string>();
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
  }

  async updateTenantSubscription(
    input: Parameters<StripeBillingRepository['updateTenantSubscription']>[0],
  ): Promise<void> {
    this.subscriptionUpdates.push(input);
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
    if (this.webhookEventsByKey.has(input.idempotencyKey)) {
      return {
        eventId: this.webhookEventsByKey.get(input.idempotencyKey) as string,
        alreadyProcessed: true,
      };
    }

    const eventId = `wh_${input.externalId}`;
    this.webhookEventsByKey.set(input.idempotencyKey, eventId);
    return { eventId, alreadyProcessed: false };
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

class NoopStripeApi implements StripeApi {
  async createCustomer(): Promise<Stripe.Customer> {
    throw new Error('Stripe API should not be called from webhook handler');
  }

  async createCheckoutSession(): Promise<Stripe.Checkout.Session> {
    throw new Error('Stripe API should not be called from webhook handler');
  }

  async createBillingPortalSession(): Promise<Stripe.BillingPortal.Session> {
    throw new Error('Stripe API should not be called from webhook handler');
  }
}
