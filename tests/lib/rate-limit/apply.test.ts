import { afterEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { applyRateLimit, resetRateLimitCachesForTests } from '@/lib/rate-limit/apply';
import { RATE_LIMIT_POLICIES } from '@/lib/rate-limit/policies';

describe('applyRateLimit', () => {
  afterEach(() => {
    resetRateLimitCachesForTests();
  });

  it('exposes named policies with positive window and limit', () => {
    for (const [name, policy] of Object.entries(RATE_LIMIT_POLICIES)) {
      expect(policy.window, `policy ${name} window must be > 0`).toBeGreaterThan(0);
      expect(policy.limit, `policy ${name} limit must be > 0`).toBeGreaterThan(0);
    }
  });

  it('allows up to `limit` requests for a given identifier and denies the next one', async () => {
    // settingsWrite: 30 / minuto. Usiamo 30 chiamate consentite + 1 negata.
    const policyKey = 'settingsWrite';
    const identifier = { kind: 'tenantId', value: 'tenant-A' } as const;
    const { limit } = RATE_LIMIT_POLICIES[policyKey];

    for (let i = 0; i < limit; i += 1) {
      const decision = await applyRateLimit(policyKey, identifier);
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(limit - (i + 1));
    }

    await expect(applyRateLimit(policyKey, identifier)).rejects.toBeInstanceOf(AppError);
    await expect(applyRateLimit(policyKey, identifier)).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
    });
  });

  it('isolates buckets by identifier kind+value (separate limits for different tenants)', async () => {
    const policyKey = 'settingsWrite';
    const { limit } = RATE_LIMIT_POLICIES[policyKey];

    for (let i = 0; i < limit; i += 1) {
      await applyRateLimit(policyKey, { kind: 'tenantId', value: 'tenant-X' });
    }

    // Tenant Y deve essere indipendente: la prima richiesta passa.
    const decisionY = await applyRateLimit(policyKey, { kind: 'tenantId', value: 'tenant-Y' });
    expect(decisionY.allowed).toBe(true);
    expect(decisionY.remaining).toBe(limit - 1);
  });

  it('isolates buckets by policy (different policies are independent)', async () => {
    // Esauriamo la policy onboarding per user-1.
    const onboardingLimit = RATE_LIMIT_POLICIES.onboarding.limit;
    for (let i = 0; i < onboardingLimit; i += 1) {
      await applyRateLimit('onboarding', { kind: 'userId', value: 'user-1' });
    }

    // settingsWrite per lo stesso identifier (tenantId) deve restare libero.
    const decision = await applyRateLimit('settingsWrite', {
      kind: 'tenantId',
      value: 'user-1',
    });
    expect(decision.allowed).toBe(true);
  });

  it('isolates buckets by identifier kind even for the same value', async () => {
    const policyKey = 'settingsWrite';
    const { limit } = RATE_LIMIT_POLICIES[policyKey];

    // Esauriamo per tenantId='shared'.
    for (let i = 0; i < limit; i += 1) {
      await applyRateLimit(policyKey, { kind: 'tenantId', value: 'shared' });
    }

    // userId='shared' deve essere una bucket diversa.
    const decision = await applyRateLimit(policyKey, { kind: 'userId', value: 'shared' });
    expect(decision.allowed).toBe(true);
  });

  it('returns retryAfter >= 0 in the AppError on denial', async () => {
    const policyKey = 'gdprExport'; // limit=1, una chiamata satura.
    await applyRateLimit(policyKey, { kind: 'userId', value: 'user-export' });

    try {
      await applyRateLimit(policyKey, { kind: 'userId', value: 'user-export' });
      expect.fail('expected applyRateLimit to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe('rate_limited');
      expect(appError.status).toBe(429);
      expect(appError.expose).toBe(true);
      expect(appError.message).toMatch(/Retry after \d+s/);
    }
  });
});
