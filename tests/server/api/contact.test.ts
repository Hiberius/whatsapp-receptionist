// Fatto da Claude Code l'8 maggio 2026.
// Test del route POST /api/contact.

import { type NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRateLimitCachesForTests } from '@/lib/rate-limit/apply';
import { RATE_LIMIT_POLICIES } from '@/lib/rate-limit/policies';

const submitMock = vi.fn(async () => ({ submissionId: 'sub_test_001' }));

vi.mock('@/server/contact/contact-submission', () => ({
  createContactSubmissionService: vi.fn(() => ({
    submit: submitMock,
  })),
}));

describe('POST /api/contact', () => {
  beforeEach(() => {
    resetRateLimitCachesForTests();
    submitMock.mockClear();
  });

  afterEach(() => {
    resetRateLimitCachesForTests();
  });

  it('happy path: persists submission and returns submissionId', async () => {
    const { POST } = await import('@/app/api/contact/route');

    const response = await POST(buildRequest({ ip: '203.0.113.1' }));
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      ok: boolean;
      data: { submissionId: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.submissionId).toBe('sub_test_001');

    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Mario Rossi',
        email: 'mario@example.it',
        topic: 'sales',
        ipAddress: '203.0.113.1',
      }),
    );
  });

  it('rejects when consent is missing', async () => {
    const { POST } = await import('@/app/api/contact/route');

    const response = await POST(
      buildRequest({
        ip: '203.0.113.2',
        bodyOverride: {
          name: 'No Consent',
          email: 'noconsent@example.it',
          topic: 'sales',
          message: 'Ciao',
          consent: false,
        },
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('bad_request');
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid topic with 400', async () => {
    const { POST } = await import('@/app/api/contact/route');

    const response = await POST(
      buildRequest({
        ip: '203.0.113.3',
        bodyOverride: {
          name: 'Bad Topic',
          email: 'badtopic@example.it',
          topic: 'spam',
          message: 'Ciao',
          consent: true,
        },
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('bad_request');
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('returns 429 with Retry-After header once the contactForm policy is exhausted', async () => {
    const { POST } = await import('@/app/api/contact/route');
    const { limit } = RATE_LIMIT_POLICIES.contactForm;
    const ip = '203.0.113.99';

    for (let attempt = 1; attempt <= limit; attempt += 1) {
      const response = await POST(buildRequest({ ip }));
      expect(response.status, `attempt ${attempt} should pass`).toBe(200);
    }

    const blocked = await POST(buildRequest({ ip }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toMatch(/^\d+$/);

    const body = (await blocked.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('rate_limited');
  });
});

type BuildRequestOptions = {
  ip: string;
  bodyOverride?: Record<string, unknown>;
};

function buildRequest({ ip, bodyOverride }: BuildRequestOptions): NextRequest {
  const body = bodyOverride ?? {
    name: 'Mario Rossi',
    email: 'mario@example.it',
    company: 'Studio Rossi',
    topic: 'sales',
    message: 'Vorrei provare Ambrogio nel mio studio dentistico.',
    consent: true,
  };

  const request = new Request('https://app.ambrogio.test/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      'user-agent': 'Vitest',
    },
    body: JSON.stringify(body),
  });

  return request as NextRequest;
}
