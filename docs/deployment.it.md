# Deployment guide — Ambrogio.ai

## Pre-requisiti

Account / servizi da provisionare prima del deploy:

| Servizio | Region | Note |
|---|---|---|
| Vercel Pro | EU (fra1) | Hosting Next.js, edge runtime, OG images |
| Supabase | EU Frankfurt | Database + Auth + Storage |
| Upstash Redis | EU | Rate limit + queue |
| Stripe | EU (Ireland) | Subscriptions + Customer Portal + webhook |
| Meta Business Manager | — | WhatsApp Business Account verificato |
| Google Cloud | EU | OAuth Calendar (consent screen production review) |
| Anthropic | EU region | API key con quota production |
| ElevenLabs | EU | Subscription + voice ID |
| Fatture in Cloud | IT | API token + company id |
| Resend | EU | DKIM + SPF su dominio custom |
| Sentry | EU | Error tracking (opzionale ma raccomandato) |

## Sequenza di deploy

### 1. Provisioning servizi

```bash
# Supabase
# - Crea progetto in Frankfurt
# - Esegui migrations: npx supabase db push
# - Verifica RLS: npm run db:lint
# - Crea bucket storage per audio/media

# Stripe
# - Crea prodotti: Starter (€97), Professional (€297), Agency (€897)
# - Configura webhook: https://your-domain.com/api/webhook/stripe
#   eventi: checkout.session.completed, customer.subscription.*, invoice.*
# - Salva STRIPE_WEBHOOK_SECRET

# Meta WhatsApp
# - Verifica Business Account (1-3 settimane)
# - Crea WABA + numero
# - Genera permanent access token
# - Configura webhook: https://your-domain.com/api/webhook/whatsapp

# Google Calendar OAuth
# - Crea credenziali OAuth 2.0
# - Authorized redirect URI: https://your-domain.com/api/integrations/google-calendar/callback
# - Submit consent screen per production review

# Fatture in Cloud
# - Genera API token con scope "issued_documents:rwa"
# - Recupera company_id

# Upstash
# - Crea database Redis EU
# - Salva REST URL + token
```

### 2. Configurazione Vercel

```bash
# Login + link progetto
vercel login
vercel link

# Configura env (production)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add WHATSAPP_VERIFY_TOKEN production
vercel env add WHATSAPP_APP_SECRET production
vercel env add WHATSAPP_ACCESS_TOKEN production
vercel env add ELEVENLABS_API_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add INTERNAL_JOB_SECRET production
vercel env add WHATSAPP_WEBHOOK_HEADER_SECRET production
vercel env add FATTURE_IN_CLOUD_API_TOKEN production
vercel env add FATTURE_IN_CLOUD_COMPANY_ID production
vercel env add GOOGLE_OAUTH_CLIENT_ID production
vercel env add GOOGLE_OAUTH_CLIENT_SECRET production
vercel env add OAUTH_STATE_SECRET production

# Region: fra1
# Settings → Functions → Default Region → Frankfurt (fra1)

# Deploy preview
vercel

# Promote to production
vercel --prod
```

### 3. Cron jobs

Vercel Cron (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/internal/jobs/whatsapp-outbox",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/internal/jobs/whatsapp-voice",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/internal/jobs/whatsapp-template-sync",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/internal/jobs/appointment-reminders",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/internal/jobs/gdpr-hard-delete",
      "schedule": "0 3 * * *"
    }
  ]
}
```

I cron job richiedono `INTERNAL_JOB_SECRET` come header `Authorization: Bearer <secret>`.

### 4. DNS + SSL

```bash
# Cloudflare DNS (consigliato per EDGE):
# A     @       76.76.21.21 (Vercel)
# CNAME www     cname.vercel-dns.com
# CNAME api     cname.vercel-dns.com (per /api split, opzionale)
# CNAME *       cname.vercel-dns.com (multi-tenant white-label)

# SSL: Vercel gestisce automaticamente Let's Encrypt
```

### 5. Smoke test post-deploy

```bash
# Health check
curl https://your-domain.com/api/health

# Security headers
curl -I https://your-domain.com/
# Verifica CSP, HSTS, COEP, COOP, X-Frame-Options

# Webhook signature
stripe trigger checkout.session.completed --api-key=sk_test_...
# Verifica processato in Supabase webhook_events

# Lighthouse (mobile)
npx lighthouse https://your-domain.com --only-categories=performance,accessibility,best-practices,seo
# Target: tutti >= 90
```

## Monitoring

- **Vercel Analytics**: built-in, attivare in dashboard
- **Sentry**: error tracking, configura DSN come `SENTRY_DSN` env
- **Stripe webhook failures**: alert email automatico
- **Upstash dashboard**: monitor rate limit anomalie
- **Supabase logs**: SQL slow query, RLS violations

## Disaster recovery

- **Database**: Supabase backup automatici daily, retention 7gg (Pro), 30gg (Team)
- **Backup manuale**: `pg_dump` schedulato + S3 EU encrypted
- **Restore**: testato trimestralmente
- **RTO**: 4 ore | **RPO**: 1 ora

## Rollback

```bash
# Vercel
vercel rollback <deployment-url>

# Database migration rollback
# Le migrations sono additive. Per rollback usare migrazione inversa esplicita.
```

## Checklist pre-launch (estratto da 08_LAUNCH_CHECKLIST.md)

- [ ] Tutti i secret in Vercel env (production)
- [ ] DNS configurato + SSL attivo
- [ ] Webhook Stripe testato con stripe CLI
- [ ] WhatsApp WABA verificato + token permanent
- [ ] Google OAuth consent screen approvato
- [ ] Privacy/Terms/DPA pubblicati e linkati nel footer
- [ ] Cookie banner testato
- [ ] Email transazionali da resend.com con DKIM/SPF
- [ ] Sentry configurato
- [ ] Lighthouse mobile/desktop ≥ 90
- [ ] securityheaders.com → A+
- [ ] OWASP ZAP baseline scan pulito
- [ ] Backup database verificato
- [ ] Runbook incident response in `docs/runbooks/`
- [ ] Status page pubblica (status.ambrogio.ai)
- [ ] Lista 5 clienti pilota per la beta privata
