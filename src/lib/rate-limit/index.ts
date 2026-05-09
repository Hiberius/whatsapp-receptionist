import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

import { env } from '@/lib/env';
import { getClientIp } from '@/lib/http/request';
import { assertRateLimit, MemoryRateLimiter } from '@/lib/rate-limit/memory';

const webhookLimiter = new MemoryRateLimiter();
let upstashWebhookLimiter: Ratelimit | null | undefined;

const stripeWebhookLimiter = new MemoryRateLimiter();
let upstashStripeWebhookLimiter: Ratelimit | null | undefined;

export async function enforceWhatsAppWebhookRateLimit(headers: Headers): Promise<void> {
  const ipAddress = getClientIp(headers);
  const upstash = getUpstashWebhookLimiter();

  if (upstash) {
    const result = await upstash.limit(ipAddress);
    assertRateLimit({
      allowed: result.success,
      remaining: result.remaining,
      resetAt: new Date(result.reset),
    });

    return;
  }

  const result = webhookLimiter.check({
    key: `webhook:whatsapp:${ipAddress}`,
    max: env.WHATSAPP_WEBHOOK_RATE_LIMIT_MAX,
    windowMs: env.WHATSAPP_WEBHOOK_RATE_LIMIT_WINDOW_MS,
  });

  assertRateLimit(result);
}

// Fatto da Claude Code il 27 aprile 2026.
export async function enforceStripeWebhookRateLimit(headers: Headers): Promise<void> {
  const ipAddress = getClientIp(headers);
  const upstash = getUpstashStripeWebhookLimiter();

  if (upstash) {
    const result = await upstash.limit(ipAddress);
    assertRateLimit({
      allowed: result.success,
      remaining: result.remaining,
      resetAt: new Date(result.reset),
    });

    return;
  }

  const result = stripeWebhookLimiter.check({
    key: `webhook:stripe:${ipAddress}`,
    max: env.STRIPE_BILLING_RATE_LIMIT_MAX,
    windowMs: env.STRIPE_BILLING_RATE_LIMIT_WINDOW_MS,
  });

  assertRateLimit(result);
}

export function resetInMemoryRateLimitersForTests(): void {
  webhookLimiter.clear();
  upstashWebhookLimiter = undefined;
  stripeWebhookLimiter.clear();
  upstashStripeWebhookLimiter = undefined;
}

function getUpstashWebhookLimiter(): Ratelimit | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (upstashWebhookLimiter !== undefined) {
    return upstashWebhookLimiter;
  }

  upstashWebhookLimiter = new Ratelimit({
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(
      env.WHATSAPP_WEBHOOK_RATE_LIMIT_MAX,
      `${Math.ceil(env.WHATSAPP_WEBHOOK_RATE_LIMIT_WINDOW_MS / 1000)} s`,
    ),
    prefix: 'ambrogio:ratelimit:whatsapp-webhook',
  });

  return upstashWebhookLimiter;
}

function getUpstashStripeWebhookLimiter(): Ratelimit | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (upstashStripeWebhookLimiter !== undefined) {
    return upstashStripeWebhookLimiter;
  }

  upstashStripeWebhookLimiter = new Ratelimit({
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(
      env.STRIPE_BILLING_RATE_LIMIT_MAX,
      `${Math.ceil(env.STRIPE_BILLING_RATE_LIMIT_WINDOW_MS / 1000)} s`,
    ),
    prefix: 'ambrogio:ratelimit:stripe-webhook',
  });

  return upstashStripeWebhookLimiter;
}
