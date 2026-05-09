import { createHmac, timingSafeEqual } from 'node:crypto';

import { AppError } from '@/lib/errors/app-error';

export type GoogleCalendarOAuthState = {
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin';
  returnTo: string;
  nonce: string;
  issuedAt: number;
};

const maxStateAgeMs = 10 * 60_000;

export function signOAuthState(payload: GoogleCalendarOAuthState, secret: string): string {
  const normalizedSecret = requiredStateSecret(secret);
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', normalizedSecret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthState(input: {
  state: string;
  secret: string;
  now: Date;
}): GoogleCalendarOAuthState {
  const normalizedSecret = requiredStateSecret(input.secret);
  const [encodedPayload, signature] = input.state.split('.');

  if (!encodedPayload || !signature) {
    throw new AppError('bad_request', 'Invalid OAuth state');
  }

  const expected = createHmac('sha256', normalizedSecret)
    .update(encodedPayload)
    .digest('base64url');

  if (!safeEqual(signature, expected)) {
    throw new AppError('bad_request', 'Invalid OAuth state');
  }

  const parsed = parseStatePayload(encodedPayload);

  if (input.now.getTime() - parsed.issuedAt > maxStateAgeMs) {
    throw new AppError('bad_request', 'Expired OAuth state');
  }

  return parsed;
}

export function safeRelativeReturnTo(value: string | null | undefined): string {
  if (!value?.trim()) {
    return '/settings';
  }

  try {
    const parsed = new URL(value, 'http://ambrogio.local');

    if (parsed.origin !== 'http://ambrogio.local') {
      return '/settings';
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/settings';
  }
}

function parseStatePayload(encodedPayload: string): GoogleCalendarOAuthState {
  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<GoogleCalendarOAuthState>;

    if (
      typeof parsed.tenantId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      (parsed.role !== 'owner' && parsed.role !== 'admin') ||
      typeof parsed.returnTo !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.issuedAt !== 'number'
    ) {
      throw new Error('invalid state shape');
    }

    return parsed as GoogleCalendarOAuthState;
  } catch (error) {
    throw new AppError('bad_request', 'Invalid OAuth state payload', {
      cause: error,
      expose: true,
    });
  }
}

function requiredStateSecret(secret: string): string {
  if (!secret.trim()) {
    throw new AppError('internal', 'Google OAuth state secret is not configured', {
      expose: false,
    });
  }

  return secret;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
