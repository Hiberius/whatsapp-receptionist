/**
 * Content Security Policy (CSP) helpers.
 *
 * Edge-runtime compatible. Used by `src/middleware.ts` to attach a per-request
 * nonce to inline scripts and to whitelist external origins we actually call.
 *
 * Two design choices worth highlighting:
 *
 * 1. We use `'strict-dynamic'` together with a nonce, so any script that we
 *    explicitly nonce can transitively load other scripts without us having
 *    to whitelist their hosts. This is the modern CSP3 pattern.
 * 2. The nonce is a base64url string sourced from `crypto.getRandomValues`.
 *    `crypto.randomUUID()` would also work, but we want raw entropy without
 *    the UUID dashes, and we want to stay compatible with the Edge Runtime
 *    where the Web Crypto API is the only available implementation.
 */

/** Origins we make `connect-src` (fetch/XHR/WebSocket) calls to. */
export const CSP_CONNECT_SRC: readonly string[] = [
  "'self'",
  'https://api.anthropic.com',
  'https://api.stripe.com',
  'https://*.supabase.co',
  'https://*.elevenlabs.io',
  'https://graph.facebook.com',
  'https://api.upstash.io',
  'https://www.googleapis.com',
];

/** Origins we load <img> from (Supabase storage, Google avatars, data URIs). */
export const CSP_IMG_SRC: readonly string[] = [
  "'self'",
  'data:',
  'https://*.supabase.co',
  'https://lh3.googleusercontent.com',
];

/** Origins we load fonts from (self + data: for inlined font payloads). */
export const CSP_FONT_SRC: readonly string[] = ["'self'", 'data:'];

/** Origins allowed inside <iframe> (Stripe Checkout, Stripe Elements, ApplePay). */
export const CSP_FRAME_SRC: readonly string[] = ["'self'", 'https://js.stripe.com'];

/** Origins allowed for <audio>/<video>/blob URLs (TTS playback, Supabase media). */
export const CSP_MEDIA_SRC: readonly string[] = ["'self'", 'blob:', 'https://*.supabase.co'];

/** Origins allowed for <style>. We keep `'unsafe-inline'` for Next.js streaming styles. */
export const CSP_STYLE_SRC: readonly string[] = ["'self'", "'unsafe-inline'"];

/**
 * Generate a cryptographically random nonce as a URL-safe base64 string.
 *
 * - Uses Web Crypto (`crypto.getRandomValues`), available in both Node 22+ and
 *   the Edge Runtime; no `node:crypto` import.
 * - 16 random bytes → 22 base64url characters (no padding), well above the
 *   recommended 128 bits of entropy for CSP nonces.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  // btoa is available in both browser, Node 16+, and Edge Runtime.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Build the full Content-Security-Policy header value for a given nonce.
 *
 * Directives:
 * - `default-src 'self'`: deny by default, allow same-origin.
 * - `script-src`: only nonced inline scripts and same-origin scripts;
 *   `'strict-dynamic'` lets nonced scripts load further scripts at runtime.
 * - `style-src`: same-origin + inline (Next.js streaming RSC requires this).
 * - `img-src`: same-origin + data URIs + Supabase + Google avatars.
 * - `font-src`: same-origin + inlined fonts.
 * - `connect-src`: explicit whitelist of every external API we hit.
 * - `frame-src`: only same-origin and Stripe.
 * - `media-src`: same-origin, blob URLs (for TTS), and Supabase storage.
 * - `object-src 'none'`: disallow Flash/Java/legacy plugins.
 * - `base-uri 'self'`: prevent <base> tag hijacks.
 * - `form-action 'self'`: forms only POST to us.
 * - `frame-ancestors 'none'`: nobody can embed us in an iframe (clickjacking).
 * - `upgrade-insecure-requests`: auto-upgrade http:// to https://.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  const directives: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]],
    ['style-src', CSP_STYLE_SRC],
    ['img-src', CSP_IMG_SRC],
    ['font-src', CSP_FONT_SRC],
    ['connect-src', CSP_CONNECT_SRC],
    ['frame-src', CSP_FRAME_SRC],
    ['media-src', CSP_MEDIA_SRC],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
  ];

  const directiveStrings = directives.map(([name, sources]) => `${name} ${sources.join(' ')}`);

  // `upgrade-insecure-requests` is a directive without a source list.
  directiveStrings.push('upgrade-insecure-requests');

  return directiveStrings.join('; ');
}

/**
 * Path prefixes that should NOT receive a CSP header.
 *
 * Webhook endpoints (Stripe, WhatsApp/Meta) are called server-to-server and
 * never render HTML; injecting CSP into their JSON responses is harmless but
 * makes integration debugging confusing (e.g. some CDN intermediaries forward
 * CSP into developer dashboards). `/api/health` is also exempt so probes get
 * a minimal response.
 */
export const CSP_BYPASS_PATH_PREFIXES: readonly string[] = [
  '/api/webhook/stripe',
  '/api/webhook/whatsapp',
  '/api/health',
];

/**
 * Whether the given pathname should bypass CSP injection.
 */
export function shouldBypassCsp(pathname: string): boolean {
  return CSP_BYPASS_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
