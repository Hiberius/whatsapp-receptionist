# Roadmap

This roadmap reflects what's done, what's coming next, and what we'd love community help with. Vote with reactions on the GitHub issues linked below to influence priority.

## ✅ Released — v0.1.0 (May 2026)

The public open-source release.

- 35 frontend pages (landing, pricing, 4 verticals, blog, help, dashboard, admin, legal)
- 37 API routes with Zod validation
- 21 Supabase tables with full RLS
- Anthropic Claude orchestration with intent classification
- 360dialog Business API integration, an official Meta BSP (text + voice)
- ElevenLabs Speech-to-Text + Text-to-Speech
- Google Calendar OAuth booking
- Stripe Subscriptions + Customer Portal
- Italian SDI electronic invoicing via Fatture in Cloud
- GDPR Article 15 (export) + Article 17 (delete) endpoints
- Audit log with immutable retention
- CSP nonce middleware, HSTS, COEP/COOP/CORP
- Rate limiting via Upstash Redis (8 named policies)
- Pino structured logging with PII redaction
- 369 tests (unit + integration + smoke), CI passing
- Production-ready Dockerfile + docker-compose
- Full English + Italian docs

## ✅ Released — v0.2.0 (July 2026)

Production hardening. Full verifiable breakdown in [PROJECT-STATUS.md](PROJECT-STATUS.md).

- Fixed: Vercel cron jobs returned 405 on every run — the WhatsApp outbox was never drained
- Fixed: signup, login and the magic-link callback (nobody could create an account)
- Fixed: the authenticated area had no auth guard
- Added: per-tenant WhatsApp provisioning and per-tenant credential resolution
- Added: human escalation with operator notification and customer acknowledgement
- Added: transactional email, `fetchWithTimeout`, tenant-editable AI persona with immutable safety rules
- Added: 56 Playwright E2E tests
- Removed: every unverifiable public claim (fabricated ratings, case studies, uptime, admin metrics)
- Security: 7 high-severity dependency vulnerabilities → 0 in production

## 🔜 Next — v0.3 (target Q4 2026)

Focus: proving what is currently only asserted.

- [ ] **Tenant isolation proven in CI** — seed two tenants against real Supabase, assert A cannot read B. Highest priority: RLS exists on all 22 tables but is never exercised at runtime
- [ ] **Test fakes that record `eq` arguments**, so removing a `tenant_id` filter turns a test red
- [ ] **Sentry** with source maps and release tracking, plus an outbox watchdog
- [ ] **Data retention job**, matching the 24-month retention the privacy policy states
- [ ] **Resource/operator entity** — a practice with two chairs cannot be modelled today
- [ ] **Team invitations** — one tenant currently means one user forever
- [ ] **AI generation moved out of the webhook** into a dedicated outbox job
- [ ] **Prompt caching** and a per-tenant AI cost ceiling
- [ ] **Prompt injection defences** and a much larger AI evaluation set
- [ ] **Cross-tenant admin panel** on top of a tested `src/server/admin/` service
- [ ] **Executable self-hosting** — Compose currently has no scheduler and the bundled Valkey cannot serve the Upstash REST client
- [ ] **OpenAPI spec** auto-generated from the Zod schemas
- [ ] More verticals: legal practices, veterinary clinics, real estate, automotive

## 🔮 Future — v1.0 and beyond

Bigger bets that need design + community feedback.

- [ ] **Voice-to-voice end-to-end** — keep the entire booking conversation in voice mode (fast STT → fast LLM → fast TTS pipeline, target <2s round-trip)
- [ ] **Multi-language conversations** — Spanish, French, German support out of the box
- [ ] **Calendly / Acuity migration helper** — import existing customers, services, availability rules
- [ ] **Public partner API** — third-party integrations can read appointments + push messages with API key auth
- [ ] **Embeddable widget** — drop-in `<script>` tag for websites that want to show a "Book via WhatsApp" CTA
- [ ] **Native mobile app** for tenant owners (notifications, escalation handling) — likely Expo + React Native
- [ ] **Billing alternatives** — Paddle, Lemon Squeezy, Polar for non-Stripe regions
- [ ] **Alternative LLMs** — Mistral, Llama, Gemini support via abstracted adapter
- [ ] **No-code AI personality builder** — UI for editing prompts without writing code

## 💡 Community wishlist

Open issues with the `idea` label to add to this list. Top-voted ideas get prioritised.

- "Migration script from Lovable / Bookedin / Cal.com data export"
- "Telegram + Instagram DM channels (same intent classifier)"
- "Built-in cookie consent banner (CMP)"
- "FastAPI port for teams that prefer Python"
- "Plausible Analytics integration with proper CSP"

## 🚫 Out of scope

To stay focused, we explicitly won't do:

- ❌ **Unofficial WhatsApp clients** (Baileys, scraped APIs). Meta's Cloud API only.
- ❌ **PMS / EMR replacement**. We integrate with calendars, we don't replace dedicated practice management software.
- ❌ **Crypto / Web3 features**. Not relevant to this audience.
- ❌ **Closed-source plugins ecosystem**. If something is core, it ships in the main repo. Forks can add proprietary plugins as they wish.

## How to influence the roadmap

1. **React with 👍 on GitHub issues** for features you want
2. **Open new issues** with the `idea` label
3. **Submit PRs** — we'll prioritise reviewing PRs over implementing wishlist items ourselves
4. **Sponsor on GitHub** — sponsors get priority on feature requests

## Versioning

We follow [Semantic Versioning](https://semver.org). Until v1.0, breaking changes can happen on minor versions (0.x → 0.y) but will be flagged in CHANGELOG.md and announced in release notes. After v1.0, we'll respect strict semver.
