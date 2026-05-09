# PROMPT 11 - SECURITY HARDENING

## PROMPT OPERATIVO CODEX

Pre-lancio obbligatorio: hardening sicurezza completo. Se qualcosa qui fallisce, NON lanciare.

STEP 1 - Security headers completi

next.config.ts con headers massimi:

```typescript
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com https://app.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://app.posthog.com wss://*.supabase.co; frame-src https://js.stripe.com; form-action 'self';"
  }
]
```

Test CSP con Chrome DevTools - nessun warning.

STEP 2 - Rate limiting globale

Installa @upstash/ratelimit. Crea middleware rate limiting:

```typescript
// Tiers diversi:
// - Pubblico (non autenticato): 10 req/min per IP
// - Autenticato: 100 req/min per user
// - API keys: 500 req/min per key
// - Webhook pubblici: 500 req/min per IP
// - Login endpoint: 5 req/15min per IP
// - Password reset: 3 req/hour per email
```

Se triggera rate limit: ritorna 429 con Retry-After header.

STEP 3 - Input sanitization & validation

Ogni endpoint API:
1. Parsing body con Zod (reject se schema fallisce)
2. DOMPurify su qualunque HTML accettato
3. SQL injection: mai stringhe raw, sempre Supabase client parametrizzato
4. Path traversal: validation su file paths user-provided
5. XSS: escape output, mai dangerouslySetInnerHTML

Crea utility src/lib/validation/sanitize.ts con funzioni helper.

STEP 4 - Secrets management audit

Run manuale:
```bash
gitleaks detect --source . --verbose
```

Se trova secrets: 
- Rotate immediatamente (Supabase keys, Stripe keys, Anthropic keys)
- Rewrite git history con git-filter-repo per rimuovere dal passato
- Nuovo commit con solo riferimenti a env vars

STEP 5 - SQL injection test

Test manuale con payloads comuni:
- ' OR '1'='1
- '; DROP TABLE users; --
- UNION SELECT * FROM auth.users

Su ogni input field: deve ritornare errore validation, non eseguire query.

STEP 6 - OWASP ZAP scan

Installa OWASP ZAP. Run automated scan contro staging:
```bash
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://staging.ambrogio.ai
```

Fix tutti i findings High e Medium. Documenta i Low come "accepted risk" se non fixabili.

STEP 7 - Dependency audit

```bash
npm audit --production
```

Fix tutte vulnerabilities critical + high. Se conflict, valuta swap di libreria.

Setup Dependabot su GitHub per updates automatici.

STEP 8 - Authentication security

Verifica:
- Password policy enforced (12+ char, complessita')
- MFA attiva per admin
- Session timeout rolling 7gg
- Logout on password change
- Revoca token su tutti i device quando cambia password
- Brute force protection: lock account dopo 10 tentativi in 1h

STEP 9 - Webhook security

Ogni webhook endpoint verifica la protezione corretta per il provider:
- WhatsApp: usa header segreto custom configurato in 360dialog Hub/API + Cloudflare WAF + idempotenza/replay protection. Preferisci anche `X-Hub-Signature-256` con HMAC-SHA256 solo se disponibile e confermato nel setup 360dialog/Meta reale.
- Stripe: Stripe-Signature con Stripe webhooks secret
- Reject senza signature valida, logga tentativo

STEP 10 - Data encryption

- Encryption at rest: default Supabase (AES-256)
- Encryption in transit: HTTPS obbligatorio everywhere
- Column-level encryption per dati sensibili:
  - integrations.credentials (token OAuth, API keys clienti)
  - users.phone (se salviamo numeri personali)
- Usa Supabase Vault per encryption key management

STEP 11 - Audit logging

Ogni azione sensibile loggata in audit_log:
- Login/logout
- Password change
- MFA setup/disable
- Role changes
- Delete actions (user, tenant, conversation)
- Data export
- Admin actions

Log immutabili (INSERT ONLY, mai UPDATE/DELETE tramite RLS).

STEP 12 - Backup e disaster recovery

- Supabase backup automatico daily (retention 30 giorni con piano Pro)
- Export settimanale full DB su Cloudflare R2 (encrypted)
- Test restore mensile (verifica backup non corrotti)
- Document RTO (Recovery Time Objective) e RPO (Recovery Point Objective):
  - RTO target: 4 ore
  - RPO target: 24 ore

STEP 13 - Monitoring e alerting

Sentry + PostHog setup:
- Alert email se error rate > 1% su 5 min
- Alert se AI accuracy drop sotto 80%
- Alert se database connection pool exhausted
- Alert se webhook fallisce > 3 volte consecutive
- Alert se pagamento Stripe fallito (per qualsiasi cliente)
- Alert se utilizzo AI costs supera $100/giorno (early warning cost runaway)

Dashboard pubblico status page: statuspage.ambrogio.ai (mostra uptime component-by-component).

STEP 14 - Incident response plan

Documento incident-response.md con:
- Chi fa cosa in caso di breach (tu + partner se hai)
- Chi contattare (Supabase support, Cloudflare, Anthropic)
- Timeline di risposta: < 1h acknowledge, < 4h mitigate, < 72h GDPR notification ai clienti se data breach
- Template comunicazione ai clienti finali
- Template notifica Garante Privacy italiano (obbligatoria entro 72h per data breach)

STEP 15 - Penetration test finale

Prima del lancio: assumi un pen tester per 1 giorno (€500-1000) o fai trial di Astra Pentest.

Non skippare. Meglio scoprire i problemi PRIMA di avere clienti.

Report finale security con:
- Checklist completa (tutti passed)
- Score security (obiettivo: A+ su securityheaders.com, A su SSL Labs)
- Piano remediation su eventuali findings
