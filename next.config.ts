import type { NextConfig } from 'next';

/**
 * Security headers split between this file and `src/middleware.ts`:
 *
 * - **Here (next.config.ts)**: static headers that never depend on the
 *   request. They benefit from being set at the framework layer because they
 *   apply uniformly across edge AND serverless render paths and they work
 *   even when middleware short-circuits.
 *
 * - **In middleware.ts**: per-request headers (CSP with nonce) and
 *   cross-origin isolation primitives that we may want to vary by route
 *   (e.g. webhook bypass for CSP).
 *
 * Do NOT duplicate headers across both layers — middleware-level headers
 * always win because they are written on the response object, but having
 * two sources of truth makes audits painful.
 */
const staticSecurityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Enables Docker standalone output: copies only required files into .next/standalone
  // Required by the Dockerfile. See: https://nextjs.org/docs/app/api-reference/next-config-js/output
  output: 'standalone',
  outputFileTracingRoot: new URL('.', import.meta.url).pathname,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.elevenlabs.io',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['@anthropic-ai/sdk', 'stripe', '@supabase/supabase-js'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: staticSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
