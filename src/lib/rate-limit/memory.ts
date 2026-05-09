import { AppError } from '@/lib/errors/app-error';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export type RateLimitOptions = {
  key: string;
  max: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  check(options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    const current = this.buckets.get(options.key);
    const bucket =
      current && current.resetAt > now ? current : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    this.buckets.set(options.key, bucket);

    const remaining = Math.max(options.max - bucket.count, 0);

    return {
      allowed: bucket.count <= options.max,
      remaining,
      resetAt: new Date(bucket.resetAt),
    };
  }

  clear(): void {
    this.buckets.clear();
  }
}

export function assertRateLimit(result: RateLimitResult): void {
  if (!result.allowed) {
    throw new AppError('rate_limited', 'Rate limit exceeded');
  }
}
