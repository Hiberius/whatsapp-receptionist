import { describe, expect, it } from 'vitest';

import { parseEnv } from '@/lib/env';

describe('ElevenLabs env defaults', () => {
  it('uses Scribe v2 and Flash v2.5 by default', () => {
    const parsed = parseEnv({ NODE_ENV: 'test' });

    expect(parsed.ELEVENLABS_STT_MODEL).toBe('scribe_v2');
    expect(parsed.ELEVENLABS_TTS_MODEL).toBe('eleven_flash_v2_5');
    expect(parsed.ELEVENLABS_ENABLE_LOGGING).toBe(false);
  });
});
