# Hacker News — Show HN draft

**When to post**: Tue / Wed / Thu, 8:00–10:00 AM ET (= 14:00–16:00 Europe/Rome)

**Why this slot**: HN traffic peaks during US morning hours; mid-week posts get the longest tail. Avoid Mondays (catching up) and Fridays (short attention).

## Title (80 chars max)

```
Show HN: WhatsApp Receptionist – Open-source AI booking agent (Next.js + Claude)
```

Alternative titles to A/B if first doesn't catch:

- `Show HN: I open-sourced an AI WhatsApp receptionist with full GDPR endpoints`
- `Show HN: WhatsApp Receptionist – multi-tenant SaaS starter with Italian SDI invoicing`

## URL

```
https://github.com/Hiberius/whatsapp-receptionist
```

## Body (200 words target)

```
I just open-sourced the AI receptionist I built for Italian SMBs.

It receives WhatsApp messages and voice notes, understands intent with Claude Opus 4.7 Max, books real appointments on Google Calendar, sends confirmations, and escalates to a human only when needed. Crafted in Italy with GDPR Article 15 + 17 endpoints baked in, plus Italian SDI electronic invoicing for B2B compliance.

Tech: Next.js 15 + React 19 + TypeScript strict + Supabase RLS + Anthropic Claude + ElevenLabs voice + Stripe + Upstash Redis. 369 tests passing, production-ready Dockerfile, full CI.

What's inside:
- 35 frontend pages (landing, pricing, 4 verticals, dashboard, admin)
- 37 API routes with Zod validation
- 21 Supabase tables with full Row-Level Security
- Multi-tenant by default, ready for SaaS or agency white-label

Why open source: the AI receptionist space is dominated by closed SaaS charging €100+/month per location. European SMBs deserve a self-hostable, GDPR-native option. MIT licensed, fork commercially without asking.

Repo: https://github.com/Hiberius/whatsapp-receptionist
Architecture deep-dive: https://github.com/Hiberius/whatsapp-receptionist/blob/main/docs/ARCHITECTURE.md

Happy to answer questions about the AI orchestration, the GDPR endpoints, or why I chose Supabase RLS over a custom permissions layer.
```

## Engagement plan (first 4 hours = critical)

- Be online for the first 2 hours after posting. Respond to every comment within 15 minutes.
- Answer technical questions in detail, not marketing-speak.
- If someone says "this is just a wrapper around Claude", explain the orchestration: intent classifier, booking extractor, fallback rules, audit logging, RLS.
- If someone challenges the "Italian SDI" angle as too niche, explain it's a feature most international competitors don't have and that EU sovereignty is increasingly important.
- DON'T self-promote in comments. Let the project speak.

## After HN

- If you hit front page (top 30): expect 500–2000 stars in 24 hours
- If you stay on page 2: expect 100–300 stars
- Either way: monitor issues, respond fast, add a `awesome-mention` to README acknowledging the HN traffic
