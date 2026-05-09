import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HealthCheck {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  details?: string;
}

interface DeepHealthResponse {
  ok: boolean;
  service: string;
  version: string;
  timestamp: string;
  checks: HealthCheck[];
}

async function checkSupabase(): Promise<HealthCheck> {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  if (!url) {
    return { name: 'supabase', status: 'down', details: 'URL not configured' };
  }

  const start = Date.now();
  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return {
      name: 'supabase',
      status: response.ok ? 'ok' : 'degraded',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'supabase',
      status: 'down',
      latencyMs: Date.now() - start,
      details: (error as Error).message,
    };
  }
}

async function checkUpstash(): Promise<HealthCheck> {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) {
    return { name: 'upstash', status: 'down', details: 'not configured' };
  }

  const start = Date.now();
  try {
    const response = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    });
    return {
      name: 'upstash',
      status: response.ok ? 'ok' : 'degraded',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'upstash',
      status: 'down',
      latencyMs: Date.now() - start,
      details: (error as Error).message,
    };
  }
}

async function checkStripe(): Promise<HealthCheck> {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) {
    return { name: 'stripe', status: 'down', details: 'not configured' };
  }

  const start = Date.now();
  try {
    const response = await fetch('https://api.stripe.com/v1', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(3000),
    });
    return {
      name: 'stripe',
      status: response.status < 500 ? 'ok' : 'degraded',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'stripe',
      status: 'down',
      latencyMs: Date.now() - start,
      details: (error as Error).message,
    };
  }
}

export async function GET(): Promise<NextResponse<DeepHealthResponse>> {
  const checks = await Promise.all([checkSupabase(), checkUpstash(), checkStripe()]);

  const allOk = checks.every((check) => check.status === 'ok');

  return NextResponse.json(
    {
      ok: allOk,
      service: 'ambrogio-ai',
      version: process.env['NEXT_PUBLIC_APP_VERSION'] ?? '0.1.0',
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
