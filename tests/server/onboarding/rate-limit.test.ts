import { type NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '@/lib/auth/session';
import { resetRateLimitCachesForTests } from '@/lib/rate-limit/apply';
import { RATE_LIMIT_POLICIES } from '@/lib/rate-limit/policies';

// Mock dell'auth: l'utente e' sempre lo stesso, cosi' la chiave e' stabile.
vi.mock('@/lib/auth/session', () => {
  const user: AuthenticatedUser = {
    userId: '00000000-0000-4000-8000-0000000000aa',
    email: 'rate-limited@example.it',
    appMetadata: { provider: 'email' },
    userMetadata: {},
  };

  return {
    requireAuthenticatedUser: vi.fn(async () => user),
    requireSession: vi.fn(),
  };
});

// Mock del servizio di onboarding: rispondiamo sempre OK senza toccare DB.
vi.mock('@/server/onboarding/tenant-onboarding', () => {
  return {
    createTenantOnboardingService: vi.fn(() => ({
      complete: vi.fn(async () => ({
        onboarded: true,
        role: 'owner' as const,
        tenant: {
          id: '00000000-0000-4000-8000-0000000000bb',
          slug: 'studio-rate-limit',
          name: 'Studio Rate Limit',
          trialEndsAt: '2026-05-22T00:00:00.000Z',
        },
      })),
      getStatus: vi.fn(),
    })),
  };
});

describe('POST /api/onboarding/tenant rate limit', () => {
  beforeEach(() => {
    resetRateLimitCachesForTests();
  });

  afterEach(() => {
    resetRateLimitCachesForTests();
  });

  it('returns 429 once the onboarding policy limit is exceeded', async () => {
    const { POST } = await import('@/app/api/onboarding/tenant/route');
    const policyLimit = RATE_LIMIT_POLICIES.onboarding.limit;

    // Le prime `limit` chiamate (10) devono passare con 200.
    for (let attempt = 1; attempt <= policyLimit; attempt += 1) {
      const response = await POST(buildRequest());
      expect(response.status, `attempt ${attempt} should succeed`).toBe(200);
    }

    // L'11a chiamata deve essere bloccata con 429.
    const blocked = await POST(buildRequest());
    expect(blocked.status).toBe(429);

    const body = (await blocked.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('rate_limited');
  });
});

function buildRequest(): NextRequest {
  const request = new Request('https://app.ambrogio.test/api/onboarding/tenant', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.42',
    },
    body: JSON.stringify({
      tenantName: 'Studio Rate Limit',
    }),
  });

  // Il route handler usa solo la superficie comune di Request; in test e' sufficiente
  // un cast verso NextRequest senza istanziare l'edge runtime di Next.
  return request as NextRequest;
}
