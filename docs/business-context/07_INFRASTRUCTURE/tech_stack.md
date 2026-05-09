# Tech Stack — Ambrogio.ai

## Filosofia stack

**Principi guida**:
1. **EU-first**: ogni servizio deve avere opzione data residency Europa
2. **Boring tech**: scelgo tecnologie mature (no hype), velocità di sviluppo
3. **Cost-effective**: €200/mese max come costo fisso fino a 50 clienti
4. **Scalabile**: lo stack regge €0 → €100k MRR senza refactoring
5. **Codex friendly**: tecnologie su cui Codex scrive codice eccellente
6. **Single-developer ready**: se lavori da solo, lo stack non deve combatterti

---

## Frontend

### Framework
**Next.js 15** (App Router)
- Server Components + Client Components
- Streaming SSR per dashboard pesanti
- Built-in image optimization
- API Routes per endpoint leggeri
- Versione: 15.x stabile

**Perché**: Codex eccezionale con Next.js. Ecosystema enorme. SSR + client rendering nativo.

### Language
**TypeScript strict mode**
- `strict: true` in tsconfig
- `noUncheckedIndexedAccess: true` (forza null checks)
- Zero `any`, zero `@ts-ignore`

### Styling
**Tailwind CSS 4**
- Configurazione in `tailwind.config.ts`
- CSS variables per tokens design (da `04_CODEX_FRONTEND_PROMPTS/00_design_system.md`)
- `@tailwindcss/typography` per prose blocks
- `@tailwindcss/forms` per form reset

### UI Components
**shadcn/ui** (copy-paste, non dipendenza)
- Radix UI primitives sotto (accessibility nativa)
- Tutti i componenti in `/components/ui/`
- Fork e customizza liberamente

### State management
- **TanStack Query v5** per server state (fetching, caching, mutations)
- **Zustand** per client state complesso (raramente necessario)
- **React Hook Form + Zod** per form validation

### Icons
**Lucide React** (coerente, leggero, open source)

### Animations
**Framer Motion** (micro-interactions dashboard) — usato con parsimonia per non appesantire bundle

---

## Backend

### Runtime
**Node.js 22 LTS** (Vercel native)

### API layer
**Next.js API Routes + Route Handlers** (App Router)
- `/app/api/*` per endpoint HTTP
- Server Actions per mutations da UI

**Per task pesanti/async: Trigger.dev v3**
- Background jobs (send email, process WhatsApp webhook, generate report)
- Retry logic nativo
- Observability built-in
- Free tier: 10k runs/mese, poi **$20/mese** (piano Pro, circa €18-20 al cambio corrente)

### Validation
**Zod** ovunque
- Validazione input API
- Validazione env variables
- Schema condivisi frontend/backend
- Parsing risposte AI (structured output)

### ORM
**Drizzle ORM** (TypeScript-first)
- Type-safe queries
- Migration native via drizzle-kit
- Studio integrato (GUI)
- Performance eccellente

**Alternativa considerata (rejected)**: Prisma (più pesante, tooling meno affine a Supabase).

---

## Database

### Primary DB
**Supabase Pro** (EU-West, Francoforte)
- PostgreSQL 16 managed
- Row Level Security (RLS) attiva su TUTTE le tabelle
- Connection pooling via Supavisor
- Automated backups + PITR (Point-in-Time Recovery)
- Costo: **€25/mese**

**Perché EU-West**:
- Data residency EU (GDPR)
- Latenza bassa per utenti italiani (~25ms)
- Compliance DPA automatica

### Vector DB
**pgvector** (extension Postgres, built-in Supabase)
- Embeddings per FAQ del cliente
- Semantic search
- Zero servizi aggiuntivi

### Cache / Queue
**Upstash Redis** (EU region)
- Rate limiting per-tenant
- Session storage
- Short-lived cache
- Costo: €10-30/mese

### Object storage
**Cloudflare R2**
- Storage per allegati WhatsApp (immagini, PDF pazienti)
- Zero egress fees
- S3-compatible API
- Costo: €5-15/mese

---

## Authentication

### User auth
**Supabase Auth**
- Email + password (con magic link)
- OAuth Google (per dentisti/veterinari)
- 2FA TOTP obbligatoria per admin
- Session management con JWT
- Password reset flow

### Multi-tenant
**Custom JWT claim** con `tenant_id`
- Auth hook Supabase per iniezione claim
- RLS policies usano `tenant_id` dal JWT
- Service role key solo server-side (mai client)

---

## AI & LLM

### Primary LLM
**Anthropic Sonnet 4** via Anthropic API
- Task: risposte articolate a paziente
- Context window: 200k tokens
- Costo: $3/$15 per 1M token (input/output)

### Premium LLM (opzionale, casi complessi)
**Anthropic Opus 4.1** via Anthropic API (model ID Anthropic configurato via env)
- Modello top di gamma, ~5x più costoso di Sonnet 4
- Da usare solo quando Sonnet 4 fallisce (analisi casi complessi, triage medico avanzato)
- Costo: ~$15/$75 per 1M token
- **Nota:** in produzione default a Sonnet 4. Attiva Opus solo per tenant enterprise con budget alto.

### Fast/cheap LLM
**Anthropic Haiku 3.5** via Anthropic API
- Task: intent detection, routing, classificazione
- Ultra-veloce
- Costo: ~10x meno di Sonnet

### Embeddings
**OpenAI text-embedding-3-large** (1536 dim)
- Per pgvector FAQ search
- Alternativa: Cohere Embed v3 multilingual (migliore italiano)

### AI Orchestration
**Custom pipeline** (no framework esterno tipo LangChain)
- Semplice: intent → retrieval (pgvector) → generation → validation → response
- Logged in DB per audit
- Testabile unit test

### Voice AI
**ElevenLabs** (Speech-to-Text + Text-to-Speech)
- STT: `scribe_v2` per trascrivere vocali WhatsApp inbound.
- TTS: `eleven_flash_v2_5` per generare risposte vocali opzionali, low-latency.
- Output TTS default: `mp3_44100_128`, inviabile come media audio WhatsApp.
- Privacy: impostare `ELEVENLABS_ENABLE_LOGGING=false` per richiedere Zero Retention quando supportato dal piano; valutare EU Data Residency/Zero Retention per clienti sensibili.
- Guardrail: mai clonare voci reali senza consenso scritto; niente audio outbound per emergenze o richieste cliniche delicate.

---

## Messaging / Comunicazione

### WhatsApp
**360dialog** (BSP ufficiale Meta, EU-based Germania)
- WhatsApp Business Cloud API
- Fatturazione Euro, supporto italiano
- Pricing 2026: **$49/mese base per numero + $0.005 flat markup per messaggio** (su tariffe Meta wholesale)
- **Service messages (inbound reply entro 24h): GRATIS** (primi 1.000 service conversations/mese gratis per WABA)
- **Template Italia 2026:** utility ~$0.03/msg, marketing ~$0.13/msg, authentication ~$0.02/msg
- Pricing model passato da conversation-based a **per-message** dal 1 luglio 2025

**Strategia cost optimization per Ambrogio.ai:**
- Massimizzare traffico inbound (cliente scrive per primo) → gratuito
- Usare utility templates (non marketing) per reminder e conferme
- Sfruttare 72h Free Entry Point via Click-to-WhatsApp ads Meta (se facciamo campagne)
- Supportare vocali WhatsApp: i messaggi audio inbound sono trascritti con ElevenLabs e diventano input testuale per l'AI.

**Alternativa considerata (rejected)**: Twilio (USA-based, fatturazione USD, markup più alto, complesso GDPR).

### Email transazionale
**Resend**
- Reliable, developer-first
- React Email templates
- Costo: free 3k/mese, poi €20/mese

### Email marketing (in futuro)
**Mailerlite** o **Customer.io** (fase scale)

### SMS (fallback)
**Twilio**
- Solo per SMS verification/2FA
- Costo: ~€0.05/SMS Italia

---

## Payments

### Subscription billing
**Stripe** (via Stripe Payments Europe Ltd, Dublino — per clienti Italia con config VAT IT)
- Subscriptions con trial
- Customer portal (self-service cancellation)
- Tax ID management (IVA 22% via Stripe Tax)
- Webhooks per sync con DB
- Costo: **1.5% + €0.25 EU cards** (aggiornato 2026)
- **Nota:** Stripe gestisce l'IVA italiana ma NON emette fatture SDI conformi. Serve integrazione separata (vedi sotto).

### Fatturazione elettronica (Italia) — OBBLIGATORIO per B2B IT
**Fatture in Cloud** (TeamSystem, API REST)
- Emissione fatture elettroniche conformi al Sistema di Interscambio (SDI)
- Invio automatico a SDI incluso
- Conservazione a norma 10 anni inclusa
- REST API moderna, ben documentata
- Costo: ~€8-15/mese per account (piano "SaaS" con API)

**Alternative valutate:**
- Aruba Fatturazione Elettronica API (più cheap ma API SOAP legacy, rejected)
- Commercialista manuale (non scala, solo se <20 clienti)

**Flow integrato:**
1. Stripe webhook `invoice.paid` → 
2. Se cliente Italia (billing_country = IT e ha P.IVA) →
3. Fatture in Cloud API crea fattura elettronica + auto-invia a SDI →
4. Salva `fattureincloud_invoice_id` in DB per audit

**Se l'entità legale operativa NON è italiana** (es. Malta Ltd, Estonia OÜ), la fatturazione SDI non si applica: si emette fattura in reverse charge con Stripe invoice standard.

---

## Infrastructure & Hosting

### App hosting
**Vercel Pro**
- Hosting Next.js ottimizzato
- Edge network globale
- Preview deployments per ogni PR
- Analytics native
- Costo: **$20/utente/mese** (per account team). Solo founder = $20/mese. Con 1 collaboratore = $40/mese. Valuta se crescere team prima di aggiungere seat.
- Alternativa bootstrap: **Vercel Hobby (free)** funziona fino a primi 5-10 clienti paganti, ma ha limiti (no commercial use officialmente, ma tollerato prima di monetizzazione). Upgrade a Pro appena si monetizza.

**Region**: `fra1` (Frankfurt) per latency EU + data residency

### CDN + Security layer
**Cloudflare**
- DNS + SSL gratuito
- WAF (€20/mese Pro plan)
- Rate limiting a livello edge
- Bot mitigation
- DDoS protection

### Database
Supabase (vedi sopra, Francoforte)

### Queue/background
Trigger.dev (gestito, EU region quando disponibile)

---

## Monitoring & Observability

### Error tracking
**Sentry**
- Errori frontend + backend
- Source maps
- Performance monitoring
- Costo: free 5k errors/mese, poi $26/mese

### Product analytics
**PostHog** (self-hosted EU o cloud EU)
- Feature flags
- Funnel analysis
- Session recording (opt-in)
- GDPR-friendly
- Costo: free fino a 1M events, poi pay-as-you-go

### Uptime monitoring
**Better Stack** o **BetterUptime**
- Ping endpoint critici ogni 1 min
- Alert via email/SMS/Slack
- Status page pubblica
- Costo: €18/mese

### Logging
**Axiom** o **Logflare** (structured logs)
- Ingest JSON logs dal backend
- Query/filter potente
- Alert su pattern
- Costo: free tier generoso

---

## Development & DevOps

### Version control
**GitHub**
- Repo privato (obbligatorio)
- Branch protection su `main`
- Required PR reviews (quando team)
- GitHub Actions per CI/CD
- Secret scanning attivo
- Dependabot per security updates

### CI/CD
**GitHub Actions** + **Vercel auto-deploy**
- PR = preview deploy
- Merge `main` = production deploy
- Tests runtime prima deploy

### Testing
- **Vitest** per unit test
- **Playwright** per E2E (critical flows)
- **MSW** per mocking API in test

### Package manager
**pnpm** (veloce, efficient disk usage)

### Linting / Formatting
- **ESLint** (config strict)
- **Prettier**
- **Husky** + **lint-staged** per pre-commit hooks

---

## Security tooling

### Secret management
- Vercel Environment Variables (encrypted at rest)
- `.env.local` per dev (MAI committato)
- GitHub Secrets per CI/CD

### Dependency scanning
- Dependabot (GitHub nativo)
- Snyk (free tier)

### SAST
- GitHub CodeQL (gratis repo privati piccoli)

### Runtime protection
- Cloudflare WAF rules
- Rate limiting per-IP e per-tenant
- CORS stretto
- CSP headers

---

## Third-party integrations

### Calendario
- **Google Calendar API** (primario)
- **Microsoft Graph API** (Outlook)
- **Cal.com API** (open source alternative)

### CRM (roadmap)
- HubSpot (freemium)
- Pipedrive (piccole/medie)

### Gestionali verticali
- **Doctolib** (API via partnership)
- **Miodottore** (API via partnership)

---

## Riepilogo costi mensili

| Servizio | Costo |
|----------|-------|
| Vercel Pro (1 utente) | €18 |
| Supabase Pro EU | €23 |
| Upstash Redis | €15 |
| Cloudflare R2 | €10 |
| Cloudflare Pro (WAF) | €18 |
| 360dialog (1 numero base) | €45 |
| Trigger.dev Pro | €18 |
| Resend Pro | €18 |
| Sentry Team EU | €24 |
| Better Stack | €18 |
| Fatture in Cloud API | €10 |
| Google Workspace (3 utenti) | €22 |
| Stripe fees | variable (1.5% + €0.25) |
| Dominio .ai + .it | €6 |
| **TOTALE FISSO** | **~€245/mese** |

**Costi variabili per cliente attivo (medio Starter 300 msg)**: €10-20/mese (AI API + WhatsApp template utility). Con service messages gratuiti, molto più basso di quanto stimato inizialmente.

**Break-even**: al 2°-3° cliente pagante Starter pubblico (€149 x 2-3 = €298-447) copri i costi fissi. Se usi beta a €97/mese, serve 3°-4° cliente e i costi WhatsApp/BSP devono essere pass-through o non inclusi.

---

## Dependencies management

### Versioning
- Lock file `pnpm-lock.yaml` committato SEMPRE
- Version pinning esatto in `package.json` (non `^` su librerie critiche)
- Update schedule: ogni 2 settimane, revisione manuale

### Dependency auditing
Settimanale:
```bash
pnpm audit
pnpm outdated
```

Mensile:
- Review Dependabot PRs
- Aggiornamenti major solo con testing

---

## Stack alternativo scartato (e perché)

| Soluzione | Motivo rifiuto |
|-----------|----------------|
| AWS (EC2 + RDS) | Troppo complesso per solo developer, costi opachi |
| Firebase | Data residency non chiara, vendor lock-in Google |
| Hasura | Overkill per MVP, preferisco SQL diretto |
| tRPC | Non serve se non condividi client TS, overhead |
| MongoDB | Rel queries complesse su multi-tenant difficili |
| Firebase Auth | Supabase Auth è più integrata al nostro stack |
| SendGrid | UX dev deteriore vs Resend |
| Mailgun | GDPR/EU meno chiaro |
| Pusher | Supabase Realtime lo copre |

---

## Quando scalare (triggers)

**Cambiare qualcosa quando**:
- **>100 clienti attivi**: valutare move Supabase → Postgres self-hosted (Neon, Fly.io) per costi
- **>1M conversation/mese**: negoziare contratto enterprise 360dialog
- **>10k MRR**: assumere DevOps part-time
- **>50k MRR**: valutare migrazione a Postgres dedicato + caching layer custom
- **>€100k MRR**: costruire account team + expandere su altre country EU

Fino a quei milestone: **touch niente**, concentrati sul prodotto.
