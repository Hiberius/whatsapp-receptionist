// Fatto da Claude Code l'8 maggio 2026.
// Verifica che jsonHandler propaghi `Retry-After` nelle risposte 429
// quando l'AppError lanciato porta `retryAfter` (RFC 7231 §7.1.3).

import { describe, expect, it } from 'vitest';

import { jsonHandler } from '@/lib/api/json';
import { AppError } from '@/lib/errors/app-error';

describe('jsonHandler — Retry-After header on 429', () => {
  it('sets Retry-After header when AppError code=rate_limited carries retryAfter', async () => {
    const response = await jsonHandler(() => {
      throw new AppError('rate_limited', 'Too many requests', {
        expose: true,
        retryAfter: 42,
      });
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');

    const body = (await response.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('rate_limited');
  });

  it('does not set Retry-After on non rate_limited errors', async () => {
    const response = await jsonHandler(() => {
      throw new AppError('bad_request', 'Invalid payload', { expose: true });
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('Retry-After')).toBeNull();
  });

  it('does not set Retry-After when rate_limited has no retryAfter value', async () => {
    const response = await jsonHandler(() => {
      throw new AppError('rate_limited', 'Too many requests', { expose: true });
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeNull();
  });
});
