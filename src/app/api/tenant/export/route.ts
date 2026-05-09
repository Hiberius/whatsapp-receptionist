// Fatto da Claude Code l'8 maggio 2026.
// GDPR Art. 15 — tenant data export.
//
// Owner/admin scarica un JSON con tutti i dati del tenant (21 tabelle).
// Rate limit: 1 export / 24h (Upstash con fallback memoria).

import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { requireSession } from '@/lib/auth/session';
import { getRequestId } from '@/lib/http/request';
import { applyRateLimit } from '@/lib/rate-limit/apply';
import { toAppError } from '@/lib/errors/app-error';
import { createGdprExportService } from '@/server/gdpr/data-export';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId(request.headers);
  const startedAt = Date.now();

  try {
    const session = await requireSession();

    if (session.role !== 'owner' && session.role !== 'admin') {
      // Non leakiamo info: 404 invece di 403 (anti-enumeration GDPR).
      return jsonError({ requestId, status: 404, code: 'not_found' });
    }

    await applyRateLimit('gdprExport', { kind: 'tenantId', value: session.tenantId });

    const service = createGdprExportService();
    const payload = await service.exportTenantData({
      session,
      actor: {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: request.headers.get('user-agent') ?? null,
      },
    });

    const filename = `ambrogio-tenant-export-${session.tenantId}-${Date.now()}.json`;
    const body = JSON.stringify({ ok: true, data: payload }, null, 2);
    const durationMs = Date.now() - startedAt;

    logger.info(
      {
        requestId,
        durationMs,
        tenantId: session.tenantId,
        totalRows: payload.totalRows,
      },
      'GDPR tenant export delivered',
    );

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    const appError = toAppError(error);

    logger.error(
      {
        requestId,
        durationMs: Date.now() - startedAt,
        code: appError.code,
        status: appError.status,
        cause: appError.cause,
      },
      appError.message,
    );

    return jsonError({
      requestId,
      status: appError.status,
      code: appError.code,
      ...(appError.expose && appError.message !== undefined ? { message: appError.message } : {}),
    });
  }
}

function jsonError(input: {
  requestId: string;
  status: number;
  code: string;
  message?: string;
}): Response {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: input.code,
        message: input.message ?? 'Internal server error',
      },
    },
    {
      status: input.status,
      headers: { 'x-request-id': input.requestId },
    },
  );
}
