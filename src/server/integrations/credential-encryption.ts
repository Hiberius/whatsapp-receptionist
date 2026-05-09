import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';

export type EncryptedSecret = {
  alg: 'aes-256-gcm';
  iv: string;
  ciphertext: string;
  tag: string;
  keyVersion: 'v1';
};

const algorithm = 'aes-256-gcm';
const encryptedSecretKeys = new Set(['alg', 'iv', 'ciphertext', 'tag', 'keyVersion']);

export function encryptSecret(value: string): EncryptedSecret {
  const key = credentialEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

  return {
    alg: algorithm,
    iv: iv.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    keyVersion: 'v1',
  };
}

export function decryptSecret(value: unknown): string | null {
  if (!isEncryptedSecret(value)) {
    return null;
  }

  const decipher = createDecipheriv(
    algorithm,
    credentialEncryptionKey(),
    Buffer.from(value.iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(value.tag, 'base64url'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64url')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

export function readCredentialSecret(
  credentials: Record<string, unknown>,
  key: string,
): string | null {
  const plain = credentials[key];

  if (typeof plain === 'string' && plain.trim()) {
    return plain.trim();
  }

  return decryptSecret(credentials[`${key}_encrypted`] ?? credentials[key]);
}

export function buildGoogleCalendarCredentials(input: {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number | null;
  scope?: string | null;
  tokenType?: string | null;
  existing?: Record<string, unknown>;
}): Record<string, unknown> {
  const existing = input.existing ?? {};
  const refreshToken =
    input.refreshToken?.trim() || readCredentialSecret(existing, 'refresh_token');

  if (!refreshToken) {
    throw new AppError('upstream_error', 'Google OAuth did not return a refresh token', {
      expose: false,
    });
  }

  return removeUndefined({
    ...preserveNonSecretCredentialMetadata(existing),
    access_token_encrypted: encryptSecret(input.accessToken),
    refresh_token_encrypted: encryptSecret(refreshToken),
    expires_at: input.expiresAt ?? null,
    scope: input.scope ?? stringOrNull(existing.scope),
    token_type: input.tokenType ?? stringOrNull(existing.token_type),
    encrypted_at: new Date().toISOString(),
  });
}

export function encryptedCredentialPatch(input: {
  accessToken: string;
  expiresAt?: number | null;
  scope?: string | null;
  tokenType?: string | null;
  existing?: Record<string, unknown>;
}): Record<string, unknown> {
  const existing = input.existing ?? {};
  const refreshToken = readCredentialSecret(existing, 'refresh_token');

  return removeUndefined({
    ...preserveNonSecretCredentialMetadata(existing),
    access_token_encrypted: encryptSecret(input.accessToken),
    refresh_token_encrypted: refreshToken
      ? encryptSecret(refreshToken)
      : existing.refresh_token_encrypted,
    expires_at: input.expiresAt ?? null,
    scope: input.scope ?? stringOrNull(existing.scope),
    token_type: input.tokenType ?? stringOrNull(existing.token_type),
    encrypted_at: new Date().toISOString(),
  });
}

function preserveNonSecretCredentialMetadata(
  credentials: Record<string, unknown>,
): Record<string, unknown> {
  const preserved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(credentials)) {
    if (key === 'access_token' || key === 'refresh_token') {
      continue;
    }

    if (key === 'access_token_encrypted' || key === 'refresh_token_encrypted') {
      continue;
    }

    preserved[key] = value;
  }

  return preserved;
}

function credentialEncryptionKey(): Buffer {
  const secret = (
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY ?? env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY
  ).trim();

  if (!secret) {
    throw new AppError('internal', 'Integration credentials encryption key is not configured', {
      expose: false,
    });
  }

  return createHash('sha256').update(secret).digest();
}

function isEncryptedSecret(value: unknown): value is EncryptedSecret {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<EncryptedSecret>;

  return (
    candidate.alg === algorithm &&
    candidate.keyVersion === 'v1' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.ciphertext === 'string' &&
    typeof candidate.tag === 'string' &&
    Object.keys(candidate).every((key) => encryptedSecretKeys.has(key))
  );
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function removeUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
