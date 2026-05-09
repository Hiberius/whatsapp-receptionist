import { createElevenLabsClient } from '@/lib/elevenlabs/client';
import { env } from '@/lib/env';

export type TranscribeVoiceMessageInput = {
  audio: Blob;
  languageCode?: string;
  keyterms?: string[];
};

export type VoiceTranscript = {
  text: string;
  languageCode?: string;
  languageProbability?: number;
  audioDurationSecs?: number;
};

export type SynthesizeVoiceReplyInput = {
  text: string;
  voiceId?: string;
  languageCode?: string;
};

export type SynthesizedVoiceReply = {
  audio: Uint8Array;
  contentType: 'audio/mpeg';
  modelId: string;
  voiceId: string;
};

export async function transcribeVoiceMessage({
  audio,
  languageCode = 'it',
  keyterms = [],
}: TranscribeVoiceMessageInput): Promise<VoiceTranscript> {
  const client = createElevenLabsClient();
  const response = await client.speechToText.convert({
    file: audio,
    modelId: env.ELEVENLABS_STT_MODEL,
    languageCode,
    noVerbatim: true,
    tagAudioEvents: false,
    keyterms,
  });

  return {
    text: response.text,
    languageCode: response.languageCode,
    languageProbability: response.languageProbability,
    ...(response.audioDurationSecs !== undefined
      ? { audioDurationSecs: response.audioDurationSecs }
      : {}),
  };
}

export async function synthesizeVoiceReply({
  text,
  voiceId = env.ELEVENLABS_DEFAULT_VOICE_ID,
  languageCode = 'it',
}: SynthesizeVoiceReplyInput): Promise<SynthesizedVoiceReply> {
  const client = createElevenLabsClient();
  const audioStream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: env.ELEVENLABS_TTS_MODEL,
    languageCode,
    outputFormat: 'mp3_44100_128',
    enableLogging: env.ELEVENLABS_ENABLE_LOGGING,
    optimizeStreamingLatency: 2,
  });

  return {
    audio: await streamToUint8Array(audioStream),
    contentType: 'audio/mpeg',
    modelId: env.ELEVENLABS_TTS_MODEL,
    voiceId,
  };
}

async function streamToUint8Array(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    totalLength += value.byteLength;
  }

  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}
