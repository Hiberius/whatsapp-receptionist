# Security Checklist Pre-Launch — Ambrogio.ai

## Uso

Questo è il documento che DEVI completare al 100% PRIMA di aprire le registrazioni pubbliche. Ogni voce non spuntata è un potenziale data breach.

Esegui questa checklist:
1. **1 mese prima del launch**: primo passaggio completo
2. **1 settimana prima**: secondo passaggio + fix issue rimaste
3. **Giorno del launch**: verifica finale delle voci critiche marcate con 🚨
4. **Ogni trimestre post-launch**: ri-audit completo

---

## 1. AUTENTICAZIONE & AUTHORIZATION

### Core auth
- [ ] 🚨 Password minima 12 caratteri con requisiti complexity
- [ ] 🚨 Password hashing con bcrypt (rounds ≥12) o Argon2id
- [ ] 🚨 Nessuna password in chiaro MAI in DB, log, email
- [ ] Password reset via email con token one-time, scadenza 1h
- [ ] Rate limit login: 5 tentativi falliti → blocco 15min
- [ ] Rate limit password reset: 3/ora per email
- [ ] 🚨 2FA TOTP obbligatoria per admin e owner tenant
- [ ] 2FA TOTP opzionale ma incentivata per tutti gli utenti
- [ ] Session timeout: 30 giorni con refresh, revocabili da UI
- [ ] Logout invalida tutte le sessioni (option) o sessione corrente
- [ ] Email verification obbligatoria prima di usare app
- [ ] Login da nuovo device: email notification obbligatoria

### OAuth
- [ ] State parameter usato e validato (CSRF protection)
- [ ] PKCE flow per OAuth mobile/SPA
- [ ] Redirect URI whitelist stretta (no wildcard)
- [ ] Scopes minimi richiesti (principle of least privilege)

### Authorization
- [ ] 🚨 Ogni endpoint API verifica: autenticato? autorizzato a questo tenant? ha il ruolo?
- [ ] Middleware global che blocca request non autenticate su `/api/*`
- [ ] Role-based access control (RBAC): Owner, Admin, AM, Support
- [ ] Impossibile accedere a dati di altro tenant (test RLS)
- [ ] Admin panel separato con 2FA forzata

---

## 2. MULTI-TENANCY ISOLATION

### Database isolation
- [ ] 🚨 RLS attiva su OGNI tabella (verifica query)
- [ ] 🚨 Ogni tabella ha colonna `tenant_id NOT NULL`
- [ ] Index su `tenant_id` per performance
- [ ] JWT claim `tenant_id` injected via Supabase auth hook
- [ ] RLS policies basate SOLO su `auth.jwt() ->> 'tenant_id'`
- [ ] Test isolation: user tenant A non può leggere/scrivere dati tenant B
- [ ] Test isolation automatizzato in CI

### Application isolation
- [ ] Cache key include `tenant_id` (no cross-tenant leak cache)
- [ ] File storage path include `tenant_id` (es. `r2://tenant-xxx/...`)
- [ ] Logs includono `tenant_id` per audit
- [ ] Search/embedding queries filtrate per `tenant_id`
- [ ] Rate limiting per-tenant non globale

### Service role key
- [ ] 🚨 `SUPABASE_SERVICE_ROLE_KEY` usata SOLO server-side
- [ ] 🚨 Mai exposed in `NEXT_PUBLIC_*`
- [ ] 🚨 Mai loggata
- [ ] Pre-commit hook check contro leak

---

## 3. INPUT VALIDATION & SANITIZATION

- [ ] 🚨 Zod schema validation su OGNI endpoint API
- [ ] Validazione server-side, mai solo client-side
- [ ] SQL injection: Drizzle ORM con prepared statements (never raw SQL concat)
- [ ] NoSQL injection: N/A (usiamo Postgres)
- [ ] XSS: React escapa di default, no `dangerouslySetInnerHTML` su user input
- [ ] HTML sanitization con DOMPurify se mostri HTML utente
- [ ] Command injection: no `exec()` mai con user input
- [ ] Path traversal: sanifica path file con `path.normalize()` + whitelist
- [ ] File upload: check MIME type + size + magic bytes
- [ ] File upload: virus scan (ClamAV or simili) per allegati WhatsApp
- [ ] Markdown rendering: solo safe HTML sanitized
- [ ] URL validation: whitelist schemes (https only), no javascript:

---

## 4. API SECURITY

### General
- [ ] 🚨 HTTPS only, HSTS enabled (max-age 31536000)
- [ ] 🚨 CORS configurato stretto (no `*`, whitelist domini)
- [ ] CSRF token su mutations (fetcher che cambia state)
- [ ] SameSite=Lax o Strict su cookie session
- [ ] Secure flag su cookie
- [ ] HttpOnly flag su session cookie

### Rate limiting
- [ ] 🚨 Rate limit per-IP su `/api/*` (60 req/min baseline)
- [ ] 🚨 Rate limit per-tenant su API (vedi tech_stack.md)
- [ ] Rate limit più stretto su login, password reset, webhook public
- [ ] Risposta 429 con header `Retry-After`
- [ ] Log tentativi sopra soglia per security monitoring

### Endpoint protection
- [ ] Nessun endpoint espone dati senza auth check
- [ ] Endpoint admin segregati su `/api/admin/*` con middleware
- [ ] Webhook endpoints validano sicurezza provider-specific: HMAC per Stripe; header segreto custom + idempotenza per WhatsApp/360dialog
- [ ] Webhook endpoints idempotenti (no double-processing)
- [ ] API versioning: `/api/v1/*` per future changes compatibili

---

## 5. SECRETS & CRYPTOGRAPHY

### Storage
- [ ] 🚨 Secrets in Vercel Env Vars encrypted, no in codice
- [ ] `.env.local` in `.gitignore`
- [ ] Secrets rotated: plan 90 giorni (vedi env template)
- [ ] Separate secrets per dev/staging/prod
- [ ] Secret scanning GitHub attivo
- [ ] Pre-commit hook anti-leak secrets

### Encryption
- [ ] 🚨 TLS 1.2+ only (TLS 1.3 preferito)
- [ ] Certificato SSL valido (Let's Encrypt via Vercel/Cloudflare)
- [ ] Dati sensibili at-rest encrypted (Supabase gestisce automaticamente)
- [ ] Campi PII sensibili (telefoni pazienti) encrypted a livello colonna con AES-256 se richiesto da DPIA
- [ ] Encryption keys gestite separatamente da DB (env var)
- [ ] No weak ciphers (no MD5, SHA-1 per security)
- [ ] Password hashing con bcrypt ≥12 rounds o Argon2id

### JWT
- [ ] Secret ≥256 bit random
- [ ] Short expiration (15-60 min), refresh token separato
- [ ] Claims minimi necessari (no full user object)
- [ ] Algorithm explicit check (no "none" algorithm attack)
- [ ] JWT signed, non criptato (sufficient for our use)

---

## 6. DATABASE SECURITY

- [ ] 🚨 RLS attiva su tutte le tabelle (verifica SQL query)
- [ ] 🚨 Connection string con SSL (`sslmode=require`)
- [ ] Connection pooling via Supavisor configurato
- [ ] Backup automatici ogni giorno (Supabase Pro: PITR)
- [ ] Backup esterni settimanali su R2 (retention 90g)
- [ ] Test restore ogni trimestre
- [ ] No superuser access via app (solo via dashboard)
- [ ] Migrations reversibili quando possibile
- [ ] Database audit log attivo (Supabase logs)
- [ ] Query lente loggate per prevenire DoS via query pesanti
- [ ] Prepared statements ovunque (Drizzle lo fa nativo)

---

## 7. WHATSAPP INTEGRATION SECURITY

- [ ] 🚨 Header segreto custom configurato in 360dialog e verificato sul webhook Ambrogio
- [ ] 🚨 Idempotenza/replay protection su `messages.id` e `statuses.id`
- [ ] Webhook endpoint behind Cloudflare WAF
- [ ] Rate limit su webhook per numero business
- [ ] Encrypt media download da WhatsApp prima storage
- [ ] Non loggare contenuto messaggi completo (privacy)
- [ ] Solo metadata loggati (timestamp, sender masked)
- [ ] IP allowlist 360dialog (se disponibile)
- [ ] Access token WhatsApp rotated periodicamente

---

## 8. AI / LLM SECURITY

### Prompt injection
- [ ] Separazione chiara: system prompt vs user input vs retrieval context
- [ ] Input user filtrato per prompt injection patterns comuni
- [ ] AI output validato prima di eseguire azioni (appointment booking, email send)
- [ ] Output parse con Zod schema
- [ ] Jailbreak patterns monitorati (es. "ignore previous instructions")

### Data leakage
- [ ] Conversazioni tenant A non visibili in embeddings tenant B (filter pgvector query)
- [ ] No training su dati cliente senza consenso esplicito (no secondary use)
- [ ] Anthropic API: log disabilitato in Zero Retention mode se clienti sensibili
- [ ] Sensitive PII masked before sending to LLM (es. CF, numeri TS)
- [ ] ElevenLabs: `ELEVENLABS_ENABLE_LOGGING=false` per richieste vocali quando supportato dal piano
- [ ] Vocali WhatsApp salvati solo in storage tenant-scoped, con retention coerente GDPR
- [ ] Transcript vocali trattati come dati personali/sanitari se il contenuto lo implica
- [ ] Voice cloning disabilitato finche' non esiste consenso scritto del titolare della voce

### Content safety
- [ ] System prompt esplicita: "NON dare consigli medici"
- [ ] System prompt esplicita: "NON consigliare dosaggi farmaci"
- [ ] Output filtering se cliente fa settoriale sanitario
- [ ] Escalation automatica a umano per keyword critiche (es. "suicidio", "emergenza")

---

## 9. STRIPE & PAGAMENTI

- [ ] 🚨 Webhook Stripe verifica firma
- [ ] 🚨 No card data mai tocca server (Stripe Elements client-side)
- [ ] PCI-DSS compliance delegata a Stripe (SAQ-A)
- [ ] Test mode separato da production
- [ ] Idempotency keys su subscription creation
- [ ] Retry logic su webhook failures
- [ ] Reconciliation giornaliera Stripe vs DB interno

---

## 10. FRONTEND SECURITY

### Headers
- [ ] 🚨 Content-Security-Policy stretto
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY (o CSP frame-ancestors)
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy: disable unused features
- [ ] Strict-Transport-Security (HSTS) con preload

### React/Next.js
- [ ] No `dangerouslySetInnerHTML` con user input
- [ ] Sanitize any user-generated HTML con DOMPurify
- [ ] Next.js Image component per evitare SSRF via immagini
- [ ] No `eval()` mai
- [ ] Dependencies aggiornate (Dependabot)

### Client-side storage
- [ ] No sensitive data in localStorage
- [ ] Session token in HttpOnly cookie, non localStorage
- [ ] Clear sensitive data on logout

---

## 11. INFRASTRUCTURE SECURITY

### Cloudflare
- [ ] 🚨 WAF attivo (Cloudflare Pro)
- [ ] OWASP Core Rule Set enabled
- [ ] DDoS protection attivo
- [ ] Bot Fight Mode ON
- [ ] Rate limiting edge-level (prima di arrivare a server)

### Vercel
- [ ] Deploy protection: preview URL require auth (env var `VERCEL_DEPLOYMENT_PROTECTION`)
- [ ] Environment vars marked Sensitive
- [ ] Log retention adeguata (14 giorni default, 30+ Pro)
- [ ] Team access minimo necessario

### Network
- [ ] Nessuna porta aperta oltre 443 (HTTPS)
- [ ] No SSH diretto a server (managed by Vercel/Supabase)
- [ ] VPN non necessaria (tutto SaaS)

---

## 12. LOGGING & MONITORING

- [ ] 🚨 Structured logging JSON su ogni endpoint
- [ ] 🚨 Tenant ID in OGNI log entry
- [ ] Request ID per tracing
- [ ] Log errors su Sentry
- [ ] Log eventi security su Axiom/Logflare
- [ ] Audit log tabella DB append-only (chi, cosa, quando, da dove IP)
- [ ] Retention log 90 giorni (settings Axiom)
- [ ] Alert su pattern sospetti:
  - Login falliti >5 da stesso IP
  - Signup da stesso IP >10/h
  - Errori 500 spike
  - Webhook signature failures
  - Rate limit exceeded repetuto
- [ ] No PII/secrets in log (password, token, CF, numeri completi)

---

## 13. DEPENDENCY MANAGEMENT

- [ ] 🚨 Nessuna dependency con vulnerabilità critical (pnpm audit)
- [ ] Dependabot PR review settimanale
- [ ] Lock file committato (pnpm-lock.yaml)
- [ ] Nessun package abbandonato (ultima release >2 anni senza manutenzione → replace)
- [ ] Review manuale di nuove deps prima di aggiungere
- [ ] No dev dependency in production build
- [ ] Dependency confusion attack protection (scope packages)

---

## 14. GDPR COMPLIANCE

- [ ] 🚨 Privacy policy pubblicata e linkata
- [ ] 🚨 Termini di servizio pubblicati
- [ ] Cookie banner con consent granulare (non dark pattern)
- [ ] Data processing agreement (DPA) template pronto
- [ ] Data residency EU verificata per ogni servizio
- [ ] Data retention policy definita (quando cancellare)
- [ ] User ha right to access: export dati JSON
- [ ] User ha right to delete: cascade delete completa
- [ ] User ha right to portability: export formato standard
- [ ] Data breach notification plan: <72h a DPA
- [ ] DPO designato (se volume richiede)
- [ ] DPIA completata per processing dati sanitari

---

## 15. DISASTER RECOVERY

- [ ] Backup testati ogni trimestre (restore su staging)
- [ ] Piano disaster recovery documentato
- [ ] RTO (Recovery Time Objective): <4 ore
- [ ] RPO (Recovery Point Objective): <1 ora
- [ ] Incident response plan scritto
- [ ] Runbook per issue comuni (DB down, Vercel down, WhatsApp API down)
- [ ] Contact list emergenza (tu, co-founder, DPO, legal)
- [ ] Status page pubblica

---

## 16. CODE SECURITY

- [ ] PR review obbligatoria per ogni merge su main (quando team)
- [ ] CI deve passare prima di merge
- [ ] Branch protection su main
- [ ] No direct push su main
- [ ] Commit signing con GPG (opzionale ma consigliato)
- [ ] Nessun secret committato (secret scanning)
- [ ] Code review include security review (checklist per reviewer)

---

## 17. TERZE PARTI & SUPPLY CHAIN

- [ ] Vendor list mantenuta con tier risk (high/medium/low)
- [ ] Ogni vendor ha DPA firmata se processa dati personali
- [ ] Review annuale dei vendor (ancora affidabili? sicuri? compliant?)
- [ ] Subprocessor list pubblica (per compliance B2B)
- [ ] Monitoring annuncio incidenti vendor (subscribe a security bulletins)

---

## 18. EDUCATION & HUMAN FACTOR

- [ ] Password manager per tutto il team (1Password)
- [ ] Tu e co-founder hanno 2FA su TUTTI gli account critici
- [ ] Training phishing per eventuali dipendenti
- [ ] No sharing credenziali via email/chat
- [ ] Onboarding sicurezza per nuovi team member
- [ ] Offboarding security check (revoke access)

---

## 19. LEGAL & CONTRACTUAL

- [ ] SLA pubblicato (es. 99.9% uptime)
- [ ] Terms of service firmati da ogni cliente (checkbox signup)
- [ ] DPA offerta a clienti B2B che la richiedono
- [ ] Limitation of liability corretta
- [ ] Cyber insurance valutata (quando MRR >€10k consigliata)

---

## 20. SECURITY INCIDENT RESPONSE

### Playbook
In caso di incident:

1. **Identificazione**: alert → on-call investiga in <15 min
2. **Contenimento**: isola servizio compromesso, blocca accessi sospetti
3. **Eradicazione**: rimuovi accesso attacker, patch vulnerabilità
4. **Recovery**: ripristina servizio, verifica integrità dati
5. **Lessons learned**: postmortem entro 1 settimana

### Notifiche
- Incident minore (no data breach): notifica interna team
- Incident maggiore (down service): status page + email clienti impattati
- Data breach: entro 72h al DPA, a clienti impattati, documentazione completa

---

## 🚨 VOCI CRITICHE (non negoziabili al go-live)

Se QUALSIASI di queste non è spuntata, NON vai live:

- [ ] RLS attiva su tutte le tabelle
- [ ] HTTPS only con HSTS
- [ ] 2FA per admin obbligatoria
- [ ] Webhook signatures verificate (WhatsApp + Stripe)
- [ ] Rate limiting edge-level attivo
- [ ] Nessun secret in `NEXT_PUBLIC_*`
- [ ] Password hashing bcrypt ≥12 rounds
- [ ] Zod validation su tutti gli endpoint
- [ ] Privacy policy + ToS pubblicati
- [ ] CORS stretto
- [ ] Backup funzionante (testato)
- [ ] Sentry monitoring attivo
- [ ] Scan segreti committati clean

---

## Audit esterno (raccomandato)

Quando raggiungi €10k MRR o primi clienti enterprise:
- Penetration test professionale (€3-5k)
- SOC 2 Type 1 (€10-15k) — utile per vendere enterprise
- ISO 27001 valutazione (longer journey)

Non prima. Focus sul prodotto fino a quel punto.

---

## Review cadence

- **Weekly**: check Sentry errors, Dependabot alerts, failed logins anomali
- **Monthly**: rotate non-critical secrets, review access list team
- **Quarterly**: full re-audit di questa checklist, test DR restore
- **Yearly**: penetration test, review vendor contracts, update incident playbook
