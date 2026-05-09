import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import { MemoryRateLimiter, type RateLimitResult } from '@/lib/rate-limit/memory';
import {
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy,
  type RateLimitPolicyKey,
} from '@/lib/rate-limit/policies';

/**
 * Esito decisionale ritornato dal helper, utile a chi vuole leggere
 * la decisione invece di affidarsi solo all'eccezione su denial.
 */
export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  /** Secondi prima del prossimo tentativo consentito (>=0). */
  retryAfter: number;
};

/**
 * Identificatore della richiesta da rate-limitare.
 *
 * Si distinguono diversi `kind` per evitare collisioni di chiave
 * tra utenti diversi che condividono la stessa policy.
 */
export type RateLimitIdentifier =
  | { kind: 'ip'; value: string }
  | { kind: 'userId'; value: string }
  | { kind: 'tenantId'; value: string }
  | { kind: 'email'; value: string }
  | { kind: 'custom'; value: string };

/**
 * Cache per gli istanze Upstash riusabili (una per policy).
 *
 * `null` significa "Upstash non configurato in env" (fallback memoria),
 * `undefined` significa "non ancora valutato".
 */
const upstashLimiterByPolicy = new Map<RateLimitPolicyKey, Ratelimit | null>();
const memoryLimiterByPolicy = new Map<RateLimitPolicyKey, MemoryRateLimiter>();

/**
 * Verifica se la richiesta puo' procedere secondo la policy specificata.
 *
 * In caso di rifiuto lancia `AppError('rate_limited')` con `expose: true`,
 * cosi' la response API restituisce 429 con messaggio mostrabile e l'header
 * `Retry-After` puo' essere derivato da `retryAfter`.
 *
 * @param policyKey  Chiave nominata definita in `RATE_LIMIT_POLICIES`.
 * @param identifier Identificatore della richiesta (ip, userId, tenantId, email o custom).
 * @returns Decisione strutturata in caso di richiesta consentita.
 */
export async function applyRateLimit(
  policyKey: RateLimitPolicyKey,
  identifier: RateLimitIdentifier,
): Promise<RateLimitDecision> {
  const policy = RATE_LIMIT_POLICIES[policyKey];
  const key = buildKey(policyKey, identifier);

  const upstash = getUpstashLimiter(policyKey, policy);

  if (upstash) {
    const result = await upstash.limit(key);
    const decision: RateLimitDecision = {
      allowed: result.success,
      remaining: result.remaining,
      retryAfter: secondsUntil(result.reset),
    };

    if (!decision.allowed) {
      throw rateLimitedError(decision);
    }

    return decision;
  }

  const memoryResult = getMemoryLimiter(policyKey).check({
    key,
    max: policy.limit,
    windowMs: policy.window * 1000,
  });

  const decision = toDecision(memoryResult);

  if (!decision.allowed) {
    throw rateLimitedError(decision);
  }

  return decision;
}

/**
 * Reset interno per i test che istanziano piu' policy nello stesso processo.
 */
export function resetRateLimitCachesForTests(): void {
  upstashLimiterByPolicy.clear();
  memoryLimiterByPolicy.clear();
}

function buildKey(policyKey: RateLimitPolicyKey, identifier: RateLimitIdentifier): string {
  return `ambrogio:ratelimit:${policyKey}:${identifier.kind}:${identifier.value}`;
}

function getUpstashLimiter(
  policyKey: RateLimitPolicyKey,
  policy: RateLimitPolicy,
): Ratelimit | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const cached = upstashLimiterByPolicy.get(policyKey);
  if (cached !== undefined) {
    return cached;
  }

  const limiter = new Ratelimit({
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(policy.limit, `${policy.window} s`),
    prefix: `ambrogio:ratelimit:${policyKey}`,
  });

  upstashLimiterByPolicy.set(policyKey, limiter);
  return limiter;
}

function getMemoryLimiter(policyKey: RateLimitPolicyKey): MemoryRateLimiter {
  const existing = memoryLimiterByPolicy.get(policyKey);
  if (existing) {
    return existing;
  }
  const limiter = new MemoryRateLimiter();
  memoryLimiterByPolicy.set(policyKey, limiter);
  return limiter;
}

function toDecision(result: RateLimitResult): RateLimitDecision {
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    retryAfter: secondsUntil(result.resetAt.getTime()),
  };
}

function secondsUntil(epochMs: number): number {
  const diff = Math.ceil((epochMs - Date.now()) / 1000);
  return diff > 0 ? diff : 0;
}

function rateLimitedError(decision: RateLimitDecision): AppError {
  return new AppError('rate_limited', `Rate limit exceeded. Retry after ${decision.retryAfter}s`, {
    expose: true,
    retryAfter: decision.retryAfter,
  });
}
