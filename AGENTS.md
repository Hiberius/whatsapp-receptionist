# AGENTS.md — whatsapp-receptionist

Onboarding guide for AI coding agents (Claude Code, Codex, Cursor, etc.) working on this codebase.

## Read First

Before making any changes, read:

1. `README.md` — project overview and quick start
2. `docs/architecture/backend-foundation.md` — backend modules and patterns
3. `docs/memory/project-memory.md` — consolidated project decisions and state
4. `docs/handoff/frontend-contract.md` — API contracts for frontend components
5. `SECURITY.md` — security model and disclosure policy

## Project Identity

- **Package name:** `whatsapp-receptionist`
- **Product:** AI receptionist SaaS, WhatsApp-first, for professional studios and SMBs
- **Stack:** Next.js 15 App Router, Supabase (Postgres + RLS + Storage), Anthropic Claude, ElevenLabs, Stripe, Upstash Redis
- **Auth:** Supabase Auth with custom `app_metadata` claims (`tenant_id`, `role`)

## Non-Negotiable Rules

- Never put secrets or service role keys client-side or in NEXT_PUBLIC_ variables
- Never skip RLS policies on new Supabase tables — every table must have them
- Never hardcode API keys, model IDs, or price IDs — use env vars via `src/lib/env.ts`
- Never put business logic inside API routes: route → service → repository → test
- Never run `npm run verify` in parallel with `npm run build` (Next.js types race condition)
- Use Node `>=22 <23` in CI and local development

## Verification Commands

```bash
npm run typecheck          # TypeScript strict check
npm run lint               # ESLint (max-warnings=60)
npm run test               # Vitest unit + integration tests
npm run db:lint            # RLS coverage check on all migrations
npm run verify             # typecheck + lint + test + db:lint
npm run build              # Production build
npm audit --audit-level=moderate  # Dependency security
```

## Architecture Pattern

```
API route (thin)
  → service (business logic, DI constructor)
    → repository (Supabase queries)
      → tested with fake repositories
```

All services and repositories are injected via constructor arguments for testability.

## Key Module Map

| Module | Location |
|--------|----------|
| Env parsing (Zod) | `src/lib/env.ts` |
| API response wrapper | `src/lib/api/json.ts` |
| App errors | `src/lib/errors/app-error.ts` |
| Logger (Pino + PII redaction) | `src/lib/logging/logger.ts` |
| Rate limiting | `src/lib/rate-limit/` |
| Auth session helpers | `src/lib/auth/session.ts` |
| WhatsApp service layer | `src/server/whatsapp/` |
| AI engine | `src/server/ai/` |
| Booking + calendar | `src/server/appointments/`, `src/server/calendar/` |
| Stripe billing | `src/server/billing/` |
| GDPR (export + delete) | `src/server/gdpr/` |
| Supabase migrations | `supabase/migrations/` |

## Documenting Changes

Add an entry to `docs/memory/agent-log.md` for every significant change. Format:

```markdown
## YYYY-MM-DD — Brief summary

- What was done
- Why it was done
- Verification results (npm run verify, build status, test count)
- Next recommended steps
```
