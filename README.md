<div align="center">

# AI Scheduling Advisor

### Explainable appointment scheduling with deterministic ranking and auditable decisions

**Portfolio extension of the MIT-licensed [Hiberius/whatsapp-receptionist](https://github.com/Hiberius/whatsapp-receptionist) project.**

The WhatsApp receptionist application underneath — transport, AI reply orchestration, booking
engine, Google Calendar, auth, Supabase multi-tenancy, dashboard, billing, GDPR — is upstream work
by Christian Calabrò. This fork adds a deterministic, explainable slot ranker and an auditable
scheduling decision ledger on top of it. Full breakdown: [`ATTRIBUTION.md`](ATTRIBUTION.md).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9_strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Anthropic Claude](https://img.shields.io/badge/Anthropic-Claude-D97757?logo=anthropic)](https://anthropic.com)
[![Tests](https://img.shields.io/badge/tests-579%20+%2056%20E2E-brightgreen)](#quality-gate)
[![Production vulnerabilities](https://img.shields.io/badge/prod%20vulnerabilities-0-brightgreen)](docs/SECURITY-AUDIT-NOTES.md)

[What this fork adds](#what-this-fork-adds) · [Quickstart](#quickstart) · [Slot ranking](#deterministic-slot-ranking) · [Attribution](ATTRIBUTION.md) · [Upstream project](https://github.com/Hiberius/whatsapp-receptionist) · [Italiano 🇮🇹](README.it.md)

</div>

---

## What this fork adds

Upstream already books appointments end to end. What it does not do is explain *why* it offered the
three slots it offered, or leave anything behind that an auditor could read afterwards. That is the
gap this fork fills.

**Inherited upstream flow**

```
WhatsApp message
  → intent extraction
  → availability lookup
  → booking slots
  → confirmation
  → appointment write
```

**Portfolio extension, inserted at the slot-proposal seam**

```
available candidate slots
  → deterministic scoring
  → structured reasons
  → stable ranking
  → top 3
  → scheduling decision ledger
  → existing confirmation flow (unchanged)
```

**The LLM does not determine ranking.** The model extracts a structured booking request from the
message; ordering the candidate slots is a pure function of that request plus an injected reference
time. No network, no database, no clock read, no model call. Same inputs, same order, every time —
whatever order the candidates arrive in.

The ranking signals actually implemented:

- **requested date match** — the date window the extractor parsed from the message
- **time preference match** — the requested day part (morning / afternoon / evening / explicit hour)
- **explicit-hour proximity** — distance from an "at 15" / "after 15" request
- **earliest suitable availability** — how soon the slot is, relative to the reference time

Current scope, stated plainly:

- **Initial booking proposals: ranked** and recorded in the ledger.
- **Reschedule proposals: not yet ranked** — that flow still offers the first three available slots,
  unranked and unrecorded.

Ranking is off by default and gated behind `SCHEDULING_RANKING_ENABLED`. Details, weights and
tie-breaking rules: [Deterministic slot ranking](#deterministic-slot-ranking).

---

## Inherited vs. added

| Inherited from upstream | Added in this fork |
|---|---|
| WhatsApp message flow, voice pipeline, outbox | Deterministic `rankSlots()` pure function |
| AI reply orchestration and intent routing | Structured, per-signal scoring reasons that sum to the score |
| Google Calendar OAuth and free/busy | Stable tie-breaking (score → start time → slot identity) |
| Booking availability engine | `scheduling_decisions` ledger with RLS, written fail-open |
| Confirmation and appointment write flow | `SCHEDULING_RANKING_ENABLED` feature flag and its integration seam |
| Supabase multi-tenancy, auth, RLS infrastructure | Ranking unit, golden and determinism regression tests |
| Dashboard, Stripe billing, GDPR endpoints | Portfolio documentation and attribution |

Nothing in the left column was authored here. The extension is additive and reversible: with the
flag off — the default — the booking flow behaves exactly as upstream does.

---

## The base application (inherited)

Everything in this section is the upstream project, described as it stands. It is the platform the
scheduling extension plugs into, not work claimed here.

A customer sends a WhatsApp message — text or voice note — at 22:40 on a Sunday. The AI understands
what they want, checks the real availability on your calendar, books the appointment, and confirms
it. When the message needs a person instead, it escalates to you and tells the customer someone is
coming.

- **Receives WhatsApp messages and voice notes**, around the clock
- **Understands intent and books real appointments** on Google Calendar, with confirmations and reminders
- **Hands off to a human** when a guardrail fires or the customer asks — the conversation flips state, you get an email, the customer is told
- **Multi-tenant**: each tenant connects its own WhatsApp number and configures its own hours, services, knowledge base and assistant persona

<img src="docs/screenshots/landing-1280.png" alt="Landing page" width="100%" />

> The screenshots in this README are captured from the running application with
> `node scripts/capture-screenshots.mjs`. They are not mockups.

---

## Honest state of play (base application)

Most open-source READMEs describe the best version of the project. This one describes the actual
one. The table below covers the inherited application. The full breakdown, with the commands to reproduce every number, is in
**[docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md)**.

| Layer | State |
|---|---|
| Domain services (`src/server/`) | **Real.** Booking with availability and a GiST constraint against double-booking, Stripe subscription lifecycle, WhatsApp outbox with `FOR UPDATE SKIP LOCKED`, retry/backoff and dead-letter, webhook idempotency, Google Calendar OAuth, pgvector RAG, GDPR Art. 15/17. |
| Database (`supabase/migrations/`) | **Real.** 23 tables, RLS on every one, `timestamptz` throughout, money as integer cents. |
| Security primitives | **Real.** Stripe signature over the raw body, timing-safe secret comparison, HMAC-signed OAuth state bound to the tenant, AES-256-GCM for stored credentials, nonce-based CSP. |
| Self-service signup | **Working.** Register → magic link → `/auth/callback` → onboarding → dashboard, with auth guards on every authenticated segment. |
| Tenant dashboard | **Working.** Dashboard, conversations inbox with operator reply, calendar, billing, WhatsApp settings, business hours, services, AI persona, knowledge base — all reading live tenant data. |
| Multi-tenant WhatsApp | **Working.** Each tenant connects its own number. The API key is encrypted at rest and resolved per tenant at send time; a number cannot be claimed by a second tenant. |
| Human escalation | **Working.** Status change, operator email with context and a deep link, and an acknowledgement to the customer. |
| Background jobs | **Working.** Seven cron jobs, with a regression test tying `vercel.json` to the exported route handlers. |
| Data retention | **Working.** A daily job enforcing exactly the thresholds the privacy policy states, with a dry-run mode and a test that fails if code and policy diverge. |
| Alerting | **Partial.** A watchdog emails an alert when the outbound queue stops draining. No Sentry yet, so individual exceptions are logged but not aggregated. |
| Tenant isolation | **Partly proven.** Repository filters are covered by regression tests that fail when a `tenant_id` filter is deleted. RLS itself is still never exercised at runtime. **The most important open item.** |
| Cross-tenant admin panel | **Not wired.** Those reads bypass RLS and need a dedicated service with isolation tests. The screens say so rather than showing invented data. |

**41 frontend pages · 41 API routes · 23 tables · 579 unit and integration tests · 56 Playwright E2E
tests · production build verified · zero vulnerabilities in production dependencies.**

---

## Quickstart

```bash
git clone https://github.com/valencijdavid-ui/ai-scheduling-advisor.git
cd ai-scheduling-advisor
cp .env.example .env.local
npm ci
npm run dev
```

Open <http://localhost:3000>.

The marketing site, pricing, verticals, blog, help centre and legal pages render immediately with no
credentials at all. To reach the dashboard you need a Supabase project (free tier is enough) — the
rest of the integrations are optional and feature-gated: without an Anthropic key the AI simply does
not reply, without Resend the mailer logs instead of sending, and so on. Nothing throws because a
key is missing.

`./scripts/setup.sh` walks through the variables interactively. The full reference is in
[`.env.example`](.env.example), documented inline.

For production, see [`docs/deployment.md`](docs/deployment.md).

---

## Features

|     |     |
|-----|-----|
| **WhatsApp + voice** | Text and voice notes through the 360dialog Business API (an official Meta BSP) plus ElevenLabs speech-to-text. No Baileys, no scraped clients. |
| **Real bookings** | Google Calendar OAuth, availability from real business hours and services, database-level protection against double-booking, confirmations and reminders. |
| **Human escalation** | Guardrails on sensitive topics, explicit handoff requests, operator notification, and an acknowledgement to the customer so silence is never the answer. |
| **Editable AI persona** | Each tenant can rewrite the assistant's personality. Safety and output rules are composed around it and cannot be overridden. |
| **Knowledge base with RAG** | pgvector semantic retrieval over documents the tenant uploads — prices, cancellation policy, directions, FAQs. |
| **GDPR-native** | Art. 15 export and Art. 17 deletion endpoints, audit logging, automatic PII redaction in logs, EU hosting, and a retention job that enforces the published policy. |
| **Stripe + Italian SDI** | Subscriptions and Customer Portal, plus electronic invoicing for Italian B2B through Fatture in Cloud. |
| **Multi-tenant by construction** | Row Level Security on all 23 tables, per-tenant WhatsApp credentials, tenant-scoped everything. |

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15.5** App Router | Server Components, Route Handlers, middleware |
| Runtime | **React 19** + Node 22 | Async server components, concurrent rendering |
| Language | **TypeScript 5.9 strict** | `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, no `any` in `src/` |
| Database | **Supabase Postgres (EU)** | Managed Postgres, RLS native, pgvector. Migrations are hand-written SQL — deliberately, so the policies are readable. |
| Auth | **Supabase Auth** | httpOnly + secure + sameSite cookies, SSR-aware session |
| AI | **Anthropic Claude** | Model IDs are configuration (`ANTHROPIC_MODEL_PRIMARY` / `_FAST`), not hardcoded |
| Voice | **ElevenLabs** | Italian speech-to-text quality |
| Messaging | **360dialog Business API** | Official Meta BSP (`waba-v2.360dialog.io`) |
| Calendar | **Google Calendar OAuth** | Encrypted token storage, conflict detection |
| Billing | **Stripe** + **Fatture in Cloud** | Subscriptions, Customer Portal, Italian SDI invoicing |
| Rate limit | **Upstash Redis (EU)** | Named policies per endpoint |
| Logging | **Pino** | Structured JSON with automatic PII redaction |
| Testing | **Vitest 4** + **Playwright** | 579 unit/integration + 56 E2E |
| Tooling | **ESLint 9 flat** + **Prettier 3** + **Husky** | Pre-commit lint-staged, gitleaks in CI |

---

## Architecture

```
src/
├── app/
│   ├── (admin)/              super-admin cross-tenant panel
│   ├── (auth)/               login, register
│   ├── (dashboard)/          tenant dashboard — auth guard lives in the layout
│   ├── auth/callback/        magic-link landing, with open-redirect validation
│   ├── api/                  41 route handlers
│   ├── legal/                privacy, terms, DPA, cookie, security
│   ├── verticali/            marketing pages per vertical
│   └── page.tsx              landing
├── components/
│   ├── marketing/            Hero, Features, Verticals, Pricing, CTA
│   ├── dashboard/            shell, operator reply, knowledge documents
│   ├── settings/             WhatsApp connection, business hours, services, AI persona
│   └── forms/                useApiForm + FormFeedback, shared by every form
├── lib/
│   ├── api/                  jsonHandler, body parsing
│   ├── auth/                 session, guards, cookies, safe redirect
│   ├── health/               dependency probes, shared by /status and /api/health/deep
│   ├── http/                 fetchWithTimeout
│   ├── logging/              Pino with PII redaction
│   ├── rate-limit/           Upstash policies
│   ├── security/             CSP nonce, timing-safe comparisons, internal job auth
│   └── supabase/             server + admin clients
├── server/                   business logic — never imported by client components
│   ├── ai/                   adapter, intent router, booking extractor, prompt composition
│   ├── appointments/         booking, reminders, slot ranking, decision ledger
│   ├── billing/              Stripe + Fatture in Cloud
│   ├── conversations/        inbox, operator messages, escalation
│   ├── gdpr/                 Art. 15 export, Art. 17 delete, retention
│   ├── monitoring/           health watchdog
│   ├── notifications/        mailer + templates
│   └── whatsapp/             service, repository, outbox, provisioning, voice pipeline
└── middleware.ts             CSP nonce + COEP/COOP/CORP

supabase/migrations/          23 tables, RLS on every one
tests/                        579 unit + integration tests
e2e/                          56 Playwright tests
```

---

## Deterministic slot ranking

When a customer asks for an appointment, the bridge has to pick which three slots to offer. By
default it offers the first three the availability engine returns. Behind
`SCHEDULING_RANKING_ENABLED=true` it instead ranks the candidates it already has, and writes down
why.

**Where it applies.** The ranker currently runs on **initial booking slot proposals** only — the
three slots offered when a customer first asks for an appointment. It does **not** yet rank
**reschedule slot proposals**: when a customer moves an existing appointment, that flow still offers
the first three available slots, unranked and unrecorded. Deliberate, not an oversight — the seam is
the same shape and extending it is a small change, but it has not been made or tested here.

The ranker ([`src/server/appointments/slot-ranking.ts`](src/server/appointments/slot-ranking.ts)) is
a pure function: no database, no network, **no LLM**, and no reading of the system clock — the
reference time is injected. The same candidates always produce the same order, whatever order they
arrive in. Scores are integers, weights are explicit, and every slot carries structured reasons
whose points sum exactly to its score.

| Signal | Weight | Derived from |
|---|---|---|
| `requested_date_match` | 40 | the date window the extractor already parsed from the message |
| `time_preference_match` | 30 | the requested day part (morning / afternoon / evening / explicit hour) |
| `explicit_time_proximity` | up to 12, −4 per hour of distance | only for "at 15" / "after 15" requests — "before 15" is a limit, not a target |
| `earliest_availability` | 24, −8 per calendar day | the slot's own start time versus the reference time |

Ties break deterministically: score descending, then start time ascending, then a stable identity
derived from the slot's own fields. Nothing depends on input order.

Every ranked proposal is recorded in `scheduling_decisions` — the full candidate set in ranked
order, with scores and reasons, plus a templated explanation. The first three candidates *are* the
three offered, so there is no separate "selected" column to keep in sync. The write is fail-open: if
the ledger is unavailable the failure is logged and the customer still gets their slots.

What the ranker deliberately does **not** do: no technician routing, no customer history, no
no-show prediction, no revenue optimisation. Those need data that does not exist at this seam, and
inventing plumbing to fake them would be worse than leaving them out.

The ranker, its structured reasons, the decision ledger and their tests are portfolio additions on
top of the upstream MIT project — see [`ATTRIBUTION.md`](ATTRIBUTION.md).

---

## GDPR & security

Built for the European market, and the defaults reflect it.

- **Row Level Security on all 23 tables**, verified by `npm run db:lint`, which derives the table list from the migrations themselves rather than a hand-maintained allowlist
- **Webhook signature verification** with timing-safe comparison (Stripe over the raw body, WhatsApp shared secret)
- **Credentials encrypted at rest** with AES-256-GCM — OAuth tokens and per-tenant WhatsApp API keys
- **CSP nonce per request**, HSTS, COEP, COOP, CORP, `X-Frame-Options: DENY`
- **Automatic PII redaction** in logs: email, phone, fiscal code, VAT number, IBAN, tokens
- **Rate limiting** with named policies per endpoint
- **GDPR Art. 15 export and Art. 17 deletion** with audit logging
- **Data retention** enforced daily against the thresholds the privacy policy publishes
- **Zero vulnerabilities in production dependencies**, enforced by a CI gate. One dev-only advisory is knowingly accepted, with its reopening condition written down in [`docs/SECURITY-AUDIT-NOTES.md`](docs/SECURITY-AUDIT-NOTES.md)

**Known limitation, stated plainly:** server modules use the service-role client, which bypasses
RLS. Isolation currently rests on hand-written `tenant_id` filters, now covered by regression tests
that fail when a filter is removed — but the policies themselves are never exercised at runtime.
Proving isolation against a real Postgres in CI is the top priority for v0.3.

---

## Quality gate

```bash
npm run verify   # typecheck + lint + 579 tests + RLS coverage
npm run build    # production build
npm run test:e2e # 56 Playwright tests, no credentials required
```

CI runs six jobs on every pull request: **verify**, **coverage**, **production build**,
**E2E**, **secret scan (gitleaks)** and **production dependency audit**. The secret scan and the
audit are blocking — a gate that cannot fail is not a gate.

A note on the build: `npm run verify` does **not** include it, and `next build` catches things
`tsc --noEmit` cannot, such as invalid exports from a `route.ts`. Run both.

---

## Screenshots

| | |
|---|---|
| Pricing | <img src="docs/screenshots/pricing-1280.png" alt="Pricing page" width="100%" /> |
| Vertical (dental) | <img src="docs/screenshots/dental-1280.png" alt="Dental vertical page" width="100%" /> |
| Service status | <img src="docs/screenshots/status-1280.png" alt="Status page with live dependency probes" width="100%" /> |
| Landing (mobile) | <img src="docs/screenshots/landing-mobile.png" alt="Landing page on mobile" width="45%" /> |

The status page runs real probes against Supabase, Upstash, Stripe and Anthropic at request time. It
deliberately publishes no historical uptime percentage, because nothing measures one yet.

Authenticated screens are not shown here: capturing them would need a tenant with real
conversations, and filling them with invented data is exactly what this project spent a release
removing.

---

## A note on branding

**AI Scheduling Advisor** is the identity of *this repository* — the portfolio work described at the
top. The running application has deliberately **not** been rebranded: it still ships upstream's
**Ambrogio.ai** product identity — copy, logo, Italian marketing pages — and upstream's naming for
database entities, environment variables, API routes and source modules. Mass-renaming a codebase
you did not write is noise, not contribution, so this pass changed repository and documentation
identity only.

Everything user-facing is yours to replace: strings live in the marketing components and
`NEXT_PUBLIC_APP_NAME`, and the design tokens are in `src/styles/tokens.css`.

The interface language is Italian. English translation is not done.

---

## Is this for you?

**A good fit if** you want to self-host an AI receptionist, you are building a booking SaaS and want
a multi-tenant foundation with RLS and Stripe already wired, or you are looking for a substantial
real-world Next.js 15 + Supabase codebase to learn from.

**A poor fit if** you want something that works out of the box without configuring WhatsApp
Business, if you need a language other than Italian today, or if you need cross-tenant
administration — that panel is not wired.

---

## Why the base project exists

In the upstream author's words: there are AI chatbots and there are booking systems, and nothing
combined them with European GDPR rigour and Italian B2B fiscal compliance. Upstream started as a
real deployment for a clinic and became the thing that was missing.

Version 0.2 was rebuilt with **Claude Opus 5 in ultracode mode** — Anthropic's multi-agent
orchestration. An eight-dimension audit where every auditor was followed by an adversarial verifier
instructed to refute its findings, then parallel implementation workflows. Roughly a third of the
initial findings were refuted or downgraded once a second agent tried to disprove them by reading
the actual files, which is precisely how single-pass AI review fails. The gravest findings were
still verified by hand before anything changed.

What that process found, and what it deliberately left alone, is published in full:
[`docs/audit/2026-07-27-audit-prodotto.md`](docs/audit/2026-07-27-audit-prodotto.md).

If you fork it commercially that is entirely fine — MIT means MIT. Just don't claim you wrote it
from scratch.

---

## Roadmap

Next up, in priority order:

1. **Tenant isolation proven against a real database** — seed two tenants in CI and assert A cannot read B through the RLS policies themselves
2. **Sentry** with source maps and release tracking
3. **Resource and team entities** — a practice with two chairs cannot be modelled today, and one tenant means one user forever
4. **AI generation moved out of the webhook** into a dedicated outbox job
5. **Prompt caching** and a per-tenant AI cost ceiling
6. **Cross-tenant admin panel** on a tested service
7. **Prompt injection defences** and a much larger AI evaluation set

Full list, including longer-term bets: [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## Contributing

Pull requests welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md).

The repository is primed for [Claude Code](https://claude.com/claude-code): `CLAUDE.md` and
`AGENTS.md` carry the project's conventions, so an agent opening this repo starts with the right
context.

Two house rules worth knowing before you open a PR:

1. **Run `npm run verify` and `npm run build`.** Verify does not include the build.
2. **Don't add a claim the code cannot back.** If a number appears in the README or the UI, it must be reproducible. This project removed an entire layer of invented metrics in 0.2.0 and would rather not grow another.

---

## License

MIT © [Christian Calabrò](https://github.com/Hiberius) — see [`LICENSE`](LICENSE).

Portions of this repository are portfolio extensions built on top of that original work; see
[`ATTRIBUTION.md`](ATTRIBUTION.md).

---

<div align="center">

**AI Scheduling Advisor** — a portfolio extension by [@valencijdavid-ui](https://github.com/valencijdavid-ui).

Built on [whatsapp-receptionist](https://github.com/Hiberius/whatsapp-receptionist), made in Italy by
Christian Calabrò ([@Hiberius](https://github.com/Hiberius)). If the base project saved you time,
[star it](https://github.com/Hiberius/whatsapp-receptionist).

</div>
