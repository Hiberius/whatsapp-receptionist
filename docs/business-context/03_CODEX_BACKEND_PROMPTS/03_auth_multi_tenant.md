# PROMPT 03 - AUTH MULTI-TENANT

## PROMPT OPERATIVO CODEX

Ora implementa il sistema di autenticazione multi-tenant con Supabase Auth + JWT claims custom.

STEP 1 - Pagine auth

Crea in src/app/(auth)/:
- login/page.tsx (email + password + Google OAuth + passkey)
- register/page.tsx (email + password + campo "nome studio" + accept terms)
- forgot-password/page.tsx
- reset-password/page.tsx
- verify-email/page.tsx
- Layout (auth)/layout.tsx con design minimale centered

STEP 2 - Auth handlers

Crea src/lib/auth/:
- sign-up.ts: crea user in auth + crea tenant + associa user a tenant con role='owner'
- sign-in.ts: login con email/password o OAuth
- sign-out.ts: logout + clear session
- reset-password.ts
- invite-user.ts: owner/admin invita nuovi membri al proprio tenant

STEP 3 - Middleware Next.js

Crea src/middleware.ts:
- Verifica session Supabase su ogni richiesta protected
- Refresh access token automaticamente
- Redirect a /login se non autenticato
- Redirect a /onboarding se tenant non ha completato setup
- Passa tenant_id nel header per le API routes

STEP 4 - Multi-factor authentication (MFA)

Per tutti gli utenti con role='owner' o 'admin':
- Obbligo TOTP (Google Authenticator, 1Password)
- Flow: /settings/security mostra QR code, utente scansiona, conferma con 6 digit code
- Recovery codes generati (10 codici one-time usage)
- MFA obbligatorio anche su admin super-root

STEP 5 - Invite flow

Owner invita membro:
- Inserisce email
- Sistema manda email magic link con token (24h expiration)
- Cliccando il link: utente crea password, accetta terms
- Aggiunto al tenant con role='member'
- Notifica owner che l'invite e' stato accettato

STEP 6 - Session management

- Session duration: 7 giorni rolling
- Re-auth richiesta per azioni critiche:
  - Cambio email
  - Cambio password
  - Cancellazione account
  - Cambio piano pagamento
  - Export dati GDPR
- Device tracking: mostra sessioni attive in /settings/security, possibilita' di logout remoto

STEP 7 - Login audit

Ogni login registrato in audit_log:
- user_id, tenant_id
- ip_address, user_agent
- success o failure
- timestamp

Alert via email se:
- Login da IP nuovo in paese diverso
- 5 tentativi falliti in 10 minuti
- Login da user agent anomalo (bot detection Cloudflare)

STEP 8 - RBAC (Role-Based Access Control)

Tre ruoli:
- owner: full access, billing, delete tenant
- admin: tutto tranne billing e delete tenant
- member: solo view conversazioni + rispondere manualmente

Implementa hook useRole() e componente RequireRole che nasconde UI per role insufficiente.

STEP 9 - Test auth end-to-end

Crea Playwright test in tests/auth.spec.ts:
- Registrazione nuovo tenant
- Login
- Logout
- Password reset flow
- MFA setup
- Invite nuovo utente + accept
- Access denied se role insufficiente

Esegui e mostra risultati.

REQUISITI SICUREZZA:
- Password minimo 12 caratteri, 1 maiuscola, 1 numero, 1 special char
- Rate limiting login: max 5 tentativi per 15 min per IP
- CAPTCHA (hCaptcha) dopo 3 tentativi falliti
- Email verification obbligatoria prima di usare il servizio
- Token CSRF su form
- Session cookie: httpOnly, secure, sameSite=strict
