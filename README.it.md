<div align="center">
  <img src="docs/screenshots/hero-banner.svg" alt="WhatsApp Receptionist — il primo AI receptionist open source per WhatsApp pensato per il mercato italiano" width="100%" />

# WhatsApp Receptionist

### L'AI receptionist open source che prende appuntamenti reali su WhatsApp

**Costruito in Italia 🇮🇹 · GDPR-ready · Self-hostable in 30 minuti**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9_strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Powered by Anthropic Claude](https://img.shields.io/badge/Claude-Sonnet%204.5-D97757?logo=anthropic)](https://anthropic.com)
[![Tests](https://img.shields.io/badge/test-369%20passing-brightgreen)](#qualità)
[![GDPR](https://img.shields.io/badge/GDPR-ready-2563eb)](#gdpr--sicurezza)
[![Stars](https://img.shields.io/github/stars/Hiberius/whatsapp-receptionist?style=social)](https://github.com/Hiberius/whatsapp-receptionist/stargazers)

[Demo](#demo) · [Documentazione](docs/) · [Quickstart](#quickstart) · [Roadmap](#roadmap) · [English 🇬🇧](README.md)

</div>

---

## Cos'è

Il primo AI receptionist open source per WhatsApp pensato esplicitamente per il mercato italiano: GDPR by default, fatturazione elettronica SDI integrata, hosting EU, voce italiana decente.

In 3 frasi:

- **Riceve messaggi WhatsApp e note vocali** dei tuoi clienti, 24/7
- **Capisce l'intent, prende appuntamenti veri** su Google Calendar, manda conferme
- **Passa la palla a un umano** (te) solo quando serve — regole di escalation che decidi tu

Non è una demo, non è un tutorial. È uno starter kit SaaS completo, pronto per la produzione: 35 pagine frontend, 37 API route, multi-tenant Supabase RLS, TypeScript strict, endpoint GDPR (Art. 15 e Art. 17), Stripe + fatturazione elettronica SDI italiana, 369 test verdi, build di produzione verificata.

---

## Funzionalità

|     |     |
| --- | --- |
| **WhatsApp + voce** | Messaggi e note vocali via Meta WhatsApp Cloud API ufficiale + ElevenLabs STT/TTS. Niente Baileys o BSP non ufficiali. |
| **Appuntamenti veri** | Google Calendar OAuth, conflict detection, conferme automatiche, reminder, riprogrammazione. |
| **Anthropic Claude** | Estrazione intent, orchestrazione conversazione, prompt caching, fallback, regole di escalation. |
| **GDPR nativo** | Endpoint Art. 15 (export) + Art. 17 (delete), audit log, hosting EU (Supabase Frankfurt + Upstash EU). |
| **Stripe + SDI italiano** | Stripe Subscriptions e Customer Portal, più fatturazione elettronica B2B Italia via Fatture in Cloud. |
| **Multi-tenant** | Row Level Security Supabase su ogni tabella. Pronto per SaaS, agency white-label, o single-tenant self-host. |
| **Design editorial** | Design system custom, palette OKLCH, Fraunces + Inter, tipografia fluida, accessibilità (95+ Lighthouse). |
| **Hardened per la produzione** | CSP nonce per request, HSTS, COEP/COOP/CORP, verifica webhook timing-safe, log Pino con redact PII automatico. |

---

## Stack tecnico

| Layer | Scelta | Perché |
| --- | --- | --- |
| Framework | **Next.js 15.5** App Router | Server Components, Route Handlers, middleware edge-ready |
| Runtime | **React 19** + Node 22 | Ultima stabile, async server components, concurrent rendering |
| Linguaggio | **TypeScript 5.9 strict** | `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, zero `any` in src |
| Database | **Supabase Postgres EU** + **Drizzle ORM** | Postgres gestito a Francoforte, migrazioni type-safe, RLS nativo |
| Auth | **Supabase Auth** | Cookie httpOnly + secure + sameSite=lax, sessione SSR-aware |
| AI | **Anthropic Claude Sonnet 4.5** | Tool use migliore in classe, prompt caching, latenza prevedibile |
| Voce | **ElevenLabs STT + TTS** | La qualità della voce italiana conta — ElevenLabs la fa bene |
| Messaggistica | **Meta WhatsApp Cloud API** | Solo ufficiale. Niente Baileys, niente client scraped. |
| Calendario | **Google Calendar OAuth** | Token cifrati, conflict detection, multi-calendar |
| Billing | **Stripe Subscriptions + Customer Portal** | + **Fatture in Cloud** per fatturazione SDI italiana |
| Rate limit | **Upstash Redis EU** | Edge-friendly, distribuito, policy nominate per endpoint |
| Logging | **Pino** | JSON strutturato, redact PII automatico (email, telefono, IBAN, codice fiscale, …) |
| Testing | **Vitest 4** | 369 test, unit + integration + smoke, coverage v8 |
| Tooling | **ESLint 9 flat** + **Prettier 3** + **Husky** + **lint-staged** | Pre-commit gitleaks, lint-staged, format on save |

---

## Quickstart

```bash
git clone https://github.com/Hiberius/whatsapp-receptionist.git
cd whatsapp-receptionist
cp .env.example .env.local
# compila le variabili d'ambiente
npm install
npm run dev
```

Apri <http://localhost:3000> — fatto.

Per il riferimento completo delle env, vedi [`.env.example`](.env.example) (~30 variabili documentate inline).

Per il deploy in produzione, vedi [`docs/deployment.md`](docs/deployment.md).

---

## SDI e GDPR — perché conta in Italia

Questa è la parte che nessun chatbot americano fa.

### Fatturazione elettronica SDI

Per vendere B2B in Italia serve la fatturazione elettronica via Sistema di Interscambio (SDI). L'integrazione è in [`src/server/billing/sdi-invoicing.ts`](src/server/billing/sdi-invoicing.ts) e usa **Fatture in Cloud** come provider (la firma digitale e la trasmissione SDI le fa loro). Quando un tenant paga via Stripe, parte automaticamente la fattura elettronica. P.IVA, codice univoco, codice fiscale, regime fiscale — tutto gestito.

### GDPR by default

- **Hosting EU**: Supabase Frankfurt + Upstash EU. Niente data transfer fuori dall'Europa.
- **Art. 15 (diritto di accesso)**: endpoint `/api/gdpr/export` che genera un dump completo dei dati del tenant.
- **Art. 17 (diritto all'oblio)**: endpoint `/api/gdpr/delete` con cancellazione cascading + audit log.
- **PII redact** automatico nei log: email, telefono, codice fiscale, P.IVA, IBAN, OAuth token.
- **CSP nonce-based** per ogni request, HSTS preload, COEP/COOP/CORP.
- **Audit log** completo su `gdpr_audit_log` (chi ha fatto cosa, quando, da dove).
- **DPA cliente-facing** già scritto (vedi `/legal/dpa`).
- **Cookie banner** conforme con consenso granulare.

### Documentazione legale già pronta

5 pagine legali già scritte in italiano e inglese:

- `/legal/privacy` — informativa privacy
- `/legal/terms` — termini di servizio
- `/legal/dpa` — Data Processing Agreement (per clienti B2B che lo richiedono)
- `/legal/cookie` — cookie policy
- `/legal/security` — pagina security cliente-facing (CSP, GDPR, hosting EU, ecc.)

---

## Cosa c'è dentro

- **35 pagine frontend** — landing, pricing, 4 verticali (dental, beauty, fitness, professional), blog, help center, dashboard (5 sezioni), admin panel (6 sezioni), 5 pagine legali
- **37 API route** — auth, billing, conversations, calendar, GDPR (Art. 15/17), webhook (Stripe + WhatsApp), health deep, internal job, contact
- **7 migrazioni Supabase** — 21 tabelle, RLS completa, GDPR audit log, contact submissions
- **369 test verdi** — unit + integration + smoke, Vitest 4 con coverage v8
- **Design system completo** — palette OKLCH editorial, Fraunces (display) + Inter (body), tipografia fluida con `clamp()`, design token in CSS custom properties
- **JSON-LD schema** — Organization, SoftwareApplication, FAQ, Breadcrumb (iniettati programmaticamente)
- **Middleware sicurezza** — CSP nonce per request, HSTS preload, COEP, COOP, CORP, X-Frame-Options DENY
- **Integrazione SDI italiano** — fatturazione elettronica via Fatture in Cloud (compliance B2B)
- **CI workflow** — typecheck + lint + test + build di produzione + secret scan (gitleaks)

---

## Demo

Una demo hostata è in roadmap. Per ora, clona il repo e fai `npm run dev` — hai un tenant funzionante in meno di 5 minuti (mock webhook WhatsApp incluso).

Anteprime:

| | |
| --- | --- |
| Landing | <img src="docs/screenshots/landing-1280.svg" alt="Landing page" width="100%" /> |
| Pricing | <img src="docs/screenshots/pricing-1280.svg" alt="Pricing" width="100%" /> |
| Verticale (Dental) | <img src="docs/screenshots/dental-1280.svg" alt="Pagina verticale dentista" width="100%" /> |
| Dashboard | <img src="docs/screenshots/dashboard-1280.svg" alt="Dashboard tenant" width="100%" /> |
| Admin panel | <img src="docs/screenshots/admin-1280.svg" alt="Pannello super-admin" width="100%" /> |
| Onboarding | <img src="docs/screenshots/onboarding-1280.svg" alt="Wizard di onboarding" width="100%" /> |

> Sono SVG placeholder. Quando la demo pubblica sarà online verranno sostituiti con screenshot reali. Contributi benvenuti — vedi `docs/screenshots/README.md`.

---

## Perché esiste

Esistono i chatbot AI ed esistono i sistemi di booking. Nessuno li combina con la disciplina GDPR europea e la compliance fiscale italiana (SDI / Fatture in Cloud). Ho costruito questa cosa perché volevo deployare un AI receptionist vero per uno studio dentistico in Italia e non trovavo nulla di self-hostable che spuntasse tutte le caselle.

Il codice è il risultato di tre settimane di engineering compresso con [Claude Code](https://claude.ai/code) come pair programmer, più un paio di decenni di SaaS deployati per PMI europee.

Se ti torna utile, lascia una stella al repo. Se lo forki commercialmente va benissimo — MIT è MIT — basta che non dichiari di averlo scritto da zero.

---

## Architettura

Vedi il [README inglese](README.md#architecture) per l'albero completo, oppure [`docs/architecture/`](docs/architecture/) per i diagrammi e le decisioni di design.

---

## Qualità

Il merge in `main` richiede `npm run verify` verde:

```bash
npm run verify
# = typecheck + lint + test + db:lint
```

- **TypeScript strict** con `exactOptionalPropertyTypes` — pulito
- **ESLint 9** flat config — < 60 warning, 0 errori
- **369 test** verdi
- **21 tabelle** con RLS abilitata, validato programmaticamente

Pipeline CI (GitHub Actions): `verify` → `coverage` → `production build` → `secret scan`.

---

## Roadmap

Breve termine (60 giorni):

- [ ] Demo pubblica hostata con numero WhatsApp sandbox
- [ ] Canali Telegram + Instagram DM (stesso orchestratore, transport diverso)
- [ ] Chiamate vocali native (ElevenLabs Conversational + Twilio)
- [ ] Provider Outlook Calendar (alternativa a Google)
- [ ] i18n tedesco + francese (italiano + inglese già live)

Medio termine:

- [ ] Webhook per integrazioni tenant (Make, n8n, Zapier)
- [ ] Dashboard mobile nativa (React Native / Expo)
- [ ] Sync CRM (HubSpot, Pipedrive, Notion)
- [ ] Marketplace di agent verticali

Lungo termine:

- [ ] Edizione self-hosted con LLM locale di fallback (Ollama)
- [ ] Marketplace per integrazioni community

---

## Contribuire

PR benvenute. Vedi [`CONTRIBUTING.md`](CONTRIBUTING.md) per il flusso.

Il codebase è ottimizzato per [Claude Code](https://claude.ai/code) — c'è un `AGENTS.md` nella root che setta il contesto. Se usi Claude Code, apri il repo e parti.

Per contributor non-Claude: il codebase è TypeScript strict, ESLint 9 flat, Prettier 3, Husky pre-commit. Lancia `npm run verify` prima di pushare.

---

## Ringraziamenti

- [Anthropic](https://anthropic.com) per Claude Sonnet 4.5 — metà di questo codice è scritta in pair con Claude Code
- [Supabase](https://supabase.com) per aver reso il multi-tenant Postgres + RLS banale
- [Vercel](https://vercel.com) per Next.js
- [ElevenLabs](https://elevenlabs.io) per la voce italiana che non sembra robotica
- La community SaaS italiana

---

## Licenza

MIT © [Christian Calabrò](https://github.com/Hiberius)

Vedi [`LICENSE`](LICENSE) per il testo completo.

---

<div align="center">

Costruito con cura in Italia da Christian Calabrò ([@hiberius](https://github.com/Hiberius))

Se ti ha fatto risparmiare tempo, [metti una stella al repo](https://github.com/Hiberius/whatsapp-receptionist) — è la valuta che finanzia l'open source.

</div>
