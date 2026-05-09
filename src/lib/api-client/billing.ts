// Fatto da Claude Code il 27 aprile 2026.
//
// Client tipizzato per /api/billing/*. Schemi Zod allineati a
// `src/server/billing/stripe-billing.ts`.

import { z } from 'zod';

import { apiFetch } from './fetch';

const BillingPlanSchema = z.enum(['trial', 'starter', 'professional', 'agency']);
const BillingTenantStatusSchema = z.enum(['active', 'expired', 'suspended', 'cancelled']);
const CheckoutPlanSchema = z.enum(['starter', 'professional']);

export const BillingStatusSchema = z.object({
  plan: BillingPlanSchema,
  status: BillingTenantStatusSchema,
  trialEndsAt: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  subscriptionStatus: z.string().nullable(),
  hasStripeCustomer: z.boolean(),
  hasActiveSubscription: z.boolean(),
  canCheckout: z.boolean(),
  canManageBilling: z.boolean(),
  availablePlans: z.array(CheckoutPlanSchema),
});

export type BillingStatus = z.infer<typeof BillingStatusSchema>;
export type CheckoutPlan = z.infer<typeof CheckoutPlanSchema>;
export type BillingPlan = z.infer<typeof BillingPlanSchema>;
export type BillingTenantStatus = z.infer<typeof BillingTenantStatusSchema>;

export const CheckoutSessionResultSchema = z.object({
  url: z.string().url(),
});

export type CheckoutSessionResult = z.infer<typeof CheckoutSessionResultSchema>;

export const BillingPortalResultSchema = z.object({
  url: z.string().url(),
});

export type BillingPortalResult = z.infer<typeof BillingPortalResultSchema>;

export type BillingClient = {
  getStatus(options?: { signal?: AbortSignal }): Promise<BillingStatus>;
  createCheckoutSession(input: {
    plan: CheckoutPlan;
    signal?: AbortSignal;
  }): Promise<CheckoutSessionResult>;
  createPortalSession(options?: { signal?: AbortSignal }): Promise<BillingPortalResult>;
};

export function createBillingClient(input?: { baseUrl?: string }): BillingClient {
  const baseUrl = input?.baseUrl ?? '';

  return {
    getStatus({ signal } = {}) {
      return apiFetch('/api/billing/status', {
        schema: BillingStatusSchema,
        baseUrl,
        ...(signal !== undefined ? { signal } : {}),
      });
    },
    createCheckoutSession({ plan, signal }) {
      return apiFetch('/api/billing/checkout', {
        schema: CheckoutSessionResultSchema,
        method: 'POST',
        body: { plan },
        baseUrl,
        ...(signal !== undefined ? { signal } : {}),
      });
    },
    createPortalSession({ signal } = {}) {
      return apiFetch('/api/billing/portal', {
        schema: BillingPortalResultSchema,
        method: 'POST',
        baseUrl,
        ...(signal !== undefined ? { signal } : {}),
      });
    },
  };
}
