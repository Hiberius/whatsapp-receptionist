# Deployment guide

This document walks you through deploying WhatsApp Receptionist to production. There are three supported paths:

1. **Vercel** (recommended, fastest)
2. **Cloudflare Pages**
3. **Self-host** with Docker / docker-compose

Italian readers: see [`deployment.it.md`](deployment.it.md) for the original Italian-language detailed runbook.

---

## Prerequisites

You'll need accounts with these external services:

| Service | Region | Purpose | Cost (small tenant) |
|---|---|---|---|
| **Supabase** | EU (Frankfurt) | Database + Auth + Storage | Free Hobby tier |
| **Vercel** *or* Cloudflare *or* your VPS | EU | Application hosting | Free tier or $20+/mo |
| **Upstash Redis** | EU | Rate limiting + queues | Free tier |
| **Stripe** | EU (Ireland) | Subscriptions + webhook | % of transactions |
| **Meta Business Manager** | — | WhatsApp Business Account verification | Free (1–3 weeks) |
| **Google Cloud** | — | OAuth credentials for Calendar | Free |
| **Anthropic** | EU available | Claude API | Pay per token |
| **ElevenLabs** | EU available | Voice STT/TTS | $5–22/mo |
| **Fatture in Cloud** | IT | Italian SDI invoicing (optional) | €20/mo |
| **Resend** | EU | Transactional email (optional) | Free tier |
| **Sentry** | EU | Error tracking (optional) | Free tier |

---

## Option 1 — Vercel (recommended)

### 1.1 Provision external services

1. **Supabase**: create project in Frankfurt. Copy `URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`.
2. **Stripe**: create Live products matching your plan structure. Copy `SECRET_KEY`. Set up webhook to `https://your-domain.com/api/webhook/stripe` and copy `WEBHOOK_SECRET`.
3. **Meta WhatsApp**: verify Business Account (this takes 1–3 weeks). Create WABA + phone number. Generate permanent access token. Configure webhook to `https://your-domain.com/api/webhook/whatsapp`.
4. **Google Cloud**: create OAuth 2.0 credentials. Add `https://your-domain.com/api/integrations/google-calendar/callback` to Authorised redirect URIs. Submit consent screen for production review.
5. **Anthropic**: create API key with production quota.
6. **ElevenLabs**: subscribe, copy API key, choose Italian voice ID.
7. **Upstash**: create Redis database in EU region. Copy REST URL and token.
8. **Fatture in Cloud** (optional): generate API token with `issued_documents:rwa` scope, retrieve company ID.

### 1.2 Apply database migrations

```bash
npx supabase link --project-ref <your-supabase-project-ref>
npx supabase db push
```

Verify RLS coverage:

```bash
npm run db:lint
```

Expected output: `RLS migration coverage OK for 21 tables.`

### 1.3 Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel link

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add WHATSAPP_VERIFY_TOKEN production
vercel env add WHATSAPP_APP_SECRET production
vercel env add WHATSAPP_ACCESS_TOKEN production
vercel env add WHATSAPP_WEBHOOK_HEADER_SECRET production
vercel env add ELEVENLABS_API_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add INTERNAL_JOB_SECRET production
vercel env add OAUTH_STATE_SECRET production
vercel env add GOOGLE_OAUTH_CLIENT_ID production
vercel env add GOOGLE_OAUTH_CLIENT_SECRET production
# Optional:
vercel env add FATTURE_IN_CLOUD_API_TOKEN production
vercel env add FATTURE_IN_CLOUD_COMPANY_ID production
vercel env add SENTRY_DSN production
vercel env add RESEND_API_KEY production

# Set region: Settings → Functions → Default Region → fra1 (Frankfurt)

# Deploy preview
vercel

# Promote to production
vercel --prod
```

### 1.4 Configure DNS

Recommended: Cloudflare DNS in front of Vercel for additional security headers, caching, DDoS protection.

```
A     @       76.76.21.21        # Vercel
CNAME www     cname.vercel-dns.com
CNAME *       cname.vercel-dns.com  # if you want subdomain white-labelling
```

SSL is automatic via Let's Encrypt (Vercel manages it).

### 1.5 Cron jobs

`vercel.json` is already configured with the required cron schedule:

```json
{
  "crons": [
    { "path": "/api/internal/jobs/whatsapp-outbox", "schedule": "* * * * *" },
    { "path": "/api/internal/jobs/whatsapp-voice", "schedule": "* * * * *" },
    { "path": "/api/internal/jobs/whatsapp-template-sync", "schedule": "0 6 * * *" },
    { "path": "/api/internal/jobs/appointment-reminders", "schedule": "*/5 * * * *" },
    { "path": "/api/internal/jobs/gdpr-hard-delete", "schedule": "0 3 * * *" }
  ]
}
```

These require the `INTERNAL_JOB_SECRET` env var as `Authorization: Bearer <secret>` header. Vercel Cron sends this automatically when the env var is set.

---

## Option 2 — Cloudflare Pages

Cloudflare Pages with Workers is a viable alternative to Vercel, often cheaper and faster for global distribution.

### Caveats

- Edge runtime is the default — make sure your Server Components don't depend on Node-only APIs
- Cron requires Cloudflare Workers Cron Triggers (configure in `wrangler.toml`)
- Image optimization works differently — consider using Cloudflare Images
- Some features (like ISR) work but require Cloudflare's adapter

### Setup

```bash
npm install -D @cloudflare/next-on-pages
npx @cloudflare/next-on-pages
wrangler pages deploy .vercel/output/static
```

Add env vars via the Cloudflare dashboard. Configure cron in `wrangler.toml`.

---

## Option 3 — Self-host with Docker

For air-gapped deployments, EU sovereignty requirements, or full control.

### 3.1 Build the image

```bash
docker build -t whatsapp-receptionist:latest .
```

The `Dockerfile` is multi-stage:

- `deps` — installs production + dev dependencies
- `builder` — runs `next build` with `output: 'standalone'`
- `runner` — minimal `node:22-alpine` with non-root user

### 3.2 Run with docker-compose

```bash
cp .env.example .env.docker
# Fill in your env vars

docker-compose up -d
```

The compose file includes:

- `web` — your application (port 3000)
- `redis` — Valkey 8 alpine (Redis-compatible, free)
- (commented out) Caddy reverse proxy template

### 3.3 Reverse proxy with Caddy

Uncomment the Caddy section in `docker-compose.yml`. Create `Caddyfile`:

```caddy
your-domain.com {
  reverse_proxy web:3000
  encode gzip
}
```

Caddy handles SSL automatically via Let's Encrypt.

### 3.4 Self-host Supabase (advanced)

If you don't want to use Supabase Cloud, see [supabase/docker](https://github.com/supabase/supabase/tree/master/docker) for self-hosting instructions. You'll lose some convenience (managed backups, branch databases) but gain full control.

---

## Smoke test post-deploy

```bash
# Health check
curl https://your-domain.com/api/health
# Expected: { "ok": true, "service": "whatsapp-receptionist", ... }

# Deep health (checks Supabase + Upstash + Stripe)
curl https://your-domain.com/api/health/deep
# Expected: { "ok": true, "checks": [...] }

# Security headers
curl -I https://your-domain.com/
# Verify: CSP with nonce, HSTS, COEP, COOP, X-Frame-Options: DENY

# Stripe webhook test
stripe trigger checkout.session.completed --api-key=sk_live_...
# Verify event recorded in Supabase webhook_events table

# Lighthouse (mobile)
npx lighthouse https://your-domain.com --only-categories=performance,accessibility,best-practices,seo
# Target: all ≥ 90

# securityheaders.com
# Visit https://securityheaders.com/?q=your-domain.com
# Target: A+ rating
```

---

## Monitoring

- **Vercel Analytics**: built-in Web Vitals
- **Sentry**: errors, source maps, release tracking
- **Stripe webhook failures**: alerts via Stripe dashboard
- **Upstash dashboard**: rate limit anomalies
- **Supabase logs**: SQL slow queries, RLS violations

Set up alerts on:

- Webhook failure rate > 1%
- API error rate > 1%
- Database connection pool exhaustion
- Anthropic API quota approaching limit

---

## Disaster recovery

- **Database**: Supabase Pro daily backups, 7-day retention. Team tier: 30-day retention + point-in-time recovery
- **Manual backup**: schedule `pg_dump` cron to encrypted S3/R2 bucket
- **Restore**: tested quarterly. Document RTO (Recovery Time Objective) and RPO (Recovery Point Objective) for your business
- **Recommended targets**: RTO 4 hours, RPO 1 hour

---

## Rollback

```bash
# Vercel
vercel rollback <deployment-url>

# Database
# Migrations are additive. To roll back, create a new forward migration that reverses the change.
# Never edit historical migration files.

# Docker
docker-compose down
docker pull whatsapp-receptionist:<previous-tag>
docker-compose up -d
```

---

## Pre-launch checklist

- [ ] All secrets configured in production env (not committed to git)
- [ ] DNS configured with SSL active
- [ ] Stripe webhook tested end-to-end with `stripe trigger`
- [ ] Meta WhatsApp Business Account verified, permanent token obtained
- [ ] Google OAuth consent screen approved by Google for production
- [ ] Privacy Policy, Terms of Service, DPA, Cookie Policy published and linked from footer
- [ ] Cookie banner implemented (CMP if needed)
- [ ] Transactional email setup with DKIM + SPF on your sending domain
- [ ] Sentry configured with proper release tracking
- [ ] Lighthouse mobile + desktop scores ≥ 90
- [ ] securityheaders.com → A+
- [ ] OWASP ZAP baseline scan passed
- [ ] Database backup verified (try a restore!)
- [ ] Incident response runbook documented
- [ ] Public status page (statuspal.io / Better Uptime / similar)
- [ ] At least 1–3 pilot tenants identified for beta testing
