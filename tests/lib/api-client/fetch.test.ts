// Fatto da Claude Code il 27 aprile 2026.
//
// Test del fetcher centrale: envelope success/error, network error,
// JSON invalido, payload non aderente allo schema.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';

import { ApiError, apiFetch } from '@/lib/api-client';

const ECHO_SCHEMA = z.object({
  hello: z.string(),
});

describe('apiFetch', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses a success envelope and returns the typed data', async () => {
    mockJsonResponse({
      ok: true,
      data: { hello: 'world' },
    });

    const result = await apiFetch('/api/echo', { schema: ECHO_SCHEMA });

    expect(result).toEqual({ hello: 'world' });
    const fetchSpy = vi.mocked(global.fetch);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/echo');
  });

  it('serializes JSON body and sets content-type header for POST', async () => {
    mockJsonResponse({ ok: true, data: { hello: 'sent' } });

    await apiFetch('/api/echo', {
      schema: ECHO_SCHEMA,
      method: 'POST',
      body: { foo: 1 },
    });

    const fetchSpy = vi.mocked(global.fetch);
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"foo":1}');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('throws an ApiError with the server-provided code on error envelope', async () => {
    mockJsonResponse(
      {
        ok: false,
        error: { code: 'forbidden', message: 'No access' },
      },
      { status: 403 },
    );

    await expect(apiFetch('/api/echo', { schema: ECHO_SCHEMA })).rejects.toMatchObject({
      code: 'forbidden',
      status: 403,
      message: 'No access',
    });
  });

  it('normalizes unknown error codes to "internal"', async () => {
    mockJsonResponse(
      {
        ok: false,
        error: { code: 'mystery_code', message: 'Unknown' },
      },
      { status: 500 },
    );

    await expect(apiFetch('/api/echo', { schema: ECHO_SCHEMA })).rejects.toMatchObject({
      code: 'internal',
    });
  });

  it('throws network_error when fetch rejects', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('connect refused'));

    await expect(apiFetch('/api/echo', { schema: ECHO_SCHEMA })).rejects.toMatchObject({
      code: 'network_error',
      status: 0,
    });
  });

  it('throws invalid_response when the body is not JSON', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response('not json', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );

    await expect(apiFetch('/api/echo', { schema: ECHO_SCHEMA })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('throws invalid_response when data does not match schema', async () => {
    mockJsonResponse({ ok: true, data: { hello: 42 } });

    const error = await apiFetch('/api/echo', {
      schema: ECHO_SCHEMA,
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('invalid_response');
  });
});

function mockJsonResponse(payload: unknown, init: { status?: number } = {}): void {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
      status: init.status ?? 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}
