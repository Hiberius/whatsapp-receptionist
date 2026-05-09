import { describe, expect, it } from 'vitest';

import {
  buildGoogleCalendarCredentials,
  decryptSecret,
  encryptSecret,
  readCredentialSecret,
} from '@/server/integrations/credential-encryption';

describe('credential encryption', () => {
  it('encrypts and decrypts provider secrets', () => {
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = 'test-secret-with-at-least-32-characters';

    const encrypted = encryptSecret('refresh_token_1');

    expect(encrypted.ciphertext).not.toBe('refresh_token_1');
    expect(decryptSecret(encrypted)).toBe('refresh_token_1');
    expect(readCredentialSecret({ refresh_token_encrypted: encrypted }, 'refresh_token')).toBe(
      'refresh_token_1',
    );
  });

  it('builds encrypted Google Calendar credentials while preserving metadata', () => {
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = 'test-secret-with-at-least-32-characters';

    const credentials = buildGoogleCalendarCredentials({
      accessToken: 'access_1',
      refreshToken: 'refresh_1',
      expiresAt: 1_766_667_200,
      scope: 'calendar.events',
      tokenType: 'Bearer',
      existing: {
        calendar_owner: 'studio@example.com',
      },
    });

    expect(credentials).toMatchObject({
      expires_at: 1_766_667_200,
      scope: 'calendar.events',
      token_type: 'Bearer',
      calendar_owner: 'studio@example.com',
    });
    expect(readCredentialSecret(credentials, 'access_token')).toBe('access_1');
    expect(readCredentialSecret(credentials, 'refresh_token')).toBe('refresh_1');
  });
});
