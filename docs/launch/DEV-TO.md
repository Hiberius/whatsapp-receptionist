# dev.to article — full draft

**Title**: I Open-Sourced an AI WhatsApp Receptionist Built for Italian SMBs — Here's the Architecture

**Tags**: `nextjs`, `opensource`, `ai`, `saas`

**Cover image**: `docs/screenshots/social-preview.png`

**Canonical URL**: blank (let dev.to be primary), or set to `https://github.com/Hiberius/whatsapp-receptionist#readme`

**Publish day**: same week as HN, post on the day HN starts to fade (Friday).

---

## Article body

```markdown
After three weeks of compressed engineering, I open-sourced a production-ready AI WhatsApp receptionist for European SMBs. MIT licensed, multi-tenant, GDPR-native.

Here's why I built it, what's inside, and the architecture decisions that mattered.

> 🔗 **Repo**: https://github.com/Hiberius/whatsapp-receptionist
> ⭐ Star it if you find this useful

## The pitch in one sentence

A self-hostable AI receptionist that receives WhatsApp messages and voice notes from your customers, understands intent with Anthropic Claude, books real appointments on Google Calendar, and escalates to a human only when needed.

## Why open-source instead of launching as SaaS?

I'll be direct: I had built the whole thing planning to launch as SaaS for Italian SMBs (dentists, estheticians, fitness studios, professional offices). Then I did the math.

- Meta WhatsApp Business approval takes 1–3 weeks per tenant. That's 1–3 weeks of friction before customers see value.
- Italian SMBs are slow to adopt AI. Sales cycle is 60–90 days.
- Pricing power is limited. €100/month is the ceiling, even for studios making €30k/month.
- Existing closed competitors (Bookedin, Calendly, others) have years of sales infrastructure.

The unit economics work. The acquisition is brutal. So I open-sourced it as a portfolio piece + community resource.

If anyone forks it commercially and succeeds where I gave up, that's fine. MIT.

## What's inside

- **35 frontend pages** — landing, pricing, 4 vertical pages, blog, help center, dashboard with 5 sections, admin panel with 6 sections, 5 legal pages
- **37 API routes** with Zod validation, three auth strategies (session / internal secret / webhook signature)
- **21 Supabase tables** with full Row-Level Security
- **Anthropic Claude orchestration** — intent classification, booking extraction, fallbacks
- **WhatsApp Cloud API integration** — text + voice via ElevenLabs STT/TTS
- **Google Calendar OAuth** with conflict detection
- **Stripe Subscriptions** + **Italian SDI electronic invoicing** via Fatture in Cloud
- **GDPR Article 15 + Article 17 endpoints** with audit log + 30-day grace period
- **CSP nonce middleware**, HSTS, COEP/COOP/CORP, timing-safe webhook signatures
- **Pino structured logging** with automatic PII redaction
- **369 tests passing** — unit + integration + smoke
- **Production-ready Dockerfile** + docker-compose
- **CI workflow** — typecheck + lint + tests + build + gitleaks

## Architecture: three layers, one rule

```
src/
├── app/        ← routing (Next.js App Router) — THIN
├── lib/        ← infrastructure (auth, db, errors, security, logging)
└── server/     ← domain services (factory + dependency injection)
```

**The rule**: routes parse with Zod, call a server service, return a typed response. Nothing else. If you find domain logic in `app/api/`, that's a smell.

This sounds basic, but I've seen too many Next.js codebases where API route handlers grow into 300-line monsters mixing validation, auth, business logic, and database queries. Hard to test, hard to refactor, hard to change.

By keeping routes thin, every server service becomes a factory:

```typescript
export interface BookingService {
  createBooking(input: BookingInput): Promise<Booking>;
  // ...
}

interface BookingServiceConfig {
  db: DatabaseClient;
  calendar: CalendarProvider;
  notifier: BookingNotifier;
}

export function createBookingService(config: BookingServiceConfig): BookingService {
  return new BookingServiceImpl(config);
}
```

Tests inject fakes. No mocking framework needed. No `jest.mock("./db")` magic. Just plain dependency injection.

## Multi-tenancy via Row-Level Security

Every table has a `tenant_id` column with a Postgres RLS policy:

```sql
CREATE POLICY conversations_tenant_isolation ON conversations
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

**Even if application code forgets to filter by `tenant_id`, the database returns nothing.** RLS is the security boundary. Application code is the convenience layer.

The `npm run db:lint` script parses every migration and verifies:
- Every `CREATE TABLE` has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- Every table has at least one `CREATE POLICY` referencing it

CI fails if a migration adds a table without RLS. This is the most important pre-commit check in the entire project.

## AI orchestration: not just a wrapper

A common HN-style criticism of any AI product is "this is just a wrapper around Claude". For an orchestrator like this, that's wrong. The wrapper IS the value:

1. **Intent classifier** — rule-based first (regex for "urgent", "emergency"), Claude second. Falls back fast on common patterns to save tokens.
2. **Booking extractor** — structured extraction with Zod schema validation. If Claude returns malformed JSON, we retry with a tighter prompt before giving up.
3. **Fallback logic** — when Anthropic API returns 5xx or hits rate limits, we have a configurable fallback path (OpenAI configured but disabled by default).
4. **Audit logging** — every AI decision is logged with the prompt, the response, the confidence score, and the action taken. GDPR-friendly + debuggable.
5. **Escalation rules** — confidence threshold, urgency keywords, "I want to speak to a human" trigger words, conversations open >24h. All configurable per tenant.

The actual model call is maybe 20% of the AI module. The other 80% is everything around it.

## GDPR endpoints — actual ones, not "GDPR-ready"

Most products that claim "GDPR-ready" mean "we wrote a privacy policy". This codebase has actual endpoints:

- `GET /api/tenant/export` — data export per Article 15. Aggregates everything from 21 tables filtered by tenant_id, returns JSON.
- `DELETE /api/tenant/account` — soft delete with 30-day grace period (you can restore). After grace, a daily cron hard-deletes.
- `POST /api/customers/[phone]/export` — same for end-customer data (the people who chat with the bot).
- `DELETE /api/customers/[phone]` — immediate end-customer deletion.

Every action writes to an immutable `audit_log` table. The cron job that runs hard-deletes is rate-limited and logged.

## Italian SDI electronic invoicing

If you're building B2B SaaS in Italy, you need electronic invoicing through SDI (Sistema di Interscambio). Most international SaaS tools don't have it. Even Stripe's invoicing isn't compliant out-of-the-box for Italian B2B.

This codebase integrates Fatture in Cloud's API to generate compliant SDI invoices automatically:

```typescript
const result = await sdiService.createElectronicInvoice({
  tenantId,
  customer: { /* P.IVA, SDI code, address */ },
  lines: [{ description, quantity, unitPrice, vatRate: 22 }],
  paymentMethod: 'card',  // mapped to MP08
});
```

Payment methods are mapped to SDI codes: `MP08` (carta), `MP19` (SEPA), `MP05` (bonifico).

If you're building anything in Italy, this alone might save you a week of integration work.

## Tech stack — and why each choice

- **Next.js 15** — App Router, Server Components, edge middleware. Mature enough.
- **React 19** — async server components, concurrent rendering, no client-side state surprises.
- **TypeScript 5.9 strict** — `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`. Zero `any` in src/.
- **Supabase EU** — managed Postgres in Frankfurt with RLS native. Best multi-tenant story in the managed-database space.
- **Drizzle ORM** — type-safe, lightweight, no N+1 footguns. Better than Prisma for performance.
- **Anthropic Claude Opus 4.7 Max** — best-in-class tool use, prompt caching, predictable latency.
- **ElevenLabs** — best Italian voice quality. Bar none.
- **Meta WhatsApp Cloud API** — official only. Never use Baileys or scraped clients in production.
- **Upstash Redis EU** — edge-friendly, distributed rate limiting.
- **Pino** — structured JSON logging with automatic redact. The standard for Node.js services.

## Setup in 30 minutes

```bash
git clone https://github.com/Hiberius/whatsapp-receptionist.git
cd whatsapp-receptionist
./scripts/setup.sh    # interactive env wizard
npm run dev
```

Interactive wizard asks for env vars one by one with links to where to find each (Supabase URL, Anthropic key, etc.). Skip-able for local dev.

For production, see [docs/DEPLOYMENT.md](https://github.com/Hiberius/whatsapp-receptionist/blob/main/docs/DEPLOYMENT.md). Vercel + Supabase + Cloudflare DNS + Meta WhatsApp Business approval.

The Meta approval is the bottleneck. Plan 1–3 weeks for that.

## What's next

See [ROADMAP.md](https://github.com/Hiberius/whatsapp-receptionist/blob/main/docs/ROADMAP.md). Top items:
- Playwright E2E tests for critical flows
- Direct Meta HMAC SHA-256 webhook verification
- Sentry integration with proper release tracking
- Voice-to-voice end-to-end (no text intermediate)
- More verticals (legal, veterinary, real estate)

## Contributing with Claude Code

There's a `CLAUDE.md` at the repo root that primes Claude Code for the project. If you fork it and want to keep building, just run `claude` in the repo and it picks up the conventions, suggested workflow, and security-critical paths.

Half of this codebase was written in pair with Claude Code over three weeks. It's the most leveraged way I've ever shipped.

## What I want from you

⭐ **Star the repo** if it's useful. It's how I know to keep building.
🐛 **Open issues** for bugs or feature requests.
🤝 **Contribute** — see CONTRIBUTING.md, there's a whole section on Claude Code workflows.
🍴 **Fork it commercially** — MIT, no attribution required (but appreciated).

## TL;DR

**Repo**: https://github.com/Hiberius/whatsapp-receptionist
**License**: MIT
**Stack**: Next.js 15 + Supabase + Anthropic Claude + WhatsApp Cloud API
**Author**: [@hiberius](https://github.com/Hiberius) — Crafted in Italy 🇮🇹

If you build SaaS for European SMBs, this might save you 3 weeks.
```

## Engagement after publish

- Share on Twitter linking to the dev.to URL (different from the repo URL — dev.to algorithms reward external traffic)
- Cross-post to Hashnode if you have an audience there
- Submit to Hacker Newsletter, Bytes.dev, JavaScript Weekly via their submission forms
- Email Italian dev influencers (Marco Cedaro, Andrea Saltarello, Luca Mezzalira, Michele Riva)

## Long-tail SEO

- The article will rank on Google for "open source AI receptionist", "WhatsApp AI booking", "Next.js multi-tenant SaaS template", "Italian SDI invoicing API"
- Add internal links to other dev.to articles you write later
- Update the article with stars count after 30 days for fresh signals
