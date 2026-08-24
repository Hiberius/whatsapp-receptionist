# whatsapp-receptionist (Ambrogio.ai)

**Version:** 0.1.0 | **Port:** 3000 | **Stack:** Next.js 15 + Supabase + Anthropic + WhatsApp + Stripe + ElevenLabs + Upstash

## What

Multi-tenant AI receptionist SaaS. Each tenant (dentist, beauty studio, gym, professional firm) gets a WhatsApp number backed by an Anthropic-powered AI that handles inbound messages, transcribes voice notes via ElevenLabs STT, books appointments via Google Calendar, and escalates to a human operator when needed. Billing via Stripe Subscriptions.

## Quick Start

```bash
./scripts/setup.sh       # First-time interactive wizard (env + deps + migrations)
npm run dev              # Start dev server → http://localhost:3000
npm run verify           # Quality gate: typecheck + lint + test + db:lint
npm test                 # Run Vitest test suite (`npm run verify` is the source of truth)
```

## Commands

```bash
# Development
npm ci                   # Install dependencies (use ci, not install, for reproducibility)
npm run dev              # Next.js dev server (hot reload)
npm run build            # Production build (standalone output)
npm run start            # Start production build locally

# Quality
npm run typecheck        # TypeScript strict check (no tsbuildinfo cache)
npm run lint             # ESLint 9 flat config (max 60 warnings)
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier write
npm run format:check     # Prettier check (CI mode)
npm run verify           # All quality gates in sequence

# Testing
npm test                 # Vitest run (node env, tests/ directory)
npm run test:watch       # Vitest watch
npm run test:coverage    # Coverage with v8 provider → coverage/

# Database
npx supabase db push     # Apply migrations to connected Supabase project
npx supabase start       # Start local Supabase stack (requires Docker)
npm run db:lint          # Audit that every table has RLS enabled

# Security
npm run security:secrets # Gitleaks scan (requires gitleaks CLI)
```

## Architecture

```
src/
├── app/
│   ├── (admin)/          super-admin cross-tenant panel
│   ├── (auth)/           login, register (magic link + password)
│   ├── (dashboard)/      tenant dashboard: conversations, calendar, billing, settings
│   ├── api/              ~30 route handlers (thin: validate → service → respond)
│   ├── legal/            privacy, terms, DPA, cookie, security pages
│   └── page.tsx          marketing landing
├── components/
│   ├── marketing/        Hero, Features, Verticals, Pricing, CTA
│   └── dashboard/        DashboardShell, sidebar
├── lib/
│   ├── api/              jsonHandler wrapper, body parsing
│   ├── auth/             session helpers, super-admin check, cookie options
│   ├── errors/           AppError class (typed error codes + HTTP status)
│   ├── logging/          Pino logger with PII redaction (email, phone, fiscal code)
│   ├── rate-limit/       Upstash-backed policies (auth, onboarding, billing, GDPR)
│   ├── security/         CSP nonce generator, timing-safe secret comparison
│   └── env.ts            Zod-validated typed env (single source of truth)
├── server/               business logic — NEVER import in client components
│   ├── ai/               Anthropic adapter, intent router, booking extractor, reply orchestrator
│   ├── appointments/     booking service, reminder notifications, slot ranking, decision ledger
│   ├── billing/          Stripe subscriptions, Fatture in Cloud SDI
│   ├── calendar/         Google Calendar OAuth provider
│   ├── gdpr/             Art.15 export, Art.17 delete with audit_log
│   ├── whatsapp/         service, repository, outbox, voice pipeline, template sync
│   └── ...               conversations, knowledge-base, onboarding, settings, usage
├── styles/               tokens.css + globals.css (CSS custom properties)
└── middleware.ts          CSP nonce-based + COEP/COOP/CORP headers

supabase/migrations/      SQL migrations (RLS on every table — verified by `npm run db:lint`)
tests/                    unit + integration tests (vitest, node env)
scripts/                  setup wizard, seed dev data, RLS lint
```

Request path for an inbound WhatsApp message:
`POST /api/webhook/whatsapp` → webhook-security verify → `whatsapp/service.ts` → `ai/reply-orchestrator.ts` → `ai/intent-router.ts` → domain reply / booking bridge → `whatsapp/outbox.ts` → outbox job worker

## Key Files

```
src/lib/env.ts                          All env vars parsed via Zod — read this first
src/middleware.ts                        CSP nonce + COEP/COOP/CORP — do NOT modify lightly
src/lib/errors/app-error.ts             Typed error class used across all services
src/lib/api/json.ts                      jsonHandler() wrapper for all route handlers
src/server/ai/reply-orchestrator.ts     Top-level AI reply entry point
src/server/whatsapp/service.ts          WhatsApp inbound event dispatcher
src/server/billing/stripe-billing.ts    Stripe subscription lifecycle
supabase/migrations/                    Postgres schema + RLS policies — migration-only
.env.example                            Canonical list of all environment variables
vercel.json                             Cron job schedule for background jobs
```

## Configuration

All configuration is via environment variables. Copy `.env.example` → `.env.local`. Run `./scripts/setup.sh` for an interactive wizard.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for AI replies |
| `ANTHROPIC_MODEL_PRIMARY` | Yes | Model ID (e.g. `claude-opus-4-5`) |
| `ANTHROPIC_MODEL_FAST` | Yes | Fast model for intent classification |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis URL (rate limiting + queue) |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis token |
| `INTERNAL_JOB_SECRET` | Yes | Auth token for cron job routes (min 32 chars) |
| `WHATSAPP_API_KEY` | Prod | 360dialog API key |
| `WHATSAPP_WEBHOOK_HEADER_SECRET` | Prod | Shared secret for webhook verification |
| `STRIPE_SECRET_KEY` | Prod | Stripe secret key (`sk_test_...` for dev) |
| `STRIPE_WEBHOOK_SECRET` | Prod | Stripe webhook signing secret (`whsec_...`) |
| `ELEVENLABS_API_KEY` | Voice | ElevenLabs key for STT/TTS |
| `GOOGLE_OAUTH_CLIENT_ID` | Calendar | Google Cloud OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Calendar | Google Cloud OAuth client secret |

## Conventions

- **Route handlers are thin**: validate request with Zod → call a `server/` service → respond via `jsonHandler`. No business logic inside `app/api/`.
- **Factory + DI for services**: services accept injected dependencies (Supabase client, logger) for testability.
- **Zod everywhere**: every external input (env, request body, webhook payload, external API response) is parsed through a Zod schema before use.
- **No `any` in new code**: use `unknown` + narrowing or a typed Zod schema.
- **Immutable patterns**: spread over mutation everywhere.
- **Consistent type imports**: `import { type Foo }` (enforced by ESLint rule).
- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`.

## Coding Style

- ESLint 9 flat config: `eslint.config.mjs`
- Prettier: `singleQuote: true`, `semi: true`, `printWidth: 100`, `trailingComma: 'all'`
- Husky pre-commit: runs `lint-staged` (eslint --fix + prettier --write on staged files)
- TypeScript: strict mode + `exactOptionalPropertyTypes` (see `tsconfig.json`)

## Suggested Workflow with Claude Code

```bash
# 1. Pick an issue from GitHub Issues
# 2. Create a branch
git checkout -b feat/your-feature

# 3. Start Claude Code — reads this file automatically
claude

# 4. Develop with pair programming
# 5. Before committing, run the full quality gate
npm run verify

# 6. Commit following Conventional Commits
git commit -m "feat: add new calendar provider"

# 7. Open a PR
gh pr create --fill
```

## Common Tasks

**Add a new vertical (marketing page)**
- Add a page under `src/app/verticali/[slug]/page.tsx`
- Add SEO metadata in the page component
- Add the vertical to the `Verticals` component in `src/components/marketing/`

**Add a new API endpoint**
- Create `src/app/api/<resource>/route.ts`
- Use `jsonHandler()` from `src/lib/api/json.ts`
- Validate input with `parseBody()` + a Zod schema
- Call a service in `src/server/`
- Add a test in `tests/server/` or `tests/lib/`

**Add a new GDPR endpoint**
- Implement in `src/server/gdpr/`
- Write to `audit_log` table for all data access actions
- Add rate limiting via `src/lib/rate-limit/apply.ts`
- Register the route in `src/app/api/`

**Refactor a server service**
- Keep interface stable (other services and routes depend on it)
- Add/maintain tests in `tests/server/`
- Run `npm run verify` before committing

## Files NOT to Touch Without a Security Review

```
src/middleware.ts              CSP nonce generation + bypass logic
src/lib/security/              CSP builder, timing-safe comparisons
src/lib/stripe/webhook-security.ts   Stripe signature verification
src/lib/whatsapp/webhook-security.ts WhatsApp signature verification
src/lib/auth/                  Session handling, super-admin gating
supabase/migrations/           Database schema + RLS — only via new migration files
```

These files affect the security posture of the entire application. Changes require explicit reasoning and a passing test.

## Recommended MCP Servers

If you use MCP servers with Claude Code, these are useful for this project:

- **`@supabase/mcp-server-supabase`** — query your Supabase project directly from Claude
- **`context7`** — up-to-date Next.js 15, Supabase, and Anthropic SDK docs
- **`@upstash/context7-mcp`** — Upstash Redis and Ratelimit docs

## Questions and Contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.
Open questions and architectural discussions in [GitHub Discussions](https://github.com/Hiberius/whatsapp-receptionist/discussions).
