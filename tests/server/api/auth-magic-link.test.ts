// Fatto da Claude Code l'8 maggio 2026.
// Test del route POST /api/auth/magic-link.

import { type NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRateLimitCachesForTests } from '@/lib/rate-limit/apply';
import { RATE_LIMIT_POLICIES } from '@/lib/rate-limit/policies';

import type * as MagicLinkModule from '@/server/auth/magic-link';

const requestMock = vi.fn(async () => ({ ok: true as const }));

vi.mock('@/server/auth/magic-link', async () => {
  const actual = await vi.importActual<typeof MagicLinkModule>('@/server/auth/magic-link');

  return {
    ...actual,
    createMagicLinkService: vi.fn(() => ({
      request: requestMock,
    })),
  };
});

describe('POST /api/auth/magic-link', () => {
  beforeEach(() => {
    resetRateLimitCachesForTests();
    requestMock.mockClear();
  });

  afterEach(() => {
    resetRateLimitCachesForTests();
  });

  it('happy path: dispatches magic link and returns ok shape', async () => {
    const { POST } = await import('@/app/api/auth/magic-link/route');

    const response = await POST(buildRequest({ email: 'mario@example.it' }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { ok: boolean; data: { sent: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.sent).toBe(true);
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'mario@example.it' }),
    );
  });

  it('returns 429 once authMagicLink policy is exhausted', async () => {
    const { POST } = await import('@/app/api/auth/magic-link/route');
    const { limit } = RATE_LIMIT_POLICIES.authMagicLink;
    const email = 'flood@example.it';

    for (let attempt = 1; attempt <= limit; attempt += 1) {
      const response = await POST(buildRequest({ email }));
      expect(response.status, `attempt ${attempt} should pass`).toBe(200);
    }

    const blocked = await POST(buildRequest({ email }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toMatch(/^\d+$/);
  });

  it('rejects an obviously invalid Zod shape with 400', async () => {
    const { POST } = await import('@/app/api/auth/magic-link/route');

    const response = await POST(
      buildRequest({ overrideBody: { email: 'a' } }), // troppo corta -> Zod min(3) fail
    );
    expect(response.status).toBe(400);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('returns same ok shape regardless of email existence (anti-enumeration)', async () => {
    const { POST } = await import('@/app/api/auth/magic-link/route');

    requestMock.mockResolvedValueOnce({ ok: true });
    const knownResponse = await POST(buildRequest({ email: 'known@example.it' }));
    const knownBody = (await knownResponse.json()) as { ok: boolean; data: { sent: boolean } };

    requestMock.mockResolvedValueOnce({ ok: true });
    const unknownResponse = await POST(buildRequest({ email: 'ghost@example.it' }));
    const unknownBody = (await unknownResponse.json()) as { ok: boolean; data: { sent: boolean } };

    expect(knownResponse.status).toBe(unknownResponse.status);
    expect(knownBody).toEqual(unknownBody);
  });
});

type BuildRequestOptions = {
  email?: string;
  overrideBody?: Record<string, unknown>;
};

function buildRequest({ email, overrideBody }: BuildRequestOptions = {}): NextRequest {
  const body = overrideBody ?? { email: email ?? 'mario@example.it' };

  const request = new Request('https://app.ambrogio.test/api/auth/magic-link', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'Vitest',
    },
    body: JSON.stringify(body),
  });

  return request as NextRequest;
}
