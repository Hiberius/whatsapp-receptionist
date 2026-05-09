import { randomUUID } from 'node:crypto';

const REQUEST_ID_HEADER = 'x-request-id';

export function getRequestId(headers?: Headers | null): string {
  const incoming = headers?.get(REQUEST_ID_HEADER);

  if (incoming && incoming.length <= 128) {
    return incoming;
  }

  return randomUUID();
}

export function getClientIp(headers?: Headers | null): string {
  const forwardedFor = headers?.get('x-forwarded-for');

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return headers?.get('cf-connecting-ip') ?? headers?.get('x-real-ip') ?? 'unknown';
}

export function getUserAgent(headers?: Headers | null): string | null {
  return headers?.get('user-agent') ?? null;
}
