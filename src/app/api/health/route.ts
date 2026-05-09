import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface HealthCheck {
  name: string;
  status: 'ok' | 'unknown';
  details?: string;
}

interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
  region: string;
  timestamp: string;
  checks: HealthCheck[];
}

export function GET(): NextResponse<HealthResponse> {
  // Edge-runtime compatible: no server services accessed sincronamente.
  // Per check completi (DB, Redis, providers esterni) usare /api/health/deep
  // che gira in node runtime.
  const checks: HealthCheck[] = [
    {
      name: 'app',
      status: 'ok',
      details: 'Edge runtime active',
    },
    {
      name: 'env',
      status:
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? 'ok'
          : 'unknown',
    },
  ];

  const allOk = checks.every((check) => check.status === 'ok');

  return NextResponse.json(
    {
      ok: allOk,
      service: 'ambrogio-ai',
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
      region: process.env.VERCEL_REGION ?? 'unknown',
      timestamp: new Date().toISOString(),
      checks,
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
