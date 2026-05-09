import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import {
  signOAuthState,
  verifyOAuthState,
  safeRelativeReturnTo,
  type GoogleCalendarOAuthState,
} from '@/server/integrations/oauth-state';

// Test secret with sufficient entropy (production secret is much longer).
const stateSecret = 'oauth-state-secret-with-enough-entropy';
const issuedAt = new Date('2026-04-25T10:00:00.000Z').getTime();
const now = new Date('2026-04-25T10:05:00.000Z'); // 5 minutes after issue

function buildState(overrides: Partial<GoogleCalendarOAuthState> = {}): GoogleCalendarOAuthState {
  return {
    tenantId: 'tenant_1',
    userId: 'user_1',
    role: 'admin',
    returnTo: '/settings?tab=calendar',
    nonce: 'nonce_abc',
    issuedAt,
    ...overrides,
  };
}

describe('signOAuthState / verifyOAuthState', () => {
  it('round-trips a payload with HMAC signature and returns the parsed state', () => {
    // Arrange
    const payload = buildState();

    // Act
    const token = signOAuthState(payload, stateSecret);
    const parsed = verifyOAuthState({ state: token, secret: stateSecret, now });

    // Assert
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(parsed).toEqual(payload);
  });

  it('rejects a state with malformed structure (missing dot separator)', () => {
    // Arrange
    const malformed = 'thishasonepart';

    // Act + Assert
    expect(() => verifyOAuthState({ state: malformed, secret: stateSecret, now })).toThrowError(
      AppError,
    );
    expect(() => verifyOAuthState({ state: malformed, secret: stateSecret, now })).toThrowError(
      'Invalid OAuth state',
    );
  });

  it('rejects a state when the signature does not match (tampered payload)', () => {
    // Arrange — sign with one secret and verify with another
    const token = signOAuthState(buildState(), stateSecret);
    const tampered = `${token}-extra`;

    // Act + Assert
    expect(() => verifyOAuthState({ state: tampered, secret: stateSecret, now })).toThrowError(
      AppError,
    );
  });

  it('rejects a state signed with a different secret', () => {
    // Arrange
    const token = signOAuthState(buildState(), stateSecret);

    // Act + Assert
    expect(() =>
      verifyOAuthState({ state: token, secret: 'a-different-secret-with-enough-length', now }),
    ).toThrowError('Invalid OAuth state');
  });

  it('throws expired error when the issuedAt is older than the 10-minute window', () => {
    // Arrange — issued 11 minutes before now
    const stale = buildState({
      issuedAt: new Date('2026-04-25T09:54:00.000Z').getTime(),
    });
    const token = signOAuthState(stale, stateSecret);

    // Act + Assert
    expect(() => verifyOAuthState({ state: token, secret: stateSecret, now })).toThrowError(
      'Expired OAuth state',
    );
  });

  it('throws when secret is empty or whitespace', () => {
    // Arrange
    const payload = buildState();

    // Act + Assert — empty
    expect(() => signOAuthState(payload, '')).toThrowError(
      'Google OAuth state secret is not configured',
    );
    // Whitespace only
    expect(() => signOAuthState(payload, '   ')).toThrowError(
      'Google OAuth state secret is not configured',
    );
  });

  it('throws bad_request when payload has wrong shape (e.g. invalid role)', async () => {
    // Arrange — manually craft a token with a structurally valid HMAC but invalid payload
    const badPayload = {
      tenantId: 'tenant_1',
      userId: 'user_1',
      role: 'guest', // not allowed
      returnTo: '/settings',
      nonce: 'n',
      issuedAt,
    };
    const encoded = Buffer.from(JSON.stringify(badPayload)).toString('base64url');
    const { createHmac } = await import('node:crypto');
    const sig = createHmac('sha256', stateSecret).update(encoded).digest('base64url');
    const token = `${encoded}.${sig}`;

    // Act + Assert
    let error: unknown;
    try {
      verifyOAuthState({ state: token, secret: stateSecret, now });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('bad_request');
  });

  it('throws bad_request when payload is not valid JSON', async () => {
    // Arrange — well-formed encoded segment but the decoded content is non-JSON
    const encoded = Buffer.from('not valid json').toString('base64url');
    const { createHmac } = await import('node:crypto');
    const sig = createHmac('sha256', stateSecret).update(encoded).digest('base64url');
    const token = `${encoded}.${sig}`;

    // Act + Assert
    expect(() => verifyOAuthState({ state: token, secret: stateSecret, now })).toThrowError(
      'Invalid OAuth state payload',
    );
  });
});

describe('safeRelativeReturnTo', () => {
  it('returns /settings as default when input is empty/null/undefined/whitespace', () => {
    // Act + Assert
    expect(safeRelativeReturnTo(null)).toBe('/settings');
    expect(safeRelativeReturnTo(undefined)).toBe('/settings');
    expect(safeRelativeReturnTo('')).toBe('/settings');
    expect(safeRelativeReturnTo('   ')).toBe('/settings');
  });

  it('preserves a safe relative path with query and hash', () => {
    // Act + Assert
    expect(safeRelativeReturnTo('/settings?tab=calendar')).toBe('/settings?tab=calendar');
    expect(safeRelativeReturnTo('/dashboard#section')).toBe('/dashboard#section');
    expect(safeRelativeReturnTo('/path?a=1&b=2#h')).toBe('/path?a=1&b=2#h');
  });

  it('rejects absolute URLs pointing to a different origin (open-redirect protection)', () => {
    // Act + Assert
    expect(safeRelativeReturnTo('https://evil.example.com/phish')).toBe('/settings');
    expect(safeRelativeReturnTo('http://malicious.tld/path')).toBe('/settings');
    expect(safeRelativeReturnTo('//evil.example.com/path')).toBe('/settings');
  });

  it('falls back to /settings when input is not a parseable URL', () => {
    // The URL constructor with a base accepts almost everything, but let's ensure
    // pathological strings still produce a safe default.
    expect(safeRelativeReturnTo('http://[invalid')).toBe('/settings');
  });
});
