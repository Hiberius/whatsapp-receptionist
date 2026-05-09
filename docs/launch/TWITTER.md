# Twitter/X launch thread

**Post**: same day as HN, 30 min after HN post goes up. Tag @AnthropicAI, @vercel, @supabase to maximise reach.

## Thread (8 tweets)

### Tweet 1 — Hook

```
I just open-sourced the AI receptionist I built for Italian SMBs.

35 pages.
37 API routes.
369 tests.
Multi-tenant Supabase RLS.
GDPR Art. 15/17 endpoints.
Italian SDI invoicing.
Full Anthropic Claude orchestration.

MIT licensed. 🇮🇹

🔗 github.com/Hiberius/whatsapp-receptionist
```

(attach: `docs/screenshots/social-preview.png`)

### Tweet 2 — What it does

```
2/

It receives WhatsApp messages and voice notes from your customers, understands intent, books real appointments on Google Calendar, sends confirmations, and escalates to a human only when needed.

Setup in 30 minutes. Self-hostable. No SaaS lock-in.
```

### Tweet 3 — Stack

```
3/

Stack:
• Next.js 15 + React 19
• TypeScript 5.9 strict (every flag)
• Supabase EU + Drizzle ORM
• Anthropic Claude Opus 4.7 Max
• ElevenLabs (STT + TTS)
• Stripe + Italian SDI (Fatture in Cloud)
• Upstash Redis EU
• Pino with PII redaction

Production-ready Dockerfile included.
```

(attach: stack diagram or hero)

### Tweet 4 — Security & GDPR

```
4/

Security and GDPR are not afterthoughts.

→ CSP nonce middleware per request
→ HSTS, COEP/COOP/CORP, X-Frame-Options DENY
→ Webhook signatures verified timing-safe
→ Article 15 (export) + Article 17 (delete) endpoints
→ Audit log immutable
→ EU-only hosting

Built for European SMBs from day one.
```

### Tweet 5 — Multi-tenant

```
5/

Multi-tenant by default with Postgres Row-Level Security on every table.

Even if app code forgets to filter by tenant_id, the database returns nothing. RLS is the security boundary.

`npm run db:lint` verifies coverage. CI fails if a migration adds a table without RLS.
```

### Tweet 6 — Why open source

```
6/

Why open source?

The AI receptionist space is dominated by closed SaaS charging €100+/month per location. European SMBs deserve a self-hostable, GDPR-native option.

Open-sourcing forces honesty: no hidden tricks, no telemetry, no "premium tier" lock-ins.

Fork it commercially. MIT.
```

### Tweet 7 — Built with

```
7/

Half of this code was written in pair with @AnthropicAI Claude Code.

It's the most leveraged way I've ever shipped: human design decisions, AI implementation, both reviewing each other.

There's a CLAUDE.md in the repo root that primes any fork to keep going at the same pace.
```

### Tweet 8 — CTA

```
8/

If you build SaaS for European SMBs, you might find this useful as a starter kit.

If you're a dev, fork it and break it.

If you're curious about Italian B2B fiscal compliance done right, the SDI integration alone is worth a look.

⭐ github.com/Hiberius/whatsapp-receptionist

🇮🇹
```

## Tags & mentions strategy

Per tweet 1 (most important):
- @AnthropicAI (powers the AI)
- @vercel (hosting)
- @supabase (DB)

Don't tag too many — looks spammy. Reserve mentions for relevant tweets in the thread.

## Hashtags (use sparingly)

In the last tweet only: `#opensource #saas #nextjs #italianTech`

## Visual assets

- `docs/screenshots/social-preview.png` (1280×640) — for tweet 1
- `docs/screenshots/landing-1280.svg` (convert to PNG for tweet 2)
- `docs/screenshots/dashboard-1280.svg` (convert to PNG for tweet 5)

## Post-tweet engagement

- Quote-RT replies that add value
- Pin the thread on your profile for 1 week
- DM key contacts (Italian dev community, EU SaaS founders)
