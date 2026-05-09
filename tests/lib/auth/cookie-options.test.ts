import { describe, expect, it } from 'vitest';

import { getSecureCookieOptions, getSecureCookieOptionsForEnv } from '@/lib/auth/cookie-options';

describe('getSecureCookieOptions', () => {
  it('returns httpOnly + sameSite=lax + path=/ defaults', () => {
    const options = getSecureCookieOptions();

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
  });

  it('does not set a domain by default (browser uses request host)', () => {
    const options = getSecureCookieOptions();

    expect(options.domain).toBeUndefined();
  });

  it('exposes a `secure` flag (boolean) tied to NODE_ENV', () => {
    const options = getSecureCookieOptions();

    // In test/dev runtime, secure=false; in prod runtime, secure=true.
    // Qui verifichiamo solo che il campo sia presente e booleano.
    expect(typeof options.secure).toBe('boolean');
  });

  it('honors caller overrides for non-security fields (maxAge, expires, path)', () => {
    const expires = new Date('2026-12-31T00:00:00.000Z');
    const options = getSecureCookieOptions({
      maxAge: 0,
      expires,
      path: '/custom',
    });

    expect(options.maxAge).toBe(0);
    expect(options.expires).toBe(expires);
    expect(options.path).toBe('/custom');
    // I default di sicurezza restano in piedi.
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
  });
});

describe('getSecureCookieOptionsForEnv', () => {
  it('sets secure=true when NODE_ENV is production', () => {
    const options = getSecureCookieOptionsForEnv('production');

    expect(options.secure).toBe(true);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
  });

  it('sets secure=false in development to allow HTTP localhost', () => {
    const options = getSecureCookieOptionsForEnv('development');

    expect(options.secure).toBe(false);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
  });

  it('sets secure=false in test runtime', () => {
    const options = getSecureCookieOptionsForEnv('test');

    expect(options.secure).toBe(false);
    expect(options.httpOnly).toBe(true);
  });

  it('sets secure=false for any non-production NODE_ENV (staging, preview)', () => {
    expect(getSecureCookieOptionsForEnv('staging').secure).toBe(false);
    expect(getSecureCookieOptionsForEnv('preview').secure).toBe(false);
    expect(getSecureCookieOptionsForEnv('').secure).toBe(false);
  });

  it('does not leak a default domain attribute even with explicit nodeEnv', () => {
    const prod = getSecureCookieOptionsForEnv('production');
    const dev = getSecureCookieOptionsForEnv('development');

    expect(prod.domain).toBeUndefined();
    expect(dev.domain).toBeUndefined();
  });

  it('lets caller-provided overrides win over defaults (e.g. logout maxAge=0)', () => {
    const options = getSecureCookieOptionsForEnv('production', {
      maxAge: 0,
      sameSite: 'strict',
    });

    expect(options.maxAge).toBe(0);
    expect(options.sameSite).toBe('strict');
    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
  });
});
