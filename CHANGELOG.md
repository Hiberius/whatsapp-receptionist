# Changelog

All notable changes to **WhatsApp Receptionist** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- **Tenant isolation proven in CI** — seed two tenants against a real Supabase instance and assert A cannot read B. Highest-priority open item.
- **Error tracking** (Sentry) and a health watchdog for the outbox
- **Data retention job**, matching the 24-month retention the privacy policy already states
- Resource/operator entity (a practice with two chairs cannot be modelled today) and team invitations
- Move AI generation out of the webhook into a dedicated outbox job
- Prompt caching and a per-tenant AI cost ceiling
- Prompt injection defences and a much larger AI evaluation set
- Hosted public live demo with sandbox WhatsApp number
- Telegram + Instagram DM channels (single orchestrator, multiple transports)
- Outlook Calendar provider as alternative to Google
- Real PNG screenshots (replacing the SVG placeholders in `docs/screenshots/`)

See [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md) for the full, verifiable breakdown.

---

## [0.2.0] · Production hardening · 2026-07-27

The release that turns a well-built backend into a product a customer can actually use.

Produced with **Claude Opus 5 in ultracode mode**: an eight-dimension audit in which every auditor
was followed by an adversarial verifier instructed to refute its findings, then two parallel
implementation workflows — 31 agents in total. The six gravest findings were additionally verified
by hand before any code was written. Full audit, including findings deliberately *not* acted on:
[`docs/audit/2026-07-27-audit-prodotto.md`](docs/audit/2026-07-27-audit-prodotto.md).

### Fixed — the product did not work end to end

- **Vercel cron jobs never executed.** `vercel.json` scheduled five jobs while the routes exported only `POST`; Vercel Cron invokes with `GET`, so every run returned 405. The WhatsApp outbox was never drained and the product was silently mute in production. Added `GET` handlers plus shared auth accepting both Vercel's `Authorization: Bearer` and the self-hosted custom header, with timing-safe comparison on both.
- **Nobody could sign up or log in.** All four public forms posted `application/x-www-form-urlencoded` to routes that `JSON.parse` the raw body. Converted to JSON submission with real inline error feedback.
- **`/auth/callback` did not exist**, despite already being configured as the magic-link `emailRedirectTo` — every login email led to a 404. Implemented, handling both the PKCE and token-hash flows, with open-redirect validation on `next`.
- **The authenticated area had no auth guard.** `(dashboard)/layout.tsx` was 12 lines without `requireSession`; middleware only handled CSP. Guards now live in the layouts.
- **No tenant could receive messages.** `whatsapp_360dialog` had seven reads and zero writes: no code path created the `integrations` row the webhook resolves tenants by. Added a provisioning service and UI.
- **The dashboard displayed no real data.** Fifteen pages were static mocks; no component called any of the API routes. Now wired to the existing, already-tested services.
- **Onboarding field names did not match the API schema** (`business_name` vs `tenantName`), so submissions would have failed validation even in JSON.
- **`checkStripe` queried `api.stripe.com/v1`**, which returns 404 for any key, and therefore reported a revoked key as healthy. Now uses the authenticated `/v1/balance`.

### Fixed — security

- **Cross-tenant WhatsApp hijack.** The schema has no unique constraint on `(provider, external_account_id)`, so a tenant could claim another tenant's `phone_number_id` and receive their conversations. Ownership is now verified before write, with a deliberately generic error that does not disclose the owning tenant.
- **Single global WhatsApp API key for all tenants.** Every customer would have replied from the same number, sharing brand identity, quota and ban risk. Credentials are now resolved per tenant, cached with a TTL, and invalidated on auth failure and on connect/disconnect.
- **Tenant prompts could delete the safety rules.** A custom persona *replaced* the system prompt, silently removing the prohibitions on medical diagnosis and unkeepable promises. Composition is now `[safety, persona, output]` with immutable sections.
- **Open redirect** on the post-login `next` parameter.
- **Seven high-severity dependency vulnerabilities → zero in production.** Next.js 15.5.18 → 15.5.22 (SSRF in Server Actions on custom servers, App Router DoS), plus overrides for postcss, sharp, ws, js-yaml and vite. One dev-only advisory is accepted with a written reopening condition in [`docs/SECURITY-AUDIT-NOTES.md`](docs/SECURITY-AUDIT-NOTES.md).

### Removed — unverifiable public claims

The site published invented data as if measured. All of it is gone:

- A hardcoded `aggregateRating` of 4.9/5 over 24 reviews in the `SoftwareApplication` JSON-LD, plus the placeholder reviews that backed it — a Google structured-data policy violation as well as a consumer-protection one
- A case study crediting €12,400 in recovered revenue, and the blog post that narrated it
- The `/about` origin story built on the same numbers
- Fabricated outcome metrics on all four vertical pages and their OG images
- Fabricated uptime percentages and incident history on `/status`, now replaced by real dependency probes
- Fabricated MRR, paying-customer counts, tenant and user lists, and **audit log entries** in the admin panel — the last being the gravest, since an audit log exists to evidence what actually happened

### Added

- **Human escalation.** `escalated` previously existed only as a type and was never written; `human_escalation_email` was stored and never read. A message saying "severe pain" received silence. Now: status change, operator email with context and deep link, and a reply telling the customer a human is coming.
- **Transactional email.** `email-templates.ts` was 223 lines of dead code. Added a Resend sender and a no-op sender that logs instead of delivering, so development does not break without an API key.
- **`fetchWithTimeout`.** No server-side HTTP call had a timeout; inside the WhatsApp webhook a slow dependency delayed the response to Meta until retry. Composes with the caller's existing signal instead of discarding it.
- **Tenant-editable AI persona**, versioned on the existing `ai_prompts` table.
- **Business hours and services configuration** — the data the AI computes availability from.
- **Knowledge base management.** Without it the pgvector RAG stayed empty by construction, leaving the AI with no source of truth about the tenant's business.
- **Conversations inbox with operator reply**, respecting WhatsApp's 24-hour service window and opt-out state.
- **56 Playwright E2E tests** covering exactly the flows that broke here: authenticated-area redirects, forms posting JSON without navigating, public pages free of console errors. They run without production secrets — an E2E suite that needs real credentials never runs.
- `loading.tsx` and `error.tsx` for the dashboard and admin segments.
- CI: a `dependency-audit` job, and `continue-on-error` removed from the gitleaks scan — a gate that cannot fail is not a gate.

### Changed

- **Italian date and time understanding.** "alle 3 del pomeriggio" parsed as 03:00, "il 15 maggio" was ignored, captured minutes were discarded. Time-of-day markers are now evaluated before the exact hour, and the evaluation set covers colloquial phrasings plus inputs containing no date at all, which must return nothing rather than guess.
- Voice media downloads now pass `tenantId`, instead of using the global key.
- README and roadmap claimed "Meta WhatsApp Cloud API" while the code uses 360dialog (`waba-v2.360dialog.io`). 360dialog is an official Meta BSP, so the substance held, but the name did not.
- Test suite: 369 → **521**.

---

## [0.1.0] · Public open-source release · 2026-05-09

First public-ready release. The codebase has been sanitized of business-specific branding (formerly `ambrogio-ai`) and rebranded to the generic **WhatsApp Receptionist** under the MIT license. All 369 tests pass, production build is verified, and the repo is ready to be self-hosted in 30 minutes.

> Rolls up 10 internal development commits (listed below in reverse chronological order) into one public 0.1.0 milestone.

### Added

- **MIT license** + open-source ready `package.json` (keywords, repo, homepage, bugs, author)
- **English-first `README.md`** with hero banner, badge cluster, feature grid, tech stack table, architecture map, GDPR & security section, roadmap, acknowledgments
- **Italian `README.it.md`** with dedicated SDI/GDPR Italian compliance section
- **Logo assets** (`public/icon.svg` + `public/logo.svg`) — chat bubble + AI listening dot pattern
- **Hero banner SVG** (`docs/screenshots/hero-banner.svg`) — split editorial layout, OKLCH palette
- **Screenshot placeholders** for landing, pricing, dental vertical, dashboard, admin, onboarding (1280×800 + 375×812 mobile)
- **`CHANGELOG.md`** following Keep a Changelog conventions
- **`docs/screenshots/README.md`** with Playwright capture instructions

### Changed

- Project renamed in `package.json`: `ambrogio-ai` → `whatsapp-receptionist`
- `package.json` `private: false` (was `true`) — open-source distribution

### Notes

- This release rolls up the full development history into one public-facing 0.1.0 tag.
- Future releases will follow strict SemVer with one entry per release.

---

## Development history (pre-public)

These entries document the engineering work that produced the codebase before it was open-sourced. They are kept here for transparency and reproducibility, in reverse chronological order.

### 2026-05-09 · Phase 10 — SEO PERFECT (`fc632d1`)

3-agent swarm (`searchfit-seo`) raises Lighthouse SEO score to 95–98/100. Schema markup audited and tightened (Organization, SoftwareApplication, FAQ, Breadcrumb), meta tags reviewed across all 35 pages, AI-visibility heuristics applied, internal linking strategy refined.

### 2026-05-09 · Phase 9 — Quality swarm (`160e852`)

4-agent swarm covering SEO (87), accessibility (95), TypeScript type quality, and design polish. Fraunces becomes the canonical display font (paired with Inter for body), tokens normalized to OKLCH, focus states audited, alt text verified.

### 2026-05-08 · Phase 8 — Visual audit (`27571b9`)

Visual audit swarm: a11y fixes (focus rings, ARIA labels, contrast), SEO fixes (canonical URLs, sitemap, robots.ts), UX polish (form validation messages, loading states), design polish (consistent spacing, typography rhythm).

### 2026-05-08 · Phase 7 — API + admin (`b675093`)

`POST /api/contact` (with rate-limit + Resend email), auth API hardening, full super-admin panel (overview, tenants, users, billing, audit, system, single-tenant detail), transactional email templates, Open Graph image generation (`opengraph-image.tsx`), dev-tools page (`/dev/components` for visual QA).

### 2026-05-08 · Phase 6 — Auxiliary pages + hardening (`000b655`)

Auxiliary pages (about, blog, blog/[slug], case-studies, changelog, contact, docs, help, help/articles/[slug], status), `/api/health` deep-check (DB, Redis, Stripe, WhatsApp, Anthropic), build hardening (CSP nonce strict, security headers tightened), test coverage thresholds (60% v8), API contract docs (`docs/api-contract.md`, `docs/api-quick-reference.md`).

### 2026-05-08 · Phase 5 — Testing infrastructure (`56fc7be`)

Vitest 4 with v8 coverage, fixtures for tenants/conversations/appointments/billing, integration tests for all API routes, smoke tests for critical flows. 251 tests at this point (final count: 369).

### 2026-05-08 · Phases 3.6 + 4 — Onboarding + calendar + billing + admin + SDI (`eca4ed7`)

4-step onboarding wizard, Google Calendar OAuth provider with encrypted token storage and conflict detection, Stripe Subscriptions + Customer Portal, super-admin foundation, **Italian SDI electronic invoicing** via Fatture in Cloud (`src/server/billing/sdi-invoicing.ts`).

### 2026-05-08 · Phase 3 — Frontend (`70c6641`)

Design system (OKLCH tokens, fluid typography, Fraunces + Inter), landing page, auth pages (login + register), tenant dashboard with sidebar (5 sections), legal pages (privacy, terms, DPA, cookie, security).

### 2026-05-08 · Phase 2 — Security & GDPR (`54a5845`)

CSP nonce-based middleware per request, GDPR Art. 15 (export) + Art. 17 (delete) endpoints with audit log, automatic PII redact in Pino logs (email, phone, fiscal_code, IBAN, OAuth tokens), Upstash Redis rate-limit policies (auth, onboarding, settings, GDPR export, contact), timing-safe webhook signature verification (Stripe + WhatsApp).

### 2026-05-08 · Phase 1 — Backend MVP baseline (`4f86b80`)

Initial baseline: Next.js 15.5 App Router, React 19, TypeScript 5.9 strict, Supabase Postgres EU + Drizzle ORM with RLS on all tables, Anthropic Claude SDK with prompt caching, ElevenLabs STT/TTS, Meta WhatsApp Cloud API integration, Pino logging, ESLint 9 flat + Prettier 3 + Husky.

---

[Unreleased]: https://github.com/Hiberius/whatsapp-receptionist/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Hiberius/whatsapp-receptionist/releases/tag/v0.1.0
