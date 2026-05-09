import { describe, expect, it } from 'vitest';

import { Dialog360WhatsAppMediaClient } from '@/server/whatsapp/media';

describe('Dialog360WhatsAppMediaClient', () => {
  it('retrieves metadata and downloads media bytes with the 360dialog API key', async () => {
    const requests: Array<{ url: string; headers: Headers }> = [];
    const client = new Dialog360WhatsAppMediaClient({
      apiUrl: 'https://waba-v2.360dialog.io',
      apiKey: 'test_api_key',
      fetcher: async (url, init) => {
        requests.push({
          url: url.toString(),
          headers: new Headers(init?.headers),
        });

        if (url.toString().endsWith('/media_1')) {
          return Response.json({
            id: 'media_1',
            url: 'https://waba-v2.360dialog.io/whatsapp_business/attachments/?mid=media_1',
            mime_type: 'audio/ogg',
            sha256: 'hash_1',
          });
        }

        return new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            'content-type': 'audio/ogg',
            'content-length': '3',
          },
        });
      },
    });

    const media = await client.downloadMedia({ mediaId: 'media_1' });

    expect(media).toMatchObject({
      mediaId: 'media_1',
      contentType: 'audio/ogg',
      sha256: 'hash_1',
    });
    expect(Array.from(media.bytes)).toEqual([1, 2, 3]);
    expect(requests.map((request) => request.url)).toEqual([
      'https://waba-v2.360dialog.io/media_1',
      'https://waba-v2.360dialog.io/whatsapp_business/attachments/?mid=media_1',
    ]);
    expect(
      requests.every((request) => request.headers.get('D360-API-KEY') === 'test_api_key'),
    ).toBe(true);
  });

  it('rejects files over the configured size limit', async () => {
    const client = new Dialog360WhatsAppMediaClient({
      apiUrl: 'https://waba-v2.360dialog.io',
      apiKey: 'test_api_key',
      maxBytes: 2,
      fetcher: async (url) => {
        if (url.toString().endsWith('/media_1')) {
          return Response.json({
            url: 'https://waba-v2.360dialog.io/whatsapp_business/attachments/?mid=media_1',
          });
        }

        return new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            'content-type': 'audio/ogg',
          },
        });
      },
    });

    await expect(client.downloadMedia({ mediaId: 'media_1' })).rejects.toMatchObject({
      code: 'bad_request',
    });
  });
});
