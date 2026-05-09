import { describe, expect, it } from 'vitest';

import { assertRateLimit, MemoryRateLimiter } from '@/lib/rate-limit/memory';

describe('MemoryRateLimiter', () => {
  it('blocks requests after the configured limit', () => {
    const limiter = new MemoryRateLimiter();

    expect(limiter.check({ key: 'a', max: 2, windowMs: 60_000 }).allowed).toBe(true);
    expect(limiter.check({ key: 'a', max: 2, windowMs: 60_000 }).allowed).toBe(true);
    const third = limiter.check({ key: 'a', max: 2, windowMs: 60_000 });

    expect(third.allowed).toBe(false);
    expect(() => assertRateLimit(third)).toThrow('Rate limit exceeded');
  });
});
