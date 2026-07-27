# Project status — what works, what doesn't, what's next

**Last verified: 27 July 2026 · Version 0.2.0 · Branch `main`**

This page is the honest, verifiable state of **WhatsApp Receptionist** (Ambrogio.ai), the
open-source **AI receptionist for WhatsApp** that books real appointments. Every claim below was
checked against the code, the test suite and a production build on the date above — not estimated.

If you are evaluating this project, read this page before the README. The README sells; this page
tells you exactly where the gaps are.

---

## Table of contents

- [What this project is](#what-this-project-is)
- [Verified metrics](#verified-metrics)
- [What works today](#what-works-today)
- [What does not work yet](#what-does-not-work-yet)
- [What is next](#what-is-next)
- [How this release was built](#how-this-release-was-built)
- [How to verify these claims yourself](#how-to-verify-these-claims-yourself)

---

## What this project is

An **open-source, self-hostable, multi-tenant AI receptionist** for small businesses — dental
practices, beauty salons, gyms, professional firms — built for the Italian market and GDPR-first.

It receives WhatsApp messages and voice notes, understands intent with **Anthropic Claude**,
transcribes audio with **ElevenLabs**, checks real availability, books appointments on **Google
Calendar**, bills through **Stripe**, and hands the conversation to a human when it should.

**Stack:** Next.js 15 App Router · React 19 · TypeScript 5.9 strict · Supabase Postgres with Row
Level Security · Anthropic Claude · ElevenLabs STT/TTS · 360dialog WhatsApp Business API · Stripe
Subscriptions · Upstash Redis · Playwright · Vitest · MIT license.

---

## Verified metrics

| Metric | Value |
|---|---|
| Frontend pages | 41 |
| API routes | 39 |
| Server-side domain modules | 16 |
| Database tables (all with RLS) | 22 |
| Unit + integration tests | **521** across 80 files |
| End-to-end tests (Playwright) | **56** across 5 specs |
| Lines of TypeScript in `src/` | ~39,700 |
| Vulnerabilities in production dependencies | **0** |
| Production build | verified |

---

## What works today

### The core loop: message in, answer out

A WhatsApp message reaches `POST /api/webhook/whatsapp`, is verified against a timing-safe shared
secret, deduplicated by idempotency key, routed through intent classification, answered by Claude,
and delivered through a transactional outbox worker with `FOR UPDATE SKIP LOCKED`, exponential
backoff and a dead-letter queue.

**Fixed in 0.2.0:** the five Vercel cron jobs previously returned HTTP 405 on every single run,
because `vercel.json` scheduled them while the routes only exported `POST` and Vercel Cron invokes
with `GET`. The outbox was therefore never drained and the product was silently mute in production.
A regression test now ties `vercel.json` to the exported handlers.

### Self-service signup and onboarding

Register → magic link → `/auth/callback` → onboarding → dashboard. Every authenticated segment is
guarded at the layout level, so a page added tomorrow is protected by construction rather than by
discipline. The `next` redirect parameter is validated against open redirect.

**Fixed in 0.2.0:** all four public forms posted `application/x-www-form-urlencoded` to routes that
`JSON.parse` the raw body, so every submission failed and the browser navigated to raw API JSON.
`/auth/callback` did not exist at all, despite already being configured as the magic-link
`emailRedirectTo` — every login email led to a 404.

### Real multi-tenancy on the WhatsApp channel

Each tenant connects its own WhatsApp number from the dashboard. The provider API key is encrypted
at rest with AES-256-GCM and never returned by the API. A number already claimed by another tenant
is rejected, because the webhook resolves the tenant by `phone_number_id` — without that check a
tenant could have received another tenant's conversations.

**Fixed in 0.2.0:** the outbox previously used one global API key for every tenant, so all customers
would have replied from the same WhatsApp number, sharing brand identity, quota and ban risk. The
second paying customer broke the model.

### Human escalation

When a guardrail detects a sensitive message, or the customer asks for a person, the conversation
moves to `escalated`, the operator is emailed with context and a deep link, and — most importantly
— the customer is told a human is coming.

**Fixed in 0.2.0:** `escalated` existed only as a type and was never written; `human_escalation_email`
was stored and never read. A message saying "severe pain" received total silence.

### Booking that does not invent availability

Slots come from real availability, protected at the database level by a GiST exclusion constraint
against double-booking. Money is stored as integer cents, timestamps as `timestamptz`.

**Fixed in 0.2.0:** Italian date and time parsing was wrong on very common phrasings — "alle 3 del
pomeriggio" (3 in the afternoon) was read as 03:00, "il 15 maggio" was ignored, captured minutes
were discarded.

### Tenant-editable AI personality, with non-negotiable limits

The system prompt is composed as **[safety rules, tenant persona, output rules]** and the safety
sections cannot be overridden.

**Fixed in 0.2.0:** a tenant prompt previously *replaced* the system prompt, silently deleting the
prohibitions on medical diagnosis and unkeepable promises — a real risk in a product used by dental
practices.

### The rest

Conversations inbox with operator reply, respecting WhatsApp's 24-hour service window and opt-out
state. Knowledge base with real pgvector semantic retrieval. Calendar and billing views. Business
hours and services configuration. GDPR Article 15 export and Article 17 deletion with audit
logging. Nonce-based CSP, HSTS, COEP/COOP/CORP. Pino logging with automatic PII redaction.

---

## What does not work yet

Stated plainly, because discovering this after cloning is worse than reading it here.

### Cross-tenant admin panel — not wired

The tenants, users, billing and audit views render an explicit "not connected" state pointing at
the authoritative source, instead of the fabricated data they previously displayed.

**Why it was not simply wired:** those reads run in `service_role`, which bypasses Row Level
Security. They deserve a dedicated `src/server/admin/` service with isolation tests, not queries
improvised inside a page.

### Tenant isolation is enforced in application code, not proven by the database

24 server modules use the service-role client, so isolation rests on roughly 66 hand-written
`.eq('tenant_id')` filters. RLS policies exist on all 22 tables but are never exercised at runtime,
and no CI job seeds two tenants and proves that tenant A cannot read tenant B.

**This is the single most important open item.** Treat it as the prerequisite for handling real
customer data at scale.

### No error tracking or alerting

There is no Sentry, no OpenTelemetry, no alerting. If the bot stops replying at 3am, nobody finds
out until a customer complains. `/api/health/deep` runs real probes and is usable as an external
monitoring endpoint, but nothing consumes it.

### No data retention job

The public privacy policy states 24-month retention. Conversation data currently grows without
bound; the deletion job does not exist.

### The data model excludes two common cases

There is no resource or operator entity, so the anti-double-booking constraint is per tenant: a
practice with two chairs cannot be modelled correctly. And one tenant means one user forever —
there is no team invitation flow.

### Other known gaps

- The AI reply is generated synchronously inside the webhook, with no `maxDuration` set
- No prompt caching, so AI cost per conversation is higher than it needs to be
- No defence against prompt injection from inbound WhatsApp messages
- Docker Compose has no scheduler, and the bundled Valkey cannot serve the Upstash REST client, so
  the self-hosted path is not executable end to end
- The E2E job is non-blocking in CI until the suite proves stable; the promotion condition is
  written in `.github/workflows/ci.yml`
- One accepted dev-only vulnerability, documented with its reopening condition in
  [`SECURITY-AUDIT-NOTES.md`](SECURITY-AUDIT-NOTES.md)

---

## What is next

Ordered by impact over effort.

1. **Tenant isolation proven in CI.** Spin up Supabase, apply migrations from scratch, seed two
   tenants, assert that A cannot read B. Also make the in-memory test fakes record their `eq`
   arguments, so deleting a tenant filter turns a test red — today it does not.
2. **Error tracking and a health watchdog.** Sentry with source maps and release tracking, plus a
   job that notices when the outbox stops draining.
3. **Data retention job**, matching the retention the privacy policy already promises.
4. **Resource and team entities.** Per-resource booking constraints and a team invitation flow.
5. **Move AI generation out of the webhook** into a dedicated outbox job, removing the synchronous
   latency and the retry risk in one change.
6. **Prompt caching and a per-tenant AI cost ceiling.**
7. **Wire the cross-tenant admin panel** on top of a tested `src/server/admin/` service.
8. **Prompt injection defences** and a much larger evaluation set for the AI layer.

Longer-term items live in [`ROADMAP.md`](ROADMAP.md).

---

## How this release was built

Version 0.2.0 was produced with **Claude Opus 5 in ultracode mode** — Anthropic's multi-agent
orchestration, where a workflow script fans work out across many independent subagents and
synthesises their results deterministically.

The process, in order:

1. **Multi-dimensional audit.** Eight independent auditors examined separate dimensions of the
   codebase — product completeness, multi-tenant security, AI quality, reliability, data layer,
   testing, open-source developer experience, and frontend. Each auditor was followed by an
   **adversarial verifier** instructed to *refute* its findings by opening the cited files. 69
   findings survived that verification; the six most severe were then checked by hand before any
   code was written.
2. **Honesty pass first.** Every unverifiable public claim was removed before any feature work.
3. **Parallel implementation.** Fourteen subagents across two workflows, each owning a disjoint set
   of files, with central verification afterwards.

Total: **31 agents, ~4.3 million tokens**. The complete audit, including findings that were *not*
acted on, is published in [`audit/2026-07-27-audit-prodotto.md`](audit/2026-07-27-audit-prodotto.md).

A note on method, since it is the interesting part: the value did not come from generating code
quickly. It came from the adversarial verification step. Roughly a third of the initial findings
were refuted or downgraded when a second agent was asked to disprove them by reading the actual
files — which is exactly the failure mode of single-pass AI review, and the reason the six gravest
findings were still confirmed manually before anything was changed.

---

## How to verify these claims yourself

Do not take this page on trust. Every number above is reproducible:

```bash
git clone https://github.com/Hiberius/whatsapp-receptionist.git
cd whatsapp-receptionist
npm ci
npm run verify          # typecheck + lint + 521 tests + RLS coverage check
npm audit --omit=dev    # 0 vulnerabilities
npm run build           # production build
npx playwright install chromium && npm run test:e2e   # 56 E2E tests
```

To check the claims about what is *missing*, these are the greps that produced them:

```bash
grep -rn "createSupabaseAdminClient" src/server | wc -l   # service-role usage
grep -rn "eq('tenant_id'" src/server | wc -l              # hand-written isolation filters
grep -rn "Sentry\|opentelemetry" package.json             # error tracking: none
```

---

*Questions, corrections, or a finding we got wrong?* Open an issue — a claim on this page that
cannot be reproduced is a bug, and will be treated as one.
