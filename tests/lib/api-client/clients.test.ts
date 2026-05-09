// Fatto da Claude Code il 27 aprile 2026.
//
// Test dei client per dominio (billing, usage, conversations) e dei loro
// schemi Zod: parsing di response valide e respinta delle invalide.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import {
  BillingPortalResultSchema,
  BillingStatusSchema,
  CheckoutSessionResultSchema,
  SendOperatorMessageResultSchema,
  UsageSnapshotSchema,
  createBillingClient,
  createConversationsClient,
  createUsageClient,
} from '@/lib/api-client';

beforeEach(() => {
  vi.spyOn(global, 'fetch');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('billing client', () => {
  it('parses /api/billing/status', async () => {
    const status = {
      plan: 'trial',
      status: 'active',
      trialEndsAt: '2026-05-10T12:00:00.000Z',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      subscriptionStatus: null,
      hasStripeCustomer: false,
      hasActiveSubscription: false,
      canCheckout: true,
      canManageBilling: false,
      availablePlans: ['starter', 'professional'],
    };
    mockJsonResponse({ ok: true, data: status });

    const result = await createBillingClient().getStatus();

    expect(BillingStatusSchema.parse(status)).toEqual(status);
    expect(result).toEqual(status);
  });

  it('sends checkout body with the requested plan', async () => {
    mockJsonResponse({
      ok: true,
      data: { url: 'https://checkout.stripe.com/c/pay/cs_test' },
    });

    const result = await createBillingClient().createCheckoutSession({
      plan: 'professional',
    });

    expect(result.url).toMatch(/^https:\/\//);
    const fetchSpy = vi.mocked(global.fetch);
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ plan: 'professional' }));
  });

  it('parses /api/billing/portal', async () => {
    mockJsonResponse({
      ok: true,
      data: { url: 'https://billing.stripe.com/p/session/test' },
    });

    const result = await createBillingClient().createPortalSession();

    expect(BillingPortalResultSchema.parse(result)).toEqual(result);
  });

  it('rejects an invalid checkout result payload', async () => {
    mockJsonResponse({
      ok: true,
      data: { url: 'not-a-url' },
    });

    await expect(
      createBillingClient().createCheckoutSession({ plan: 'starter' }),
    ).rejects.toMatchObject({ code: 'invalid_response' });

    expect(() => CheckoutSessionResultSchema.parse({ url: 'not-a-url' })).toThrow();
  });
});

describe('usage client', () => {
  it('parses /api/usage/status', async () => {
    const snapshot = {
      plan: 'starter',
      metricMonth: '2026-04-01',
      conversations: {
        used: 412,
        limit: 500,
        percent: 82,
        exceeded: false,
        warning: true,
      },
      voiceMessages: {
        used: 75,
        limit: 200,
        percent: 38,
        exceeded: false,
        warning: false,
      },
      messages: { used: 1840 },
      aiCostCents: { used: 1430 },
      autoReplyAllowed: true,
      blockReason: null,
      softWarning: true,
    };
    mockJsonResponse({ ok: true, data: snapshot });

    const result = await createUsageClient().getStatus();

    expect(UsageSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(result).toEqual(snapshot);
  });
});

describe('conversations client', () => {
  it('encodes the conversation id and posts content', async () => {
    mockJsonResponse({
      ok: true,
      data: {
        messageId: 'msg_1',
        externalId: 'manual:abc',
        conversationId: 'conv 1/2',
        enqueuedJobId: 'job_1',
        customerServiceWindowExpiresAt: '2026-04-28T12:00:00.000Z',
      },
    });

    const result = await createConversationsClient().sendOperatorMessage({
      conversationId: 'conv 1/2',
      content: 'Ciao',
    });

    expect(SendOperatorMessageResultSchema.parse(result)).toEqual(result);
    const url = vi.mocked(global.fetch).mock.calls[0]?.[0];
    expect(url).toBe('/api/conversations/conv%201%2F2/messages');
  });

  it('rejects empty content before calling fetch', () => {
    // Lo schema invalida il body sincronamente prima che fetch parta.
    expect(() =>
      createConversationsClient().sendOperatorMessage({
        conversationId: 'conv_1',
        content: '',
      }),
    ).toThrow();
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });
});

function mockJsonResponse(payload: unknown): void {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}
