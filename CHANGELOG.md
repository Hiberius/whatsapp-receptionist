# Changelog

All notable changes to **WhatsApp Receptionist** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Hosted public live demo with sandbox WhatsApp number
- Telegram + Instagram DM channels (single orchestrator, multiple transports)
- Native voice calls (ElevenLabs Conversational + Twilio)
- Outlook Calendar provider as alternative to Google
- German + French i18n
- Real PNG screenshots (replacing the SVG placeholders in `docs/screenshots/`)

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
