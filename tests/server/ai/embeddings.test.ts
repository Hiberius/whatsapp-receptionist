import { describe, expect, it, vi } from 'vitest';

import { OpenAIEmbeddingClient } from '@/server/ai/embeddings';

describe('OpenAIEmbeddingClient', () => {
  it('requests embeddings and validates the vector', async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            data: [{ embedding: [0.1, -0.2, 0.3] }],
          }),
          { status: 200 },
        ),
    );
    const client = new OpenAIEmbeddingClient({
      apiKey: 'key_1',
      model: 'text-embedding-3-large',
      apiBaseUrl: 'https://example.test/v1',
      fetcher,
    });

    await expect(
      client.embed({
        text: 'Quanto costa igiene dentale?',
        metadata: { tenantId: 'tenant_1' },
      }),
    ).resolves.toEqual([0.1, -0.2, 0.3]);
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer key_1',
        }),
      }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: 'text-embedding-3-large',
      input: 'Quanto costa igiene dentale?',
      dimensions: 1536,
      user: 'tenant_1',
    });
  });

  it('throws when the embedding response is malformed', async () => {
    const client = new OpenAIEmbeddingClient({
      apiKey: 'key_1',
      model: 'text-embedding-3-large',
      fetcher: vi.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          new Response(JSON.stringify({ data: [{ embedding: ['nope'] }] }), {
            status: 200,
          }),
      ),
    });

    await expect(client.embed({ text: 'ciao' })).rejects.toMatchObject({
      code: 'upstream_error',
    });
  });
});
