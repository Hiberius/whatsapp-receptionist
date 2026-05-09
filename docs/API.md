# API reference

WhatsApp Receptionist exposes 37 HTTP endpoints under `/api/*`. They follow consistent conventions for authentication, validation, errors, and rate limiting.

## Quick reference

For a fast lookup table of every endpoint with method, auth, and one-line description, see **[api-quick-reference.md](api-quick-reference.md)**.

## Full contract

For request schemas, response shapes, error codes, curl examples, and webhook signature details, see **[api-contract.md](api-contract.md)** (35 KB, 1258 lines).

## Conventions

### Authentication

Three types:

1. **Session-based** (cookie): for `/api/conversations`, `/api/settings`, `/api/billing`, `/api/tenant/*`, `/api/customers/*`, etc. Handled by `requireSession()` or `requireAuthenticatedUser()` from `@/lib/auth/session`.
2. **Internal job secret**: for `/api/internal/jobs/*`. Header `Authorization: Bearer <INTERNAL_JOB_SECRET>`.
3. **Webhook signature**: for `/api/webhook/stripe` (Stripe-Signature) and `/api/webhook/whatsapp` (X-Hub-Signature-256 or custom header). Verified with constant-time comparison.

Public endpoints with no auth: `/api/health`, `/api/health/deep`, `/api/contact`, `/api/auth/magic-link`, `/api/auth/sign-up`.

### Validation

All `POST` / `PATCH` / `PUT` bodies are parsed by Zod schemas with `.strict()` (no extra fields allowed). Validation errors return `400 bad_request` with field-level detail.

### Error envelope

```json
{
  "ok": false,
  "error": {
    "code": "rate_limited",
    "message": "Too many requests"
  }
}
```

`code` is one of: `bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `upstream_error`, `webhook_rejected`, `internal`.

429 responses always include a `Retry-After` header (seconds).

### Request ID

Every response includes an `x-request-id` header. Use it when reporting bugs.

### Cache-Control

Health endpoints return `Cache-Control: no-store`. Default for tenant-scoped data is also no-store unless explicitly cached.

## Rate limit policies

Defined in [`src/lib/rate-limit/policies.ts`](../src/lib/rate-limit/policies.ts):

| Policy | Window | Limit | Applied to |
|---|---|---|---|
| `authLogin` | 15 min | 5 | login attempts |
| `authMagicLink` | 1 hour | 3 | magic link requests |
| `authPasswordReset` | 1 hour | 3 | password reset |
| `onboarding` | 1 hour | 10 | tenant creation |
| `settingsWrite` | 1 min | 30 | settings mutations |
| `gdprExport` | 24 hours | 1 | data export |
| `gdprDelete` | 24 hours | 1 | account deletion |
| `contactForm` | 1 min | 5 | public contact submissions |

## Webhook signature verification

### Stripe

`POST /api/webhook/stripe` verifies `Stripe-Signature` using `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`. Idempotency via `webhook_events` table.

### WhatsApp

`POST /api/webhook/whatsapp` supports two paths:

1. **Header-based** (default for 360dialog and similar BSPs): timing-safe compare of `X-Hub-Signature` against `WHATSAPP_WEBHOOK_HEADER_SECRET`.
2. **Meta direct HMAC SHA-256** (in roadmap): verify `X-Hub-Signature-256` against payload signed with `WHATSAPP_APP_SECRET`.

## Internal jobs

`/api/internal/jobs/*` endpoints are designed for cron triggers. They check the bearer token, claim a batch of work, process it, and return a count. Idempotent and safe to retry.

| Job | Schedule (Vercel Cron) | Purpose |
|---|---|---|
| `whatsapp-outbox` | every minute | send queued outbound messages |
| `whatsapp-voice` | every minute | process voice transcriptions |
| `whatsapp-template-sync` | daily 06:00 | refresh approved templates from Meta |
| `appointment-reminders` | every 5 minutes | send 24h + 2h reminders |
| `gdpr-hard-delete` | daily 03:00 | hard-delete tenants past 30-day grace |

## OpenAPI spec

A full OpenAPI 3.1 spec auto-generated from Zod schemas is in the roadmap (target v0.2). Until then, the markdown contract is the source of truth.

## Testing endpoints

The smoke test suite ([`tests/smoke/route-shape.test.ts`](../tests/smoke/route-shape.test.ts)) auto-discovers every `route.ts` and verifies that the expected HTTP method handlers are exported. Run with `npm test`.
