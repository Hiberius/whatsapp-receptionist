import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

import { AppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';

let cachedClient: ElevenLabsClient | null = null;

export function createElevenLabsClient(): ElevenLabsClient {
  if (!env.ELEVENLABS_API_KEY) {
    throw new AppError('internal', 'ElevenLabs API key is not configured', {
      expose: false,
    });
  }

  cachedClient ??= new ElevenLabsClient({
    apiKey: env.ELEVENLABS_API_KEY,
  });

  return cachedClient;
}
