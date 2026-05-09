import { NextResponse, type NextRequest } from 'next/server';

import { buildContentSecurityPolicy, generateNonce, shouldBypassCsp } from '@/lib/security/csp';

/**
 * Edge middleware: per-request CSP nonce + cross-origin isolation headers.
 *
 * We attach the nonce to the request via `x-nonce` so RSC layouts/pages
 * (which can read `headers()`) can pass it to <Script> tags. The same nonce is
 * embedded into the `Content-Security-Policy` response header.
 *
 * Webhook routes (Stripe, WhatsApp) and `/api/health` are server-to-server and
 * skip CSP entirely (see CSP_BYPASS_PATH_PREFIXES). They still receive the
 * other security headers, since those don't break JSON responses.
 *
 * Static assets handled by the Next.js asset pipeline are excluded via the
 * matcher at the bottom of this file.
 */

/** Headers shared by every routed response, including webhooks and JSON APIs. */
function applyBaseSecurityHeaders(headers: Headers): void {
  // Avoid leaking <link rel="dns-prefetch"> probes to third parties.
  headers.set('X-DNS-Prefetch-Control', 'off');

  // Cross-origin isolation primitives. `credentialless` is a softer COEP that
  // still allows fetching cross-origin resources without their CORP opt-in,
  // suitable for an app that loads Stripe/Supabase assets.
  headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  // Block legacy Flash/Silverlight cross-domain policy files.
  headers.set('X-Permitted-Cross-Domain-Policies', 'none');
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const bypassCsp = shouldBypassCsp(pathname);

  if (bypassCsp) {
    // Pass-through: still apply base security headers, no CSP, no nonce.
    const response = NextResponse.next();
    applyBaseSecurityHeaders(response.headers);
    return response;
  }

  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(nonce);

  // Forward the nonce on the *request* so server components can read it via
  // `headers()`. Next 15 supports header rewriting through `request.headers`.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  applyBaseSecurityHeaders(response.headers);
  response.headers.set('Content-Security-Policy', csp);
  // Mirror the nonce on the response too — useful for debugging and for any
  // downstream code that reads response headers (tests, e2e probes).
  response.headers.set('x-nonce', nonce);

  return response;
}

/**
 * Matcher: run middleware on everything except the Next.js internals and
 * static asset routes. We deliberately include API routes — bypass logic for
 * webhooks lives inside the middleware so it stays auditable in one place.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static assets)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml (public files)
     * - Any file with a static extension (svg, png, jpg, css, woff, ...)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|ttf|otf)$).*)',
  ],
};
