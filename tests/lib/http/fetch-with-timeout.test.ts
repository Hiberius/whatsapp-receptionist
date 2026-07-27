import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { fetchWithTimeout, type FetchLike } from '@/lib/http/fetch-with-timeout';

type RecordedCall = {
  input: string | URL | Request;
  init: RequestInit | undefined;
  signal: AbortSignal | undefined;
};

/**
 * Il fake registra gli argomenti realmente ricevuti: se l'implementazione
 * smettesse di comporre il signal o di propagare metodo/header, le asserzioni
 * su `calls` fallirebbero.
 */
function createFetchSpy(handler: (call: RecordedCall, attempt: number) => Promise<Response>) {
  const calls: RecordedCall[] = [];

  const impl: FetchLike = (input, init) => {
    const call: RecordedCall = { input, init, signal: init?.signal ?? undefined };
    calls.push(call);

    return handler(call, calls.length);
  };

  return { impl, calls };
}

/** Non risolve mai: si rifiuta solo quando il signal composto aborta. */
function pendingUntilAbort(signal: AbortSignal | undefined): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    if (signal === undefined) {
      return;
    }

    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

function createSleepSpy() {
  const delays: number[] = [];

  return {
    delays,
    sleep: async (ms: number): Promise<void> => {
      delays.push(ms);
    },
  };
}

describe('fetchWithTimeout', () => {
  it('returns the response when it arrives before the timeout', async () => {
    const spy = createFetchSpy(async () => new Response('{"ok":true}', { status: 200 }));

    const response = await fetchWithTimeout(
      'https://api.example.com/v1/messages',
      { method: 'POST', headers: { 'x-api-key': 'secret' } },
      { fetchImpl: spy.impl, timeoutMs: 5_000 },
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('{"ok":true}');
    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0]?.input).toBe('https://api.example.com/v1/messages');
    expect(spy.calls[0]?.init?.method).toBe('POST');
    expect(spy.calls[0]?.init?.headers).toEqual({ 'x-api-key': 'secret' });
    expect(spy.calls[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(spy.calls[0]?.signal?.aborted).toBe(false);
  });

  it('maps an expired timeout to a retriable upstream_error', async () => {
    const spy = createFetchSpy(async (call) => pendingUntilAbort(call.signal));

    const error = await fetchWithTimeout(
      'https://api.example.com/v1/slow',
      {},
      { fetchImpl: spy.impl, timeoutMs: 15 },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('upstream_error');
    expect((error as AppError).status).toBe(502);
    expect((error as AppError).expose).toBe(false);
    expect((error as AppError).message).toContain('timed out after 15ms');
    expect((error as AppError).message).toContain('GET https://api.example.com/v1/slow');
  });

  it('distinguishes a network error from a timeout in the message', async () => {
    const cause = new TypeError('fetch failed');
    const spy = createFetchSpy(async () => {
      throw cause;
    });

    const error = await fetchWithTimeout(
      'https://api.example.com/v1/messages',
      { method: 'POST' },
      { fetchImpl: spy.impl, timeoutMs: 5_000 },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('upstream_error');
    expect((error as AppError).message).toContain('network error');
    expect((error as AppError).message).not.toContain('timed out');
    expect((error as AppError).cause).toBe(cause);
  });

  it('keeps the query string out of the error message', async () => {
    const spy = createFetchSpy(async () => {
      throw new TypeError('fetch failed');
    });

    const error = await fetchWithTimeout(
      'https://oauth2.googleapis.com/token?refresh_token=super-secret',
      { method: 'PUT' },
      { fetchImpl: spy.impl },
    ).catch((caught: unknown) => caught);

    expect((error as AppError).message).toContain('PUT https://oauth2.googleapis.com/token');
    expect((error as AppError).message).not.toContain('super-secret');
  });

  it('honours a label instead of the derived target', async () => {
    const spy = createFetchSpy(async (call) => pendingUntilAbort(call.signal));

    const error = await fetchWithTimeout(
      'https://api.anthropic.com/v1/messages',
      {},
      { fetchImpl: spy.impl, timeoutMs: 10, label: 'anthropic.messages' },
    ).catch((caught: unknown) => caught);

    expect((error as AppError).message).toBe('anthropic.messages timed out after 10ms');
  });

  it('composes the caller signal with the timeout instead of discarding it', async () => {
    const controller = new AbortController();
    const spy = createFetchSpy(async (call) => pendingUntilAbort(call.signal));

    const pending = fetchWithTimeout(
      'https://api.example.com/v1/slow',
      { signal: controller.signal },
      { fetchImpl: spy.impl, timeoutMs: 60_000 },
    );

    const reason = new Error('cancellato dal chiamante');
    controller.abort(reason);

    const error = await pending.catch((caught: unknown) => caught);

    // L'abort volontario non va mascherato da guasto upstream ritentabile.
    expect(error).toBe(reason);
    expect(error).not.toBeInstanceOf(AppError);

    const passedSignal = spy.calls[0]?.signal;
    expect(passedSignal).toBeInstanceOf(AbortSignal);
    expect(passedSignal).not.toBe(controller.signal);
    expect(passedSignal?.aborted).toBe(true);
  });

  it('still applies the timeout when the caller provides a signal', async () => {
    const controller = new AbortController();
    const spy = createFetchSpy(async (call) => pendingUntilAbort(call.signal));

    const error = await fetchWithTimeout(
      'https://api.example.com/v1/slow',
      { signal: controller.signal },
      { fetchImpl: spy.impl, timeoutMs: 15 },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).message).toContain('timed out after 15ms');
    expect(controller.signal.aborted).toBe(false);
  });

  it('fails immediately when the caller signal is already aborted', async () => {
    const reason = new Error('già annullata');
    const spy = createFetchSpy(async (call) => pendingUntilAbort(call.signal));

    const error = await fetchWithTimeout(
      'https://api.example.com/v1/slow',
      { signal: AbortSignal.abort(reason) },
      { fetchImpl: spy.impl, timeoutMs: 60_000 },
    ).catch((caught: unknown) => caught);

    expect(error).toBe(reason);
    expect(spy.calls).toHaveLength(1);
  });

  it('does not retry by default', async () => {
    const spy = createFetchSpy(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(
      fetchWithTimeout('https://api.example.com/v1/data', {}, { fetchImpl: spy.impl }),
    ).rejects.toBeInstanceOf(AppError);

    expect(spy.calls).toHaveLength(1);
  });

  it('retries idempotent requests with exponential backoff when asked explicitly', async () => {
    const spy = createFetchSpy(async (_call, attempt) => {
      if (attempt < 3) {
        throw new TypeError('fetch failed');
      }

      return new Response('ok', { status: 200 });
    });
    const sleepSpy = createSleepSpy();

    const response = await fetchWithTimeout(
      'https://api.example.com/v1/data',
      { method: 'GET' },
      { fetchImpl: spy.impl, retries: 2, retryBaseDelayMs: 100, sleep: sleepSpy.sleep },
    );

    expect(response.status).toBe(200);
    expect(spy.calls).toHaveLength(3);
    expect(sleepSpy.delays).toEqual([100, 200]);
  });

  it('surfaces the last error when every retry is exhausted', async () => {
    const spy = createFetchSpy(async () => {
      throw new TypeError('fetch failed');
    });
    const sleepSpy = createSleepSpy();

    const error = await fetchWithTimeout(
      'https://api.example.com/v1/data',
      { method: 'DELETE' },
      { fetchImpl: spy.impl, retries: 1, retryBaseDelayMs: 50, sleep: sleepSpy.sleep },
    ).catch((caught: unknown) => caught);

    expect(spy.calls).toHaveLength(2);
    expect(sleepSpy.delays).toEqual([50]);
    expect((error as AppError).code).toBe('upstream_error');
  });

  it('never retries after a caller abort', async () => {
    const controller = new AbortController();
    const spy = createFetchSpy(async (call) => pendingUntilAbort(call.signal));
    const sleepSpy = createSleepSpy();

    const pending = fetchWithTimeout(
      'https://api.example.com/v1/data',
      { method: 'GET', signal: controller.signal },
      { fetchImpl: spy.impl, retries: 3, sleep: sleepSpy.sleep, timeoutMs: 60_000 },
    );

    controller.abort(new Error('stop'));
    await pending.catch(() => undefined);

    expect(spy.calls).toHaveLength(1);
    expect(sleepSpy.delays).toEqual([]);
  });

  it('refuses to retry a non-idempotent request', async () => {
    const spy = createFetchSpy(async () => new Response('ok', { status: 200 }));

    const error = await fetchWithTimeout(
      'https://api.stripe.com/v1/subscriptions',
      { method: 'POST' },
      { fetchImpl: spy.impl, retries: 2 },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('internal');
    expect((error as AppError).message).toContain('non-idempotent POST');
    expect(spy.calls).toHaveLength(0);
  });

  it('allows retrying a POST explicitly declared idempotent', async () => {
    const spy = createFetchSpy(async (_call, attempt) => {
      if (attempt === 1) {
        throw new TypeError('fetch failed');
      }

      return new Response('ok', { status: 200 });
    });
    const sleepSpy = createSleepSpy();

    const response = await fetchWithTimeout(
      'https://api.stripe.com/v1/subscriptions',
      { method: 'POST', headers: { 'Idempotency-Key': 'sub_123' } },
      {
        fetchImpl: spy.impl,
        retries: 1,
        retryBaseDelayMs: 20,
        idempotent: true,
        sleep: sleepSpy.sleep,
      },
    );

    expect(response.status).toBe(200);
    expect(spy.calls).toHaveLength(2);
    expect(spy.calls[1]?.init?.headers).toEqual({ 'Idempotency-Key': 'sub_123' });
  });

  it('refuses to retry a streamed body that cannot be replayed', async () => {
    const spy = createFetchSpy(async () => new Response('ok', { status: 200 }));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    const error = await fetchWithTimeout(
      'https://api.example.com/v1/upload',
      { method: 'PUT', body } as RequestInit,
      { fetchImpl: spy.impl, retries: 2 },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).message).toContain('request body is a stream');
    expect(spy.calls).toHaveLength(0);
  });

  it('derives method and url from a Request instance', async () => {
    const spy = createFetchSpy(async () => {
      throw new TypeError('fetch failed');
    });

    const error = await fetchWithTimeout(
      new Request('https://waba-v2.360dialog.io/messages', { method: 'POST' }),
      {},
      { fetchImpl: spy.impl },
    ).catch((caught: unknown) => caught);

    expect((error as AppError).message).toContain('POST https://waba-v2.360dialog.io/messages');
  });
});
