# Deployment Guide — Ambrogio.ai

## Flusso totale: dev → staging → production

**Ambienti**:
- **Local**: sviluppo sul tuo Mac
- **Preview**: deploy automatico per ogni PR (Vercel)
- **Staging**: branch `staging` deploy automatico (Vercel) — usato per QA pre-release
- **Production**: branch `main` deploy automatico (Vercel) — live sul dominio

**Filosofia**: merge su `main` SOLO dopo test su staging. Mai direttamente a production.

---

## Fase 1 — Prerequisiti (una volta sola)

### 1.1 Registrazione domini
**Where**: Porkbun (raccomandato, prezzi bassi, privacy nativa) o Cloudflare Registrar.

**Da registrare subito**:
- `ambrogio.ai` (primario)
- `ambrogio.it` (SEO IT + redirect)
- `ambrogio.com` (anti-squatting)
- `ambrogioai.com`, `ambrogioai.it` (varianti)

**Costo totale**: ~€120-180/anno.

### 1.2 Account SaaS (tutti gratuiti/tier gratuito)

Crea account in quest'ordine:
1. **GitHub** (repo privato): `github.com/[tuo-user]/ambrogio-ai`
2. **Vercel**: login con GitHub, link repo
3. **Supabase**: project EU-West (Frankfurt), nome `ambrogio-prod`
4. **Anthropic Console**: API key Anthropic
5. **OpenAI**: API key per embeddings
6. **360dialog**: registrazione business + richiesta numero WhatsApp
7. **ElevenLabs**: API key per Speech-to-Text e Text-to-Speech vocali WhatsApp
7. **Stripe**: attivazione account Italia (Partita IVA richiesta)
8. **Cloudflare**: gratuito, poi upgrade Pro quando live
9. **Resend**: verification dominio
10. **Upstash**: Redis EU region
11. **Sentry**: progetto `ambrogio-app`
12. **PostHog**: progetto EU cloud
13. **Better Stack**: monitoring

**Tempo richiesto**: 3-4 ore totali (molti richiedono verifiche identity/business).

### 1.3 Meta Business Verification (critical path)
Richiede **2-3 settimane**, inizia ORA:
1. `business.facebook.com` → crea Business Manager
2. Carica: visura camerale, P.IVA, documento identità
3. Verifica dominio (TXT record su DNS)
4. Approvazione Meta: 2-14 giorni
5. Collega 360dialog come BSP partner

**Senza questo step, WhatsApp Business Cloud API non funziona.** Blocca tutto.

---

## Fase 2 — Setup iniziale repository

### 2.1 Create project
```bash
pnpm create next-app@latest ambrogio-ai \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm

cd ambrogio-ai
```

### 2.2 Install dependencies core
```bash
# Database
pnpm add drizzle-orm postgres @supabase/supabase-js @supabase/ssr

# Auth & validation
pnpm add zod

# AI
pnpm add @anthropic-ai/sdk openai

# UI
pnpm add lucide-react framer-motion
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-toast
pnpm add class-variance-authority clsx tailwind-merge

# Forms
pnpm add react-hook-form @hookform/resolvers

# State
pnpm add @tanstack/react-query zustand

# Stripe
pnpm add stripe @stripe/stripe-js

# Email
pnpm add resend @react-email/components

# Background jobs
pnpm add @trigger.dev/sdk

# Rate limiting
pnpm add @upstash/ratelimit @upstash/redis

# Monitoring
pnpm add @sentry/nextjs posthog-js

# Dev deps
pnpm add -D drizzle-kit @types/node vitest @vitest/ui
pnpm add -D eslint-config-prettier prettier husky lint-staged
pnpm add -D @playwright/test
```

### 2.3 Struttura directory consigliata
```
ambrogio-ai/
├── src/
│   ├── app/
│   │   ├── (auth)/          # login, signup, reset
│   │   ├── (marketing)/     # landing, pricing, about
│   │   ├── (dashboard)/     # app autenticata
│   │   │   ├── layout.tsx
│   │   │   ├── conversations/
│   │   │   ├── settings/
│   │   │   └── team/
│   │   ├── (admin)/         # super-admin panel
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   ├── whatsapp/
│   │   │   │   └── stripe/
│   │   │   ├── conversations/
│   │   │   └── ai/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/              # shadcn components
│   │   ├── dashboard/
│   │   ├── marketing/
│   │   └── shared/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   └── queries.ts
│   │   ├── ai/
│   │   │   ├── agent.ts
│   │   │   ├── prompts.ts
│   │   │   └── routing.ts
│   │   ├── whatsapp/
│   │   │   ├── client.ts
│   │   │   └── webhook.ts
│   │   ├── stripe/
│   │   └── env.ts
│   ├── hooks/
│   ├── types/
│   └── styles/
├── public/
├── drizzle/                 # migrations
├── tests/
├── .env.example
├── .gitignore
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## Fase 3 — Configurazione Supabase

### 3.1 Create project
1. Dashboard Supabase → New Project
2. Name: `ambrogio-prod`
3. Database password: genera random, salva in 1Password
4. Region: **EU West (Frankfurt)** — CRITICO per GDPR
5. Plan: Pro ($25/mese) — necessario per PITR backup

### 3.2 Configurazione database
```bash
# Setup drizzle
# File: drizzle.config.ts
export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.SUPABASE_DB_URL!,
  },
}

# Genera e applica migration
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

### 3.3 Setup Row Level Security
Lo schema completo è in `/03_CODEX_BACKEND_PROMPTS/02_database_schema.md` e `/03_CODEX_BACKEND_PROMPTS/03_auth_multi_tenant.md`.

**Verifica critica**: ogni tabella DEVE avere RLS attiva PRIMA di andare live. Esegui questo check:

```sql
-- Run in Supabase SQL Editor
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false;
```

Se ritorna risultati → RLS NON attiva su qualche tabella → BLOCCO deploy.

### 3.4 Backup strategy
- Supabase Pro include PITR 7 giorni automatico
- Extra: script settimanale che fa `pg_dump` + upload su Cloudflare R2 (retention 90 giorni)
- Test restore ogni trimestre (esercitazione disaster recovery)

---

## Fase 4 — Configurazione Vercel

### 4.1 Link progetto
1. Vercel Dashboard → Import Git Repository → seleziona repo
2. Framework: Next.js (auto-detect)
3. Root directory: `./`
4. Build command: `pnpm build`
5. Install command: `pnpm install`

### 4.2 Region deployment
- Settings → Functions → Region: **`fra1` (Frankfurt)**
- Edge Network: default (global)

### 4.3 Environment variables
Configura tutte le variabili da `env_variables_template.md`:
- Environment: **Production** per valori live
- Environment: **Preview** per valori staging/test
- Environment: **Development** per valori locali (non sono usati da Vercel ma da Vercel CLI)

**Best practice**: marca come "Sensitive" tutte le API key.

### 4.4 Branch protection
- Main branch: `main`
- Production branch: `main`
- Preview branches: tutti tranne `main`
- Auto-deploy: enabled

### 4.5 Domain setup
1. Settings → Domains
2. Aggiungi `ambrogio.ai` (primary) → landing page
3. Aggiungi `app.ambrogio.ai` per dashboard utente autenticata
4. Segui istruzioni DNS (CNAME o A records)

**Architettura URL:**
- `www.ambrogio.ai` / `ambrogio.ai` → landing pubblica
- `app.ambrogio.ai` → dashboard + API interne (`app.ambrogio.ai/api/*`)
- `api.ambrogio.ai` → **OPZIONALE**: subdomain isolato per webhook inbound pubblici (Stripe, 360dialog, Cal.com). Vantaggio: superficie di attacco separata dal dashboard, WAF rules specifiche, no CORS leak. Configurabile via Vercel Rewrite `api.ambrogio.ai/*` → `app.ambrogio.ai/api/webhooks/*`. Raccomandato dal mese 2 quando hai webhook attivi. Al day-1 non serve.

**Redirect**: `ambrogio.it`, `ambrogioai.com` → 301 redirect a `ambrogio.ai`

---

## Fase 5 — Configurazione Cloudflare

### 5.1 Add site
1. Cloudflare Dashboard → Add Site → `ambrogio.ai`
2. Piano: Free inizialmente, poi Pro ($20/mese) quando live
3. Cambia nameservers presso il registrar (Porkbun) → quelli forniti da Cloudflare

### 5.2 SSL/TLS
- SSL mode: **Full (strict)**
- Always Use HTTPS: ON
- Minimum TLS: 1.2
- HSTS: enabled con max-age 31536000

### 5.3 WAF rules (Pro plan)
Regole critiche da attivare:
```
# Rate limit API endpoints
(http.request.uri.path contains "/api/") and (rate(1m) > 100) → Block

# Block common attacks
Managed Rules: OWASP Core Rule Set → ON
Managed Rules: Cloudflare Managed → ON

# Bot mitigation
Bot Fight Mode: ON (free)
Super Bot Fight Mode: ON (Pro)

# Country blocking (opzionale)
# Se NON servi clienti in certi paesi, blocca per ridurre attack surface

# Block known bad IPs
Threat Score > 50 → Challenge
```

### 5.4 Page rules
- `*ambrogio.ai/api/*` → Cache Level: Bypass
- `*ambrogio.ai/*` → Always Online: ON
- Static assets (`*.css`, `*.js`, `*.png`): Cache 1 mese

### 5.5 R2 object storage
1. R2 → Create Bucket: `ambrogio-attachments`
2. Public access: OFF (usi signed URLs)
3. Custom domain: `attachments.ambrogio.ai` (Cloudflare routing)
4. Crea API tokens con accesso read/write SOLO questo bucket

---

## Fase 6 — WhatsApp Business (360dialog)

### 6.1 Setup numero
1. 360dialog Dashboard → Request WhatsApp Business number
2. Scegli: nuovo numero o port-in esistente
3. Verifica Meta approvata (da Fase 1)
4. Costo: €49/mese per numero

### 6.2 Webhook configuration
```
Webhook URL: https://ambrogio.ai/api/webhooks/whatsapp
Verify Token: [da env WHATSAPP_WEBHOOK_VERIFY_TOKEN]
Subscribe to: messages, message_status, message_template_status_update
```

### 6.3 Test messaggi
- Usa numero sandbox 360dialog per test in dev
- Verifica webhook riceve payload via `/api/webhooks/whatsapp`
- Verifica webhook attiva: header segreto custom 360dialog + idempotenza; HMAC/Meta signature solo se disponibile nel setup reale (vedi `/03_CODEX_BACKEND_PROMPTS/04_whatsapp_integration.md`)

### 6.4 Message templates approval
- Ogni template marketing deve essere approvato da Meta (1-24h)
- Template di servizio (reply in 24h window): non richiedono approvazione
- Crea template base:
  - "appointment_confirmation_it"
  - "appointment_reminder_it"
  - "welcome_message_it"

### 6.5 Display Name e Green Tick (Official Business Account)
- **Display Name verification (obbligatorio):** il nome che appare al cliente quando riceve messaggi (es. "Ambrogio.ai"). Meta verifica match con business name. Tempi: 1-7 giorni.
- **Green Tick / Official Business Account (opzionale, ma forte trust signal):**
  - Meta richiede status di **Notable Brand**: brand riconosciuto pubblicamente con copertura su testate indipendenti recenti (articoli stampa su StartupItalia, EconomyUp, Wired, Il Sole 24 Ore o simili, Wikipedia page consolidata)
  - **NON concesso a startup early-stage senza copertura media.** Richiesta rigettata con messaggio generico.
  - Strategia realistica: dopo 50+ clienti paganti, coinvolgere giornalisti tech italiani per 2-3 articoli, poi ri-richiedere. Target mese 12-18.
  - Workaround per trust nel frattempo: Display Name + profile photo professionale + welcome message chiaro + business description curata (tutti visibili al cliente anche senza green tick)

### 6.6 Conformità Meta policy AI (gennaio 2026)
Dal **15 gennaio 2026** Meta ha vietato AI chatbots general-purpose sul WhatsApp Business Platform. Ambrogio.ai è conforme perché:
- ✅ Task-specific (prenotazione appuntamenti, info servizi, preventivi)
- ✅ Non si propone come assistente universale (no "chiedi qualsiasi cosa")
- ✅ Ogni risposta è nel contesto del business del cliente, non generica

**Action item:** citare questa conformità in homepage e pitch come differenziatore vs competitor che usano ChatGPT on WhatsApp (che è stato bannato). Esempio claim: *"Conforme alla policy Meta 2026 — a differenza di soluzioni AI generiche bannate da WhatsApp a gennaio 2026."*

---

## Fase 7 — Stripe setup

### 7.1 Account activation
1. Stripe (opera in Italia tramite Stripe Payments Europe Ltd, Dublino) → registra account con la tua entità legale + P.IVA + dati aziendali
2. Bank account verification (IBAN Italia/EU SEPA)
3. Tax settings: configura Stripe Tax con sede fiscale + IVA 22% Italia (o reverse charge se entità Malta/Estonia)

### 7.2 Products & prices
Crea in Stripe Dashboard:

```
Product: Ambrogio Starter
  Price ID: price_starter_monthly
  Amount: €149.00/month recurring
  
Product: Ambrogio Professional  
  Price ID: price_professional_monthly
  Amount: €299.00/month recurring
  
Product: Ambrogio Agency
  Price ID: price_agency_monthly
  Amount: €897.00/month recurring
  
Product: Setup Fee
  Price ID: price_setup_fee
  Amount: €297.00 one-time
```

Copia gli ID in env variables.

### 7.3 Webhooks
```
Webhook URL: https://ambrogio.ai/api/webhooks/stripe
Events to listen:
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.paid
- invoice.payment_failed
- customer.subscription.trial_will_end
```

Copia signing secret in `STRIPE_WEBHOOK_SECRET`.

### 7.4 Customer portal
Stripe Dashboard → Settings → Customer Portal:
- Allow cancel subscription: YES
- Allow switch plan: YES (restringi a piani compatibili)
- Allow update payment method: YES
- Customizzazioni branding: logo Ambrogio

---

## Fase 8 — CI/CD pipeline

### 8.1 GitHub Actions
Crea `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main, staging]
  push:
    branches: [main, staging]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Audit dependencies
        run: pnpm audit --audit-level=moderate
      - name: Check secrets
        run: |
          if grep -rE "NEXT_PUBLIC_.*(SECRET|KEY|TOKEN)" src/; then
            exit 1
          fi
```

### 8.2 Vercel deploy settings
- Main branch → auto-deploy to production
- `staging` branch → auto-deploy to staging URL
- Feature branches → preview URL automatico

### 8.3 Pre-deploy checks
Pre-flight checklist automatica:
- [ ] Tests pass (Vitest)
- [ ] Type check passa (tsc --noEmit)
- [ ] Lint passa
- [ ] Build success
- [ ] No secret in `NEXT_PUBLIC_`
- [ ] Lock file committato

---

## Fase 9 — Go-live checklist

### 9.1 Pre-launch (1 settimana prima)
- [ ] Backup completo Supabase
- [ ] Test restore su staging
- [ ] Load test (100 request simultanee)
- [ ] Penetration test di base (OWASP Top 10)
- [ ] Privacy policy pubblicata
- [ ] Termini di servizio pubblicati
- [ ] Cookie banner attivo
- [ ] DPA template pronto
- [ ] Status page pubblica (`status.ambrogio.ai`)

### 9.2 Day of launch
- [ ] DNS propagato verificato (`dig ambrogio.ai`)
- [ ] SSL certificato valido
- [ ] Smoke test: signup flow end-to-end
- [ ] Smoke test: pagamento Stripe test card
- [ ] Smoke test: WhatsApp webhook
- [ ] Monitoring Sentry/PostHog attivo
- [ ] Alert Better Stack configurato
- [ ] Backup schedulato
- [ ] Rollback plan scritto (come revert se va male)

### 9.3 Post-launch (settimana 1)
- [ ] Monitora Sentry ogni 2h primi 2 giorni
- [ ] Check PostHog: signup funnel
- [ ] Check uptime: <0.1% downtime target
- [ ] Primo cliente onboardato (In2Pilates o amico)
- [ ] Raccogli feedback qualitativo
- [ ] Patch issues critiche entro 24h

---

## Rollback strategy

### Deploy rollback
Se un deploy rompe production:
1. Vercel Dashboard → Deployments → seleziona deploy precedente stabile → Promote to Production
2. Tempo: <30 secondi
3. Investigate root cause su branch
4. Fix + redeploy

### Database rollback
Se una migration rompe schema:
1. Supabase Dashboard → Database → Backups → restore PITR al punto pre-migration
2. Tempo: 5-30 minuti
3. **ATTENZIONE**: perdi modifiche tra migration e restore
4. Usa migrations reversibili sempre (up/down)

### Data disaster recovery
Se perdi tutto il DB:
1. Ripristina PITR Supabase fino a T-1h
2. Se >7 giorni: restore da backup settimanale su R2
3. Notifica utenti se perdita dati >1h
4. Postmortem pubblico

---

## Cost monitoring

Setup alert budget mensili:
- Vercel: alert a $50/mese
- Supabase: alert su storage > 80% piano
- Anthropic: alert quando >$100 settimanali
- 360dialog: alert se costo conversation spike

Review settimanale su Sunday: costi fissi + variabili + MRR delta.

---

## Team access

Quando assumi il primo dev:
- GitHub: collaborator con ruolo "Write" (no admin)
- Vercel: Team seat, ruolo "Developer" (no billing access)
- Supabase: membro team ruolo "Developer"
- Stripe: NO ACCESS finché non serve
- 1Password: shared vault per credenziali

Senior engineer che merita admin: dopo 3+ mesi di collaborazione fiduciaria.
### ElevenLabs

Configura in Vercel:
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_STT_MODEL=scribe_v2`
- `ELEVENLABS_TTS_MODEL=eleven_flash_v2_5`
- `ELEVENLABS_DEFAULT_VOICE_ID=<voice-id>`
- `ELEVENLABS_ENABLE_LOGGING=false`

Verifica:
- Vocale WhatsApp inbound scaricato da 360dialog.
- Trascrizione ElevenLabs salvata in `messages.transcript_text`.
- Risposta vocale opzionale salvata in storage e inviata come media audio.
- Zero Retention/EU Data Residency valutati prima di clienti sanitari sensibili.
