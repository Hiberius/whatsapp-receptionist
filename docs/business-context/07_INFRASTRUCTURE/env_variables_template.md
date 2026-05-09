# Environment Variables Template — Ambrogio.ai

## Istruzioni

Crea tre file `.env`:
- `.env.local` — per sviluppo locale (NON committare, aggiungi a `.gitignore`)
- `.env.example` — template con tutti i nomi variabili ma valori vuoti/finti (committare)
- `.env.production` — gestito via Vercel Environment Variables UI

**IMPORTANTE**: ogni variabile con prefisso `NEXT_PUBLIC_` è esposta nel browser. Quelle senza prefisso sono server-only. Non mettere MAI API keys sensibili in variabili `NEXT_PUBLIC_`.

---

## .env.example (committato)

```bash
# ============================================
# APP CONFIG
# ============================================
NEXT_PUBLIC_APP_URL="https://ambrogio.ai"
NEXT_PUBLIC_APP_NAME="Ambrogio.ai"
NODE_ENV="development"
APP_ENV="development" # development | staging | production

# Base URL used for callback, webhook, email links
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# ============================================
# SUPABASE (EU-WEST)
# ============================================
# Project URL (Settings → API)
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"

# Anon public key (safe in browser, protected by RLS)
NEXT_PUBLIC_SUPABASE_ANON_KEY=""

# Service role key (SERVER ONLY, bypassa RLS — NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=""

# Database direct URL (for Drizzle migrations)
SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
SUPABASE_MEDIA_BUCKET="ambrogio-media"

# Internal worker route protection
INTERNAL_JOB_SECRET="" # random 32+ bytes, used by cron/scheduler
INTERNAL_JOB_HEADER_NAME="x-ambrogio-job-secret"

# ============================================
# AUTHENTICATION
# ============================================
# NextAuth or custom JWT
AUTH_SECRET="" # generate: openssl rand -base64 32
AUTH_URL="http://localhost:3000"

# Google OAuth (for dentisti/veterinari login)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ============================================
# ANTHROPIC API
# ============================================
ANTHROPIC_API_KEY=""
ANTHROPIC_MODEL_PRIMARY=""
ANTHROPIC_MODEL_FAST=""
AMBROGIO_AI_AUTOREPLY_ENABLED="false"
AMBROGIO_VOICE_STT_MIN_CONFIDENCE="0.55" # sotto questa soglia, i vocali passano a handoff e non auto-rispondono

# Rate limiting
ANTHROPIC_MAX_TOKENS_PER_REQUEST="4000"
ANTHROPIC_MAX_REQUESTS_PER_MINUTE="50"

# ============================================
# OPENAI (solo per embeddings)
# ============================================
OPENAI_API_KEY=""
OPENAI_EMBEDDING_MODEL="text-embedding-3-large"

# ============================================
# ELEVENLABS (vocali WhatsApp: STT + TTS)
# ============================================
ELEVENLABS_API_KEY=""
ELEVENLABS_STT_MODEL="scribe_v2"
ELEVENLABS_TTS_MODEL="eleven_flash_v2_5"
ELEVENLABS_DEFAULT_VOICE_ID="JBFqnCBsd6RMkjVDRZzb"
# false = Zero Retention mode request when supported by plan.
ELEVENLABS_ENABLE_LOGGING="false"

# ============================================
# WHATSAPP BUSINESS CLOUD API (via 360dialog)
# ============================================
WHATSAPP_API_KEY=""                   # 360dialog API key
WHATSAPP_API_URL="https://waba-v2.360dialog.io"
WHATSAPP_MEDIA_MAX_BYTES="26214400"
WHATSAPP_PHONE_NUMBER_ID=""            # identificativo numero
WHATSAPP_BUSINESS_ACCOUNT_ID=""        # WABA ID
WHATSAPP_WEBHOOK_VERIFY_TOKEN=""       # random string for Meta verification
WHATSAPP_WEBHOOK_HEADER_NAME="x-ambrogio-webhook-secret"
WHATSAPP_WEBHOOK_HEADER_SECRET=""      # random 32+ bytes, configured as custom 360dialog webhook header
WHATSAPP_WEBHOOK_RATE_LIMIT_MAX="120"
WHATSAPP_WEBHOOK_RATE_LIMIT_WINDOW_MS="60000"

# ============================================
# STRIPE (pagamenti subscription)
# ============================================
STRIPE_SECRET_KEY="sk_test_..."        # test mode in dev, live in prod
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Price IDs (creati in Stripe Dashboard)
STRIPE_PRICE_STARTER="price_..."
STRIPE_PRICE_PROFESSIONAL="price_..."
STRIPE_PRICE_AGENCY="price_..."
STRIPE_PRICE_SETUP_FEE="price_..."

# ============================================
# FATTURE IN CLOUD (fatturazione elettronica SDI Italia)
# Solo se vendi B2B Italia con entità legale italiana
# ============================================
FATTUREINCLOUD_API_TOKEN=""
FATTUREINCLOUD_COMPANY_ID=""
# Mode: "live" o "test" (sandbox API)
FATTUREINCLOUD_MODE="test"

# ============================================
# EMAIL (Resend)
# ============================================
RESEND_API_KEY=""
RESEND_FROM_EMAIL="noreply@ambrogio.ai"
RESEND_REPLY_TO="support@ambrogio.ai"

# ============================================
# REDIS (Upstash - rate limiting, cache)
# ============================================
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# ============================================
# CLOUDFLARE R2 (object storage)
# ============================================
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="ambrogio-attachments"
R2_PUBLIC_URL="https://attachments.ambrogio.ai"

# ============================================
# TRIGGER.DEV (background jobs)
# ============================================
TRIGGER_API_KEY=""
TRIGGER_API_URL="https://api.trigger.dev"
TRIGGER_PROJECT_ID=""

# ============================================
# GOOGLE CALENDAR API
# ============================================
GOOGLE_OAUTH_CLIENT_ID=""
GOOGLE_OAUTH_CLIENT_SECRET=""
GOOGLE_OAUTH_AUTH_URL="https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_OAUTH_TOKEN_URL="https://oauth2.googleapis.com/token"
GOOGLE_OAUTH_REVOKE_URL="https://oauth2.googleapis.com/revoke"
GOOGLE_OAUTH_STATE_SECRET=""
GOOGLE_CALENDAR_REDIRECT_URI="http://localhost:3000/api/integrations/google-calendar/callback"
INTEGRATION_CREDENTIALS_ENCRYPTION_KEY=""

# ============================================
# MICROSOFT OUTLOOK CALENDAR
# ============================================
MICROSOFT_CLIENT_ID=""
MICROSOFT_CLIENT_SECRET=""
MICROSOFT_TENANT_ID="common"
MICROSOFT_REDIRECT_URI="http://localhost:3000/api/oauth/microsoft/callback"

# ============================================
# MONITORING & OBSERVABILITY
# ============================================
# Sentry
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_AUTH_TOKEN=""
SENTRY_ORG="ambrogio"
SENTRY_PROJECT="ambrogio-app"

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=""
NEXT_PUBLIC_POSTHOG_HOST="https://eu.posthog.com"

# Axiom (structured logs)
AXIOM_TOKEN=""
AXIOM_DATASET="ambrogio-prod"

# ============================================
# SECURITY
# ============================================
# JWT signing
JWT_SECRET=""  # generate: openssl rand -base64 64

# Encryption for sensitive fields in DB
ENCRYPTION_KEY=""  # AES-256 key, 32 bytes hex: openssl rand -hex 32

# CSRF protection
CSRF_SECRET=""  # generate: openssl rand -base64 32

# Generic webhook signing secret for providers that support HMAC signatures.
WEBHOOK_HMAC_SECRET=""

# ============================================
# RATE LIMITING (per tier)
# ============================================
RATE_LIMIT_WINDOW_MS="60000"  # 1 minute
RATE_LIMIT_STARTER_MAX="60"
RATE_LIMIT_PROFESSIONAL_MAX="200"
RATE_LIMIT_AGENCY_MAX="1000"

# ============================================
# FATTURAZIONE ELETTRONICA (Italia)
# ============================================
FATTUREINCLOUD_API_TOKEN=""
FATTUREINCLOUD_COMPANY_ID=""

# ============================================
# FEATURE FLAGS (default per ambiente)
# ============================================
FEATURE_WHITE_LABEL="true"
FEATURE_VOICE_CALLS="false"     # Vapi integration (roadmap)
FEATURE_MULTILINGUAL="true"
FEATURE_AGENCY_DASHBOARD="true"
FEATURE_API_ACCESS="false"       # enable for Agency tier

# ============================================
# ADMIN / INTERNAL
# ============================================
ADMIN_EMAIL="admin@ambrogio.ai"
ADMIN_PASSWORD_HASH=""          # bcrypt hash, setup iniziale

# Slack for internal notifications
SLACK_WEBHOOK_URL=""
SLACK_CHANNEL_ALERTS="#alerts"
SLACK_CHANNEL_NEW_CUSTOMERS="#customers"

# ============================================
# LOGGING LEVELS
# ============================================
LOG_LEVEL="info"  # debug | info | warn | error
LOG_PRETTY="true"  # pretty print in dev, false in prod
```

---

## Setup per ambiente

### Development locale
1. Copia `.env.example` in `.env.local`
2. Riempi solo:
   - Supabase (progetto dev separato)
   - Anthropic API key (test key)
   - Stripe test mode keys
   - 360dialog sandbox (ti danno numero test)
3. NON attivare:
   - Sentry (fa rumore in dev)
   - PostHog tracking
   - Resend (usa console.log per email)

### Staging (Vercel preview)
- Copia di production ma con:
  - Supabase progetto staging separato
  - Stripe test mode
  - 360dialog numero test
  - Sentry progetto `ambrogio-staging`

### Production (Vercel)
Variabili in `Vercel Dashboard → Project → Settings → Environment Variables`
- **Environment**: Production
- Tutti i valori "live" (Stripe live, Anthropic prod, etc.)
- `NODE_ENV=production`
- `APP_ENV=production`

---

## Generazione secrets sicuri

```bash
# Random base64 (AUTH_SECRET, CSRF_SECRET)
openssl rand -base64 32

# Random hex (ENCRYPTION_KEY 32 bytes)
openssl rand -hex 32

# Longer secret (JWT_SECRET)
openssl rand -base64 64

# UUID v4
uuidgen
```

---

## Validazione runtime (Zod)

Nel codice, valida tutte le env al boot per fallire early:

```typescript
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Server-only
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  WHATSAPP_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().startsWith('re_'),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  ENCRYPTION_KEY: z.string().length(64), // 32 bytes hex
  JWT_SECRET: z.string().min(64),
  
  // Public
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  
  NODE_ENV: z.enum(['development', 'production', 'test']),
})

export const env = envSchema.parse(process.env)
```

Importa sempre `env` invece di `process.env.XXX` nel codice.

---

## Rotazione secrets

### Periodicità consigliata
- **Ogni 90 giorni**: AUTH_SECRET, JWT_SECRET, CSRF_SECRET
- **Ogni 180 giorni**: ENCRYPTION_KEY (con migration dati cifrati)
- **Immediata se compromesso**: tutti
- **API key terze parti** (Anthropic, Stripe, etc.): rotate quando fornitore lo permette/consiglia

### Procedura rotate
1. Genera nuovo secret
2. Aggiorna Vercel env var
3. Redeploy (nuova versione usa il nuovo)
4. Rotate effettivo: genera nuovo Stripe webhook secret → aggiorna endpoint Stripe → aggiorna env var → verifica webhook funziona
5. Invalida vecchie sessioni se necessario (AUTH_SECRET rotation → tutti gli utenti fuori)

---

## Security checklist env

- [ ] `.env.local` in `.gitignore` ✅
- [ ] `.env.production` MAI committato ✅
- [ ] Vercel env vars marcate come "Sensitive" (encryption at rest)
- [ ] Access a Vercel Dashboard limitato a 2 persone (tu + co-founder)
- [ ] GitHub secret scanning attivo sul repo
- [ ] Dependabot attivo
- [ ] Rotation calendar documentato nel team
- [ ] `SUPABASE_SERVICE_ROLE_KEY` usata SOLO in Server Components/API Routes, mai client
- [ ] Zod validation al boot ferma build se env mancanti
- [ ] Diverse env per dev/staging/prod (no mix)
- [ ] Log NON stampano mai valori env
- [ ] Audit trail di chi ha modificato env vars (Vercel fa log nativo)

---

## Lista critica variabili da NON esporre

Queste vanno **SOLO server-side**. Se le vedi in un `NEXT_PUBLIC_` è un bug critico di sicurezza:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `WHATSAPP_API_KEY`
- `RESEND_API_KEY`
- `UPSTASH_REDIS_REST_TOKEN`
- `R2_SECRET_ACCESS_KEY`
- `ENCRYPTION_KEY`
- `JWT_SECRET`
- `AUTH_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_STATE_SECRET`
- `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY`
- `MICROSOFT_CLIENT_SECRET`
- `FATTUREINCLOUD_API_KEY`
- `SENTRY_AUTH_TOKEN`
- Qualsiasi webhook secret

**Controllo automatico**: aggiungi pre-commit hook che grepa `NEXT_PUBLIC_` + parole sensibili.

```bash
# .husky/pre-commit
if grep -r "NEXT_PUBLIC_.*\(SECRET\|KEY\|TOKEN\)" --include="*.ts" --include="*.tsx" --include="*.js" .; then
  echo "❌ ERRORE: potenziale secret esposto come NEXT_PUBLIC_"
  exit 1
fi
```
