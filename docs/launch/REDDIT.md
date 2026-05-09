# Reddit posts — 4 subreddits

**Strategy**: post one per day across 4 subs. Same week as HN/Twitter for compounding traffic. Subs have different audiences and tones — adapt accordingly.

---

## r/selfhosted

**Posting day**: Day 2 after HN (Friday or Saturday, when r/selfhosted is most active).

**Title**:

```
[OSS] Self-hosted AI WhatsApp receptionist with full GDPR endpoints
```

**Body**:

```
Hey r/selfhosted,

I just open-sourced an AI receptionist for WhatsApp that I built for Italian SMBs. MIT licensed, self-hostable in 30 minutes, includes Dockerfile + docker-compose for fully air-gapped deployments.

What it does:
- Receives WhatsApp messages + voice notes from customers
- Understands intent (booking, info, urgency, spam) with Anthropic Claude
- Books real appointments on Google Calendar with conflict detection
- Sends confirmations + reminders
- Escalates to a human when AI confidence drops

Why self-hosters might care:
- 100% EU-hosted by default (Supabase Frankfurt + Vercel EU + Upstash EU)
- GDPR Article 15 (data export) + Article 17 (delete) endpoints built-in
- Pino structured logging with automatic PII redaction (no email/phone/IBAN leaking to logs)
- Audit log immutable
- Multi-tenant Supabase Row-Level Security on every table — proper isolation
- No telemetry, no analytics, no "premium tier" feature gates

Tech: Next.js 15 + React 19 + TypeScript strict + Supabase + Anthropic Claude + ElevenLabs voice + Stripe + Upstash Redis. 369 tests passing.

Repo: https://github.com/Hiberius/whatsapp-receptionist

Caveat: WhatsApp Business Account verification with Meta takes 1-3 weeks. That's the bottleneck, not the code. For local dev, Meta's sandbox numbers work fine.

Happy to answer questions about the deployment story, the database schema, or the GDPR endpoints.
```

---

## r/SaaS

**Posting day**: Day 3.

**Title**:

```
I open-sourced my SaaS starter kit instead of trying to launch it
```

**Body**:

```
Spent 3 weeks building an AI WhatsApp receptionist for Italian SMBs. Multi-tenant SaaS architecture, full Stripe billing, Italian SDI electronic invoicing, GDPR Art. 15/17 endpoints, 35 frontend pages, 37 API routes, 369 tests.

Then I realised the GTM is harder than the code. Italian SMBs are slow to adopt new tech. Meta WhatsApp Business approval takes 1-3 weeks. The unit economics work but acquisition is brutal.

So I open-sourced it. MIT licensed, fork commercially without asking.

If you want to:
- Build a SaaS on top of it (you keep all the revenue)
- Use it as a reference for multi-tenant Supabase RLS architecture
- White-label it for an agency
- Just learn from production-ready Next.js 15 code

Take it: https://github.com/Hiberius/whatsapp-receptionist

What I learned that might save you time:
1. Multi-tenancy is a database problem, not an app problem. RLS first.
2. WhatsApp Business approval is the real bottleneck. Plan 1-3 weeks.
3. Italian B2B is impossible without SDI invoicing. Most international tools don't have it.
4. Stripe + electronic invoicing is more work than Stripe alone.
5. AI orchestration is 70% prompt engineering and routing, 30% the actual model.

Roast the code in the comments. PRs welcome.
```

---

## r/webdev

**Posting day**: Day 4.

**Title**:

```
Editorial Next.js 15 design system + multi-tenant RLS + 369 tests, all open source
```

**Body**:

```
Open-sourced a Next.js 15 SaaS starter kit. MIT licensed.

For r/webdev, the interesting parts:

1. **Design system without Tailwind** — Custom CSS with OKLCH color palette, fluid typography (clamp() everywhere), Fraunces serif for display + Inter for body. Editorial luxury vibe, distinctive. ~700 lines of globals.css, ~200 lines of tokens.css.

2. **Server Components everywhere** — Almost zero "use client". Hydration is rare. Page weight stays small.

3. **TypeScript strict with all the killer flags** — `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, the works. Zero `any` in src/.

4. **CSP nonce middleware** — Edge runtime generates a per-request nonce, applies CSP, bypasses webhooks. Working `prefers-reduced-motion` support throughout.

5. **JSON-LD schemas injected programmatically** — Organization, SoftwareApplication, FAQ, Breadcrumb, Article, HowTo, Service. SEO-ready by default.

6. **Multi-tenant via Postgres Row-Level Security** — Even if app code forgets `WHERE tenant_id =`, the DB returns nothing. RLS is the security boundary.

7. **369 tests** — Vitest unit + integration + smoke. Auto-discovery test that walks every API route and verifies HTTP method handlers exported.

Stack: Next.js 15 + React 19 + Supabase EU + Drizzle + Anthropic Claude + Stripe + Upstash Redis.

Repo: https://github.com/Hiberius/whatsapp-receptionist

The whole thing is the source code I wish existed when I was learning Next.js 15 App Router with multi-tenant SaaS in mind.
```

---

## r/italyinformatica

**Posting day**: Day 5.

**Title**:

```
Ho open-sourcato un AI receptionist WhatsApp pensato per il mercato italiano (GDPR + SDI nativi)
```

**Body**:

```
Ciao r/italyinformatica,

Ho passato tre settimane a costruire un AI receptionist WhatsApp per PMI italiane (dentisti, estetisti, palestre, studi professionali). Realisticamente la GTM in Italia è più dura del codice, quindi ho open-sourcato tutto.

Cosa fa: riceve messaggi e vocali WhatsApp, capisce l'intent con Claude, prenota appuntamenti reali su Google Calendar, gestisce escalation a umano. Stack moderno (Next.js 15, Supabase EU, TypeScript strict).

Perché potrebbe interessare a chi è qui:

1. **SDI nativo** — fatturazione elettronica B2B integrata via Fatture in Cloud, con codici MP08/MP19/MP05 mappati correttamente. La maggior parte dei tool internazionali ignora completamente il SDI italiano.

2. **GDPR seria, non marketing** — endpoint Art. 15 (export) + Art. 17 (cancellazione) con grace period 30 giorni, audit log immutabile, hosting Frankfurt + Vercel EU + Upstash EU. PII redact automatico nei log.

3. **Multi-tenant con Supabase RLS** — isolamento garantito a livello DB. 21 tabelle, tutte con policy `tenant_id = JWT app_metadata`.

4. **Codice in italiano nelle parti esposte all'utente finale** — copy professionale, niente americanismi tipo "magic link" o "free trial".

5. **Documentazione bilingue** — README in inglese per la community internazionale + README.it.md per chi è qui.

Caveat: la verifica Meta WhatsApp Business per produzione richiede 1-3 settimane. Per dev locale i numeri sandbox di Meta sono gratis.

Repo: https://github.com/Hiberius/whatsapp-receptionist

MIT licensed, forkate pure per uso commerciale. Issues e PR benvenute, soprattutto se vedete miglioramenti sul lato fiscale italiano (SDI, gestione regimi forfetari, scorporo IVA, ecc.).
```

---

## Engagement tips per tutti i sub

- Rispondi a TUTTI i commenti nelle prime 6 ore
- Se qualcuno dice "questo è solo un wrapper di Claude", scendi nel dettaglio dell'orchestration
- Non upvotare i tuoi propri post
- Non rispondere a critiche con "ma tu non capisci": rispondi tecnicamente o ringrazia per il feedback
- Se decolla in un sub, fai cross-post negli altri solo dopo 24h

## After Reddit

- Add a "Featured on Reddit" section to README if a sub gives you 50+ upvotes
- Save permalinks of the best comments for future iteration
