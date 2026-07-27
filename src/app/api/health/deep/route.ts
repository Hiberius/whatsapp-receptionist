import { NextResponse } from 'next/server';

import { type HealthCheck, overallStatus, runHealthChecks } from '@/lib/health/checks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DeepHealthResponse {
  ok: boolean;
  service: string;
  version: string;
  timestamp: string;
  checks: readonly HealthCheck[];
}

export async function GET(): Promise<NextResponse<DeepHealthResponse>> {
  const checks = await runHealthChecks();
  const ok = overallStatus(checks) === 'ok';

  return NextResponse.json(
    {
      ok,
      service: 'ambrogio-ai',
      version: process.env['NEXT_PUBLIC_APP_VERSION'] ?? '0.1.0',
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: ok ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
