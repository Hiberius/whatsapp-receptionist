import { describe, expect, it, vi } from 'vitest';

import { AnthropicMessagesClient } from '@/server/ai/anthropic-adapter';

describe('AnthropicMessagesClient', () => {
  it('calls the Anthropic messages API and normalizes text/usage', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        model: 'configured-model',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '{"ok":true}' }],
        usage: {
          input_tokens: 12,
          output_tokens: 8,
        },
      }),
    );
    const client = new AnthropicMessagesClient({
      apiKey: 'api_key_1',
      model: 'configured-model',
      fetcher,
    });

    const result = await client.complete({
      system: 'Rispondi solo in JSON',
      messages: [{ role: 'user', content: 'ciao' }],
      maxTokens: 100,
      temperature: 0,
      metadata: {
        feature: 'test',
      },
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'anthropic-version': '2023-06-01',
          'x-api-key': 'api_key_1',
        }),
      }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'configured-model',
      system: 'Rispondi solo in JSON',
      max_tokens: 100,
      temperature: 0,
      metadata: {
        feature: 'test',
      },
    });
    expect(result).toMatchObject({
      text: '{"ok":true}',
      model: 'configured-model',
      inputTokens: 12,
      outputTokens: 8,
      stopReason: 'end_turn',
    });
  });
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}
