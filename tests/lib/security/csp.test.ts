import { describe, expect, it } from 'vitest';

import {
  buildContentSecurityPolicy,
  CSP_BYPASS_PATH_PREFIXES,
  CSP_CONNECT_SRC,
  CSP_FRAME_SRC,
  CSP_IMG_SRC,
  CSP_MEDIA_SRC,
  generateNonce,
  shouldBypassCsp,
} from '@/lib/security/csp';

describe('generateNonce', () => {
  it('produces a base64url-safe string with at least 22 characters', () => {
    const nonce = generateNonce();

    // 16 random bytes encode to 22 base64url chars (no padding).
    expect(nonce.length).toBeGreaterThanOrEqual(22);
    // base64url alphabet only.
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns a unique value across many invocations', () => {
    const sample = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      sample.add(generateNonce());
    }
    expect(sample.size).toBe(1000);
  });
});

describe('buildContentSecurityPolicy', () => {
  it('embeds the provided nonce inside the script-src directive', () => {
    const nonce = 'test-nonce-123';
    const csp = buildContentSecurityPolicy(nonce);

    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
  });

  it('declares default-src self and a hardened baseline', () => {
    const csp = buildContentSecurityPolicy('n');

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('whitelists every external API origin in connect-src', () => {
    const csp = buildContentSecurityPolicy('n');
    const connectDirective = csp
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('connect-src '));

    expect(connectDirective).toBeDefined();

    const expectedHosts = [
      'https://api.anthropic.com',
      'https://api.stripe.com',
      'https://*.supabase.co',
      'https://*.elevenlabs.io',
      'https://graph.facebook.com',
      'https://api.upstash.io',
      'https://www.googleapis.com',
    ];
    for (const host of expectedHosts) {
      expect(connectDirective).toContain(host);
    }
  });

  it('allows Stripe inside frame-src', () => {
    const csp = buildContentSecurityPolicy('n');
    expect(csp).toContain('frame-src');
    expect(csp).toContain('https://js.stripe.com');
  });

  it('allows Supabase + Google avatars inside img-src', () => {
    const csp = buildContentSecurityPolicy('n');
    expect(csp).toContain('img-src');
    expect(csp).toContain('https://*.supabase.co');
    expect(csp).toContain('https://lh3.googleusercontent.com');
    expect(csp).toContain('data:');
  });

  it('allows blob: URIs and Supabase inside media-src', () => {
    const csp = buildContentSecurityPolicy('n');
    expect(csp).toMatch(/media-src[^;]*blob:/);
    expect(csp).toMatch(/media-src[^;]*https:\/\/\*\.supabase\.co/);
  });
});

describe('CSP allowlist constants', () => {
  it('keeps connect-src list aligned with the runtime CSP value', () => {
    const csp = buildContentSecurityPolicy('n');
    for (const entry of CSP_CONNECT_SRC) {
      expect(csp).toContain(entry);
    }
  });

  it('keeps frame-src and img-src and media-src constants aligned with runtime CSP', () => {
    const csp = buildContentSecurityPolicy('n');
    for (const entry of CSP_FRAME_SRC) {
      expect(csp).toContain(entry);
    }
    for (const entry of CSP_IMG_SRC) {
      expect(csp).toContain(entry);
    }
    for (const entry of CSP_MEDIA_SRC) {
      expect(csp).toContain(entry);
    }
  });
});

describe('shouldBypassCsp', () => {
  it('returns true for the configured webhook prefixes', () => {
    expect(shouldBypassCsp('/api/webhook/stripe')).toBe(true);
    expect(shouldBypassCsp('/api/webhook/whatsapp')).toBe(true);
    expect(shouldBypassCsp('/api/health')).toBe(true);
  });

  it('returns true for nested paths under bypass prefixes', () => {
    expect(shouldBypassCsp('/api/webhook/stripe/events')).toBe(true);
    expect(shouldBypassCsp('/api/health/ping')).toBe(true);
  });

  it('returns false for normal application routes', () => {
    expect(shouldBypassCsp('/')).toBe(false);
    expect(shouldBypassCsp('/dashboard')).toBe(false);
    expect(shouldBypassCsp('/api/conversations')).toBe(false);
    expect(shouldBypassCsp('/api/whatsapp/opt-outs')).toBe(false);
  });

  it('does not match prefixes that only share a substring', () => {
    expect(shouldBypassCsp('/api/webhook/stripeWAT')).toBe(false);
    expect(shouldBypassCsp('/api/healthcheck')).toBe(false);
  });

  it('exposes its prefixes for external callers', () => {
    expect(CSP_BYPASS_PATH_PREFIXES).toContain('/api/webhook/stripe');
    expect(CSP_BYPASS_PATH_PREFIXES).toContain('/api/webhook/whatsapp');
    expect(CSP_BYPASS_PATH_PREFIXES).toContain('/api/health');
  });
});
