import { NextResponse, type NextRequest } from 'next/server';

import { toAppError } from '@/lib/errors/app-error';
import { getClientIp, getRequestId } from '@/lib/http/request';
import { logger } from '@/lib/logging/logger';

type ApiHandler<T> = (context: ApiRequestContext) => Promise<T> | T;

export type ApiRequestContext = {
  request: NextRequest | Request | null;
  requestId: string;
  ipAddress: string;
  startedAt: number;
};

export async function jsonHandler<T>(
  handler: ApiHandler<T>,
  request: NextRequest | Request | null = null,
): Promise<NextResponse> {
  const context: ApiRequestContext = {
    request,
    requestId: getRequestId(request?.headers),
    ipAddress: getClientIp(request?.headers),
    startedAt: Date.now(),
  };

  try {
    const data = await handler(context);
    const durationMs = Date.now() - context.startedAt;

    logger.info(
      {
        requestId: context.requestId,
        durationMs,
      },
      'API request completed',
    );

    return NextResponse.json(
      { ok: true, data },
      { headers: { 'x-request-id': context.requestId } },
    );
  } catch (error) {
    const appError = toAppError(error);
    const durationMs = Date.now() - context.startedAt;

    logger.error(
      {
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        durationMs,
        code: appError.code,
        status: appError.status,
        cause: appError.cause,
      },
      appError.message,
    );

    const headers: Record<string, string> = { 'x-request-id': context.requestId };

    if (appError.code === 'rate_limited' && appError.retryAfter !== null) {
      headers['Retry-After'] = String(appError.retryAfter);
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: appError.code,
          message: appError.expose ? appError.message : 'Internal server error',
        },
      },
      {
        status: appError.status,
        headers,
      },
    );
  }
}
