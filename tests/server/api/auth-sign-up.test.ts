// Fatto da Claude Code l'8 maggio 2026.
// Test del route POST /api/auth/sign-up.

import { type NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { resetRateLimitCachesForTests } from '@/lib/rate-limit/apply';

import type * as SignUpModule from '@/server/auth/sign-up';

const signUpMock = vi.fn(async () => ({ tenantId: 'tenant_001' }));

vi.mock('@/server/auth/sign-up', async () => {
  const actual = await vi.importActual<typeof SignUpModule>('@/server/auth/sign-up');
  return {
    ...actual,
    createSignUpService: vi.fn(() => ({
      signUp: signUpMock,
    })),
  };
});

describe('POST /api/auth/sign-up', () => {
  beforeEach(() => {
    resetRateLimitCachesForTests();
    signUpMock.mockClear();
  });

  afterEach(() => {
    resetRateLimitCachesForTests();
  });

  it('happy path: creates pending tenant and returns tenantId', async () => {
    const { POST } = await import('@/app/api/auth/sign-up/route');

    const response = await POST(buildRequest());
    expect(response.status).toBe(200);

    const body = (await response.json()) as { ok: boolean; data: { tenantId: string } };
    expect(body.ok).toBe(true);
    expect(body.data.tenantId).toBe('tenant_001');
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Studio Test',
        email: 'mario@example.it',
        vertical: 'dental',
      }),
    );
  });

  it('rejects invalid vertical with 400', async () => {
    const { POST } = await import('@/app/api/auth/sign-up/route');

    const response = await POST(
      buildRequest({
        bodyOverride: {
          business_name: 'Studio Test',
          email: 'mario@example.it',
          vertical: 'unknown-vertical',
        },
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('bad_request');
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('returns 409 when service reports a duplicate email', async () => {
    signUpMock.mockRejectedValueOnce(
      new AppError('conflict', 'A tenant with this email already exists', { expose: true }),
    );

    const { POST } = await import('@/app/api/auth/sign-up/route');
    const response = await POST(buildRequest());

    expect(response.status).toBe(409);
    const body = (await response.json()) as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('conflict');
  });
});

type BuildRequestOptions = {
  bodyOverride?: Record<string, unknown>;
};

function buildRequest({ bodyOverride }: BuildRequestOptions = {}): NextRequest {
  const body = bodyOverride ?? {
    business_name: 'Studio Test',
    email: 'mario@example.it',
    vertical: 'dental',
  };

  const request = new Request('https://app.ambrogio.test/api/auth/sign-up', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.50',
      'user-agent': 'Vitest',
    },
    body: JSON.stringify(body),
  });

  return request as NextRequest;
}
