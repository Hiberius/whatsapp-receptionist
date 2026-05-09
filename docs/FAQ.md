# Frequently Asked Questions

## About the project

### Why open source?

Because the AI receptionist space is dominated by closed SaaS products charging €100+/month per location. Small studios in Italy and Europe deserve a self-hostable, GDPR-native option. Open-sourcing the codebase also forces it to be honest: no hidden tricks, no telemetry phoning home, no "premium tier" lock-ins of features that should be free.

### Why MIT license?

To maximise adoption and let people fork commercially. If you build a paid SaaS on top of this, that's fine — just don't pretend you wrote it from scratch. Attribution in the footer / about page is appreciated but not required by the licence.

### Is it really production-ready?

The code is. The setup is not zero-config. You need to:

1. Get Meta WhatsApp Business approval (1–3 weeks; this is on Meta, not us)
2. Provision Supabase, Stripe, Anthropic, ElevenLabs, Upstash accounts
3. Configure DNS, SSL, CSP, env vars
4. Have a DPO sign off on your Privacy Policy / DPA if you process EU data

Once those are done, the codebase has been built to handle production traffic: tested, observable, secure by default.

### Who built this?

Christian Calabrò ([@hiberius](https://github.com/Hiberius)) — performance marketer turned developer, based in Italy. The project was built as a real attempt to ship a SaaS for Italian SMBs, then open-sourced because the market is harder to monetise than expected and the code is more useful as a portfolio + community asset.

## Comparing to alternatives

### How is this different from Cal.com?

Cal.com is a brilliant booking platform but doesn't include AI. This project has AI baked in: it understands voice notes, classifies intent, hands off to humans only when needed. Cal.com is also primarily web-form-driven; this is WhatsApp-driven.

### How is this different from Calendly / Bookedin / Setmore?

Those are closed-source SaaS. They don't let you self-host, don't provide GDPR Art. 15/17 endpoints natively, and don't speak Italian B2B fiscal compliance (SDI). They charge per location. This is one repo for unlimited tenants.

### How is this different from a generic chatbot like Botpress / Rasa?

Generic chatbot frameworks give you the language model wiring. This gives you the entire vertical stack pre-tuned for booking flows: opt-out handling, escalation rules, calendar conflict detection, multi-tenant RLS, GDPR endpoints, Italian SDI. It's a finished product, not a framework.

## Setup and self-hosting

### Do I need WhatsApp Business approved?

Yes, if you want to use real WhatsApp. The Meta Business verification process takes 1–3 weeks and requires legal documentation. For local development you can use the Meta Cloud API sandbox numbers (free, limited).

### What's the cost to run this?

Rough estimate for **1 small tenant** (1 studio, ~500 conversations/month):

- Supabase: free tier (Hobby) — €0
- Vercel: free tier (Hobby) — €0
- Anthropic: ~€5–15/month (depends on conversation length)
- ElevenLabs: free tier or €5/month — €0–5
- Upstash: free tier — €0
- Stripe: % of transactions only
- Total: **€5–25/month**

For **100 tenants** (agency / multi-location):

- Supabase Pro: €25/month
- Vercel Pro: €20/user
- Anthropic with prompt caching: ~€100–300/month
- ElevenLabs Starter: €22/month
- Upstash Pay-as-you-go: €10–30/month
- Total: **€200–500/month**

### Can I deploy without Stripe?

Yes. The billing module is optional. Set the Stripe env vars to placeholders and the relevant routes will return 503. The rest of the app works normally.

### Can I use OpenAI instead of Anthropic?

A fallback adapter exists in `src/server/ai/`. Set `OPENAI_API_KEY` and edit `src/server/ai/llm.ts` to switch the primary provider. We recommend Anthropic Claude Sonnet for production because of its tool-use reliability and prompt caching.

### Is voice (ElevenLabs) optional?

Yes. If you don't set `ELEVENLABS_API_KEY`, voice messages will be received but not transcribed (the user gets a polite text fallback). Outbound voice replies are also disabled.

### Does this work without Supabase?

Not out of the box. Supabase is tightly integrated for Auth + Postgres + RLS + Storage. You could swap the auth layer and Postgres host for alternatives (Clerk + Neon, or self-hosted Postgres), but it's a non-trivial refactor. PRs for alternative backends are welcome.

### Italian-only?

No. Marketing copy is bilingual (`README.md` English, `README.it.md` Italian). All internal copy is English by default. Conversation language is auto-detected from the customer's WhatsApp message — Italian and English are both well-tuned, other languages work via Claude's multilingual capabilities.

## GDPR and compliance

### Does GDPR-ready mean I can use it in EU production?

The codebase implements technical measures: Art. 15 export endpoint, Art. 17 delete endpoint, audit logging, EU-only hosting, PII redaction in logs, encrypted OAuth tokens. **You still need**:

- A DPO assessment (or self-assessment if you're a small operator)
- A DPA signed with each B2B tenant
- A Privacy Policy approved by a privacy lawyer for your jurisdiction
- A Cookie Banner / Consent Management Platform if you add tracking
- Data Processing Register (ROPA)

The codebase makes compliance achievable but doesn't automate the legal work.

### Where is data hosted?

All defaults point to EU regions:

- Supabase: Frankfurt
- Vercel: `fra1` (Frankfurt)
- Upstash: EU region
- Anthropic: EU region available, configure during account setup
- ElevenLabs: EU available

Voice audio files in Supabase Storage are also EU-hosted.

### Are passwords ever stored?

No. The auth flow is password-less (magic link via email). Supabase issues short-lived JWTs in httpOnly cookies.

## Licensing and commercial use

### Can I sell a SaaS based on this?

Yes. MIT licence permits commercial use, modification, redistribution. You don't need our permission. Attribution is appreciated, not required.

### Can I white-label it for my agency?

Yes. The codebase already has white-label support in the Agency tier mock. You can rebrand the entire frontend and resell.

### Do I owe royalties?

No. MIT is unconditional.

## Contributing

### Do I need to be a TypeScript expert?

No. Many parts of the codebase are well-isolated and approachable. Documentation typos, copy improvements, translations, screenshot updates, and bug reports are all valuable.

### Can I use Claude Code to contribute?

Yes! There's a `CLAUDE.md` at the repo root that primes Claude Code with project context. Run `claude` in the repo and follow the suggested workflow in `CONTRIBUTING.md`.

### What if my PR is rejected?

We try to give clear feedback. Common rejection reasons: out-of-scope feature, breaks existing tests, no rationale documented. Re-submission after addressing feedback is welcome.

## Troubleshooting

### `npm install` fails

Make sure you're on Node 22+. Check `.nvmrc`. If you use `nvm`, run `nvm use`.

### `npm run verify` fails on lint

Run `npm run lint:fix` first. The lint threshold is 60 warnings; CI fails above that.

### Webhook verification fails locally

Local dev doesn't verify webhook signatures by default unless you set the secret env vars. For local Stripe testing, use `stripe listen --forward-to localhost:3000/api/webhook/stripe`.

### TypeScript errors after pulling main

Run `npm run typecheck` to see them. The `exactOptionalPropertyTypes` flag is strict — if your IDE shows errors, often a `?: T` should be `?: T | undefined` or vice versa.

### "Module not found" after `git pull`

`rm -rf node_modules .next && npm install` usually fixes it.

## Still stuck?

- Check [docs/](.) for deeper dives
- Search [GitHub Issues](https://github.com/Hiberius/whatsapp-receptionist/issues)
- Ask in [GitHub Discussions](https://github.com/Hiberius/whatsapp-receptionist/discussions)
- Email **support@whatsapp-receptionist.dev** (best-effort response)
