import { describe, expect, it } from 'vitest';

import { parseEnv } from '@/lib/env';

describe('parseEnv', () => {
  it('keeps Anthropic model IDs unset unless configured', () => {
    const parsed = parseEnv({ NODE_ENV: 'test' });

    expect(parsed.ANTHROPIC_MODEL_PRIMARY).toBe('');
    expect(parsed.ANTHROPIC_MODEL_FAST).toBe('');
  });

  it('keeps AI auto-reply disabled unless explicitly enabled', () => {
    expect(parseEnv({ NODE_ENV: 'test' }).AMBROGIO_AI_AUTOREPLY_ENABLED).toBe(false);
    expect(
      parseEnv({
        NODE_ENV: 'test',
        AMBROGIO_AI_AUTOREPLY_ENABLED: 'true',
      }).AMBROGIO_AI_AUTOREPLY_ENABLED,
    ).toBe(true);
  });

  it('validates the voice transcript confidence threshold', () => {
    expect(parseEnv({ NODE_ENV: 'test' }).AMBROGIO_VOICE_STT_MIN_CONFIDENCE).toBe(0.55);
    expect(
      parseEnv({
        NODE_ENV: 'test',
        AMBROGIO_VOICE_STT_MIN_CONFIDENCE: '0.8',
      }).AMBROGIO_VOICE_STT_MIN_CONFIDENCE,
    ).toBe(0.8);
  });

  it('sets Google OAuth token endpoint default for Calendar sync', () => {
    const parsed = parseEnv({ NODE_ENV: 'test' });

    expect(parsed.GOOGLE_OAUTH_AUTH_URL).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(parsed.GOOGLE_OAUTH_TOKEN_URL).toBe('https://oauth2.googleapis.com/token');
    expect(parsed.GOOGLE_OAUTH_REVOKE_URL).toBe('https://oauth2.googleapis.com/revoke');
  });
});
