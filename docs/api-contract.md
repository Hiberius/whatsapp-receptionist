# Ambrogio AI — API Contract (v1)

> **Scopo:** specifica di riferimento per tutte le HTTP API esposte dall'app
> Next.js. Generata leggendo `src/app/api/**/route.ts` (Next.js 15 App Router,
> Route Handlers).
>
> **Versione:** v1 (versione semantica concettuale, non c'e' prefisso `/v1` nel
> path).
>
> **Base URL:** `${NEXT_PUBLIC_APP_URL}` (default `http://localhost:3000`).
> In produzione: `https://app.ambrogio.ai` (o domain custom configurato).
>
> **Endpoint totali documentati:** 27 route file → 35 metodi HTTP esposti
> (alcuni file espongono piu' verb).
>
> **Stack tecnico:** Next.js 15 App Router, Zod (validation), Supabase
> (auth + DB), Stripe (billing), 360dialog (WhatsApp), Upstash Redis
> (rate-limit con fallback memoria).

---

## Indice

1. [Conventions](#conventions)
2. [Authentication](#authentication)
3. [Rate limiting](#rate-limiting)
4. [Auth & Onboarding](#area-onboarding)
5. [Settings](#area-settings)
6. [Tenant account & GDPR](#area-tenant-account--gdpr)
7. [Customers GDPR](#area-customers-gdpr)
8. [Conversations](#area-conversations)
9. [Knowledge base](#area-knowledge-base)
10. [Calendar (Google integration)](#area-calendar-google-integration)
11. [Billing (Stripe)](#area-billing-stripe)
12. [Usage](#area-usage)
13. [WhatsApp opt-outs](#area-whatsapp-opt-outs)
14. [Internal jobs](#area-internal-jobs)
15. [Internal booking API](#area-internal-booking-api)
16. [Webhooks](#area-webhooks)
17. [Health](#area-health)
18. [Errors](#errors)
19. [Webhook signature verification](#webhook-signature-verification)
20. [Footer](#footer)

---

## Conventions

### Content type

- Request: `application/json; charset=utf-8` (eccetto webhook Stripe che invia
  `application/json` con raw body letto via `request.text()`).
- Response: `application/json; charset=utf-8`. Eccezione: `GET
  /api/tenant/export` ritorna `application/json` con
  `content-disposition: attachment` (file download).

### Response envelope (success)

Tutte le route che usano `jsonHandler` rispondono con il seguente envelope:

```json
{
  "ok": true,
  "data": { ... }
}
```

Header sempre presenti:

- `x-request-id`: UUID v4, riusato dall'header request se valido (max 128
  char), altrimenti generato server-side. Da usare in tutte le richieste di
  supporto.

### Response envelope (errore)

```json
{
  "ok": false,
  "error": {
    "code": "bad_request",
    "message": "Invalid request payload"
  }
}
```

- `code` segue [`AppErrorCode`](#errors) (lista chiusa).
- `message` viene mostrato solo se `expose: true` (di default vero per status
  `< 500`; `false` per `internal`). Per errori non esposti il messaggio e'
  sempre `"Internal server error"`.
- Status code HTTP coerente col `code` (vedi tabella errori).

### Request ID propagation

Il client puo' inviare `x-request-id: <uuid>` per tracciare end-to-end. Il
server lo accetta se `length <= 128`, altrimenti ne genera uno nuovo
(`randomUUID()`).

### Client IP detection

Per logging e rate-limit l'IP viene estratto da (in ordine):

1. `x-forwarded-for` (primo segmento prima della virgola)
2. `cf-connecting-ip` (Cloudflare)
3. `x-real-ip`
4. `"unknown"` (fallback)

### HTTP methods

I route file Next.js esportano funzioni `GET`, `POST`, `PATCH`, `PUT`,
`DELETE` come handlers. I verb non implementati ritornano `405 Method Not
Allowed` (gestito dal framework).

---

## Authentication

Esistono **quattro modalita'** di autenticazione, mutuamente esclusive su un
endpoint:

### 1. None (public)

Nessun controllo. Solo health check e webhook verification handshake.

| Endpoint | Note |
|----------|------|
| `GET /api/health` | edge runtime, sempre pubblico |
| `GET /api/health/deep` | node runtime, sempre pubblico |
| `GET /api/webhook/whatsapp` | handshake Meta, valida `hub.verify_token` |

### 2. Supabase session (cookie JWT)

La maggioranza degli endpoint user-facing usa `requireSession()` o
`requireAuthenticatedUser()`:

- **`requireAuthenticatedUser()`** — verifica il JWT Supabase, ritorna
  `{ userId, email, appMetadata, userMetadata }`. Usato in `onboarding/tenant`
  e dentro `requireSession()`.
- **`requireSession()`** — come sopra ma **richiede** anche
  `app_metadata.tenant_id` (string) e `app_metadata.role` (`'owner' | 'admin'
  | 'member'`). Failure ⇒ `401 unauthorized` (no JWT) o `403 forbidden`
  (claim mancante).

Il JWT viene letto dal cookie Supabase `sb-<project>-auth-token` impostato dal
client SDK. Lato server: `createSupabaseServerClient()` (non documentato qui).

### 3. Super-admin

Endpoint cross-tenant per dashboard interna. Verifica:

```
app_metadata.is_super_admin === true
```

via `requireSuperAdmin()`. Failure: `403 forbidden`. Nelle route REST attuali
(v1) **nessun endpoint `/api/*` usa requireSuperAdmin**: il guard e'
attualmente impiegato solo in pagine admin (server components). Documentato
qui per completezza.

### 4. Internal job secret

Tutti gli endpoint sotto `/api/internal/*` validano un header HMAC-statico
con `assertStaticSecretHeader()` (timing-safe compare):

- **Header name:** `x-ambrogio-job-secret` (override via
  `INTERNAL_JOB_HEADER_NAME` env).
- **Secret:** `INTERNAL_JOB_SECRET` env. Se vuoto in produzione ⇒ `500
  internal` (`"Internal job secret is not configured"`).
- Failure header mancante o mismatch ⇒ `403 forbidden` (`"Invalid internal
  job secret"`).

Esempio header:

```bash
curl -X POST https://app.example.com/api/internal/jobs/whatsapp-outbox \
  -H "x-ambrogio-job-secret: $INTERNAL_JOB_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":20}'
```

### 5. Webhook signature

Vedi [Webhook signature verification](#webhook-signature-verification).

---

## Rate limiting

Definito in `src/lib/rate-limit/policies.ts`. Implementazione: Upstash
Redis sliding-window con fallback in-memory (per test / dev locale senza
Upstash). Su denial: `AppError('rate_limited')` ⇒ HTTP `429`.

| Policy key | Window | Limit | Identifier kind | Endpoint applicato |
|---|---|---|---|---|
| `authLogin` | 15 min | 5 | email/ip | (route auth custom — non in `/api`) |
| `authPasswordReset` | 1 ora | 3 | email | (route auth custom) |
| `authMagicLink` | 1 ora | 3 | email | (route auth custom) |
| `onboarding` | 1 ora | 10 | userId | `POST /api/onboarding/tenant` |
| `settingsWrite` | 1 min | 30 | tenantId | `PATCH /api/settings/tenant`, `PUT /api/settings/business-hours`, `POST/PATCH/DELETE /api/settings/services[/:id]` |
| `gdprExport` | 24 ore | 1 | tenantId | `GET /api/tenant/export` |
| `gdprDelete` | 24 ore | 1 | tenantId | (riservato — non ancora applicato a `tenant/account`) |

Limiti webhook configurabili da env (default in `src/lib/env.ts`):

- `WHATSAPP_WEBHOOK_RATE_LIMIT_MAX` / `WHATSAPP_WEBHOOK_RATE_LIMIT_WINDOW_MS` —
  applicato per `ip` su `POST /api/webhook/whatsapp`.
- `STRIPE_BILLING_RATE_LIMIT_MAX` / `STRIPE_BILLING_RATE_LIMIT_WINDOW_MS` —
  applicato per `ip` su `POST /api/webhook/stripe`.

Risposta su 429:

```json
{
  "ok": false,
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded. Retry after 42s"
  }
}
```

> NOTA: l'header `Retry-After` non viene attualmente impostato dal
> `jsonHandler`; il client deve parsare `message` per estrarre i secondi
> oppure assumere un backoff esponenziale.

---

## Area: Onboarding

### `GET /api/onboarding/tenant`

Stato onboarding dell'utente autenticato (decide se mostrare il wizard).

- **Auth:** `requireAuthenticatedUser` (basta JWT Supabase, non richiede
  tenant claim — necessario perche' l'utente *non ha ancora* un tenant prima
  di completare onboarding).
- **Rate limit:** none.
- **Request:** nessun body, nessuna query.
- **Response 200:**

```json
{
  "ok": true,
  "data": {
    "completed": false,
    "tenantId": null,
    "role": null
  }
}
```

(Shape esatta: vedi `createTenantOnboardingService().getStatus()` —
[TODO future] documentare).

```bash
curl -X GET https://app.example.com/api/onboarding/tenant \
  -H "Cookie: sb-...-auth-token=..."
```

### `POST /api/onboarding/tenant`

Crea il tenant e lo associa all'utente. Idempotente per primo successo.

- **Auth:** `requireAuthenticatedUser`.
- **Rate limit:** `onboarding` (10/ora per `userId`).
- **Request body** (Zod, `.strict()` ⇒ no campi extra):

```ts
{
  tenantName: string (2-120),
  billingEmail?: string|null (email),
  timezone?: string (1-80),
  businessType?: string|null (max 80),
  studioName?: string|null (max 120),
  assistantName?: string (2-80),
  city?: string|null (max 80),
  address?: string|null (max 240),
  phone?: string|null (max 40),
  email?: string|null (email),
  fullName?: string|null (max 120),
  services?: Array<{
    name: string (1-120),
    description?: string|null (max 500),
    durationMinutes?: int (5-480),
    priceCents?: int|null (0-1_000_000),
    active?: boolean
  }> (max 20),
  businessHours?: Array<{
    weekday: int (0-6),
    opensAt: HH:MM,
    closesAt: HH:MM,
    active?: boolean
  }> (max 28)
}
```

- **Errori principali:** `bad_request` (validation), `rate_limited`,
  `conflict` (tenant gia' esistente), `internal`.

```bash
curl -X POST https://app.example.com/api/onboarding/tenant \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-...-auth-token=..." \
  -d '{
    "tenantName": "Studio Bellezza",
    "timezone": "Europe/Rome",
    "businessType": "salon",
    "assistantName": "Ambrogio"
  }'
```

---

## Area: Settings

### `GET /api/settings/tenant`

Snapshot completo settings tenant.

- **Auth:** `requireSession`.
- **Response:** `data` = oggetto settings (vedi
  `TenantSettingsService.getSnapshot()` — [TODO future] documentare shape
  precisa).

### `PATCH /api/settings/tenant`

Update parziale settings tenant.

- **Auth:** `requireSession`.
- **Rate limit:** `settingsWrite` (30/min per tenant).
- **Request body** (`.strict()`):

```ts
{
  name?: string (2-120),
  timezone?: string (1-80),
  businessType?: string|null (max 80),
  studioName?: string (2-120),
  assistantName?: string (2-80),
  city?: string|null (max 80),
  address?: string|null (max 240),
  phone?: string|null (max 40),
  email?: string|null (email),
  defaultLocale?: string (regex /^[a-z]{2}(?:-[A-Z]{2})?$/, es "it" o "it-IT"),
  aiDisclosureEnabled?: boolean,
  autoReplyEnabled?: boolean,
  voiceMessagesEnabled?: boolean,
  voiceRepliesEnabled?: boolean,
  bookingMinLeadMinutes?: int (0-10080),
  bookingSlotStepMinutes?: int (5-240),
  bookingBufferMinutes?: int (0-240),
  bookingMaxDaysAhead?: int (1-365),
  elevenlabsVoiceId?: string|null (max 160),
  elevenlabsSttModel?: string (2-80),
  elevenlabsTtsModel?: string (2-80),
  humanEscalationEmail?: string|null (email)
}
```

```bash
curl -X PATCH https://app.example.com/api/settings/tenant \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-...-auth-token=..." \
  -d '{"autoReplyEnabled": true, "bookingMinLeadMinutes": 60}'
```

### `GET /api/settings/business-hours`

Lista orari di apertura del tenant.

- **Auth:** `requireSession`.
- **Response:** array `{ weekday, opensAt, closesAt, active }`.

### `PUT /api/settings/business-hours`

Sostituisce *interamente* la lista orari (replace, non merge).

- **Auth:** `requireSession`.
- **Rate limit:** `settingsWrite`.
- **Request body** (`.strict()`):

```ts
{
  hours: Array<{
    weekday: int (0-6),  // 0 = Domenica
    opensAt: "HH:MM",
    closesAt: "HH:MM",
    active?: boolean
  }> (max 28)  // 7 giorni × 4 turni max
}
```

```bash
curl -X PUT https://app.example.com/api/settings/business-hours \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-...-auth-token=..." \
  -d '{
    "hours": [
      {"weekday": 1, "opensAt": "09:00", "closesAt": "18:00"},
      {"weekday": 2, "opensAt": "09:00", "closesAt": "18:00"}
    ]
  }'
```

### `GET /api/settings/services`

Lista servizi del tenant.

- **Auth:** `requireSession`.

### `POST /api/settings/services`

Crea un nuovo servizio.

- **Auth:** `requireSession`.
- **Rate limit:** `settingsWrite`.
- **Request body** (`.strict()`):

```ts
{
  name: string (1-120),
  description?: string|null (max 500),
  durationMinutes: int (5-480),  // required
  priceCents?: int|null (0-1_000_000),
  active?: boolean
}
```

### `PATCH /api/settings/services/:serviceId`

Update parziale servizio.

- **Auth:** `requireSession`.
- **Rate limit:** `settingsWrite`.
- **Path params:** `serviceId` (uuid lato service, non validato in route).
- **Request body** (`.strict()`): tutti i campi del POST diventano optional.

### `DELETE /api/settings/services/:serviceId`

Soft-delete (archive) del servizio.

- **Auth:** `requireSession`.
- **Rate limit:** `settingsWrite`.

```bash
curl -X DELETE https://app.example.com/api/settings/services/abc-123 \
  -H "Cookie: sb-...-auth-token=..."
```

---

## Area: Tenant account & GDPR

### `DELETE /api/tenant/account`

GDPR Art. 17 — soft delete tenant + 30gg grace period. Richiede frase di
conferma esatta.

- **Auth:** `requireSession` (intent: solo `owner`, controllo applicato lato
  service).
- **Rate limit:** *nessuno applicato in route* (la policy `gdprDelete` esiste
  ma non e' wired qui — TODO).
- **Runtime:** `nodejs`.
- **Request body:**

```json
{ "confirmationPhrase": "ELIMINA DEFINITIVAMENTE" }
```

`z.literal('ELIMINA DEFINITIVAMENTE')` — qualunque altro valore ⇒ 400.

- **Response:** programma `deleted_at = now() + 30d`, status =
  `'cancelled'`. Job cron giornaliero `gdpr-hard-delete` esegue la
  cancellazione vera.

```bash
curl -X DELETE https://app.example.com/api/tenant/account \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-...-auth-token=..." \
  -d '{"confirmationPhrase":"ELIMINA DEFINITIVAMENTE"}'
```

### `POST /api/tenant/account`

Annulla la cancellazione programmata (entro 30gg grace).

- **Auth:** `requireSession`.
- **Request body:**

```json
{ "action": "cancel-deletion" }
```

- **Response:** `{ "cancelled": true }`.

### `GET /api/tenant/export`

GDPR Art. 15 — export completo dati tenant (21 tabelle) come JSON download.

- **Auth:** `requireSession` con `role IN ('owner', 'admin')`. Se ruolo
  diverso ritorna `404 not_found` (anti-enumeration).
- **Rate limit:** `gdprExport` (1/24h per tenant).
- **Runtime:** `nodejs`.
- **Response:** `200 application/json` con header
  `content-disposition: attachment; filename="ambrogio-tenant-export-<tenantId>-<ts>.json"`.

```bash
curl -X GET https://app.example.com/api/tenant/export \
  -H "Cookie: sb-...-auth-token=..." \
  -o tenant-export.json
```

---

## Area: Customers GDPR

### `POST /api/customers/:phone/export`

GDPR Art. 15 — export dati di un singolo cliente (lookup per telefono).

- **Auth:** `requireSession`.
- **Path param:** `phone` — URL-encoded, validato con regex
  `/^\+?\d[\d\s().-]+$/`, lunghezza 8-64.
- **Runtime:** `nodejs`.
- **Request body:** vuoto (POST per side-effect: audit log).
- **Response:** snapshot dati customer (vedi
  `GdprExportService.exportCustomerData()`).

```bash
curl -X POST "https://app.example.com/api/customers/%2B393331234567/export" \
  -H "Cookie: sb-...-auth-token=..."
```

### `DELETE /api/customers/:phone`

GDPR Art. 17 — hard delete immediato dei dati di un singolo cliente (no grace).

- **Auth:** `requireSession`.
- **Path param:** `phone` (stesse regole).
- **Runtime:** `nodejs`.
- **Request body:**

```json
{ "confirmationPhrase": "CANCELLA" }
```

```bash
curl -X DELETE "https://app.example.com/api/customers/%2B393331234567" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-...-auth-token=..." \
  -d '{"confirmationPhrase":"CANCELLA"}'
```

---

## Area: Conversations

### `GET /api/conversations`

Lista conversazioni inbox con filtri.

- **Auth:** `requireSession`.
- **Query params** (Zod):

```ts
{
  status?: 'active' | 'escalated' | 'closed' | 'spam',
  channel?: 'whatsapp' | 'instagram_dm' | 'web_chat' | 'sms',
  limit?: int (1-100, default 30),
  before?: ISO date  // cursore paginazione
}
```

```bash
curl "https://app.example.com/api/conversations?status=active&limit=20" \
  -H "Cookie: sb-...-auth-token=..."
```

### `GET /api/conversations/:conversationId`

Dettaglio conversazione + ultimi N messaggi.

- **Auth:** `requireSession`.
- **Path param:** `conversationId` (uuid).
- **Query params:**

```ts
{ messageLimit?: int (1-200, default 100) }
```

### `PATCH /api/conversations/:conversationId`

Update parziale: stato, AI on/off, nome cliente.

- **Auth:** `requireSession`.
- **Request body** (`.strict()`):

```ts
{
  status?: 'active' | 'escalated' | 'closed' | 'spam',
  aiEnabled?: boolean,
  customerName?: string|null (max 120, trimmed)
}
```

```bash
curl -X PATCH https://app.example.com/api/conversations/abc-123 \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-...-auth-token=..." \
  -d '{"status":"closed","aiEnabled":false}'
```

### `POST /api/conversations/:conversationId/messages`

Invio manuale operatore (WhatsApp free-form, dentro finestra 24h, rispetta
opt-out lato service).

- **Auth:** `requireSession`.
- **Request body** (`.strict()`):

```ts
{ content: string (1-4096) }
```

```bash
curl -X POST https://app.example.com/api/conversations/abc/messages \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-...-auth-token=..." \
  -d '{"content":"Buongiorno, le confermo l'\''appuntamento."}'
```

---

## Area: Knowledge base

### `GET /api/knowledge-base`

Lista documenti KB.

- **Auth:** `requireSession`.
- **Query params:**

```ts
{
  active?: 'true' | 'false',
  category?: string|null (max 80),
  limit?: int (1-100, default 50)
}
```

### `POST /api/knowledge-base`

Crea documento KB. `generateEmbedding=true` ⇒ vettoriale OpenAI/locale
(comportamento gestito lato service).

- **Auth:** `requireSession`.
- **Request body** (`.strict()`):

```ts
{
  title: string (1-160),
  content: string (1-30_000),
  category?: string|null (max 80),
  active?: boolean,
  generateEmbedding?: boolean
}
```

### `GET /api/knowledge-base/:documentId`

Dettaglio documento.

- **Auth:** `requireSession`.

### `PATCH /api/knowledge-base/:documentId`

Update parziale.

- **Auth:** `requireSession`.
- **Request body** (`.strict()`): tutti i campi del POST optional.

### `DELETE /api/knowledge-base/:documentId`

Archivia documento.

- **Auth:** `requireSession`.

---

## Area: Calendar (Google integration)

OAuth 2.0 flow per collegare un Google Calendar al tenant. Le route
`connect` e `callback` ritornano `redirect()` (303), non JSON.

### `GET /api/integrations/google-calendar/status`

- **Auth:** `requireSession`.
- **Query params:**

```ts
{ returnTo?: string }
```

- **Response:** `{ connected: boolean, calendarId?: string, email?: string }`
  (shape esatta da service).

### `GET /api/integrations/google-calendar/connect`

Avvia flow OAuth (redirect a Google authorize).

- **Auth:** `requireSession`.
- **Query params:** `returnTo` (URL relativa di ritorno post-auth).
- **Response:** `307 Location: https://accounts.google.com/o/oauth2/...`.
- **Errori:** redirect a `/settings?google_calendar=error&code=<...>`.

### `GET /api/integrations/google-calendar/callback`

Callback OAuth — ricevuto da Google.

- **Auth:** `requireSession` (sessione utente che ha avviato il flow).
- **Query params:** `code`, `state`, `error`.
- **Response:** redirect a `returnTo` decodificato dallo state, o pagina
  errore.

### `POST /api/integrations/google-calendar/disconnect`

Revoca token Google e disassocia.

- **Auth:** `requireSession`.
- **Request body:** vuoto.

```bash
curl -X POST https://app.example.com/api/integrations/google-calendar/disconnect \
  -H "Cookie: sb-...-auth-token=..."
```

---

## Area: Billing (Stripe)

### `GET /api/billing/status`

Snapshot stato sottoscrizione corrente.

- **Auth:** `requireSession`.
- **Response:** subscription state (vedi
  `StripeBillingService.getStatus()`).

### `POST /api/billing/checkout`

Crea Stripe Checkout Session per nuova sottoscrizione.

- **Auth:** `requireSession`.
- **Request body** (`.strict()`):

```ts
{ plan: 'starter' | 'professional' }
```

- **Response:** `{ url: string, sessionId: string }`.

```bash
curl -X POST https://app.example.com/api/billing/checkout \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-...-auth-token=..." \
  -d '{"plan":"professional"}'
```

### `POST /api/billing/portal`

Crea Stripe Customer Portal Session.

- **Auth:** `requireSession`.
- **Request body:** vuoto.
- **Response:** `{ url: string }`.

---

## Area: Usage

### `GET /api/usage/status`

Snapshot uso corrente vs limiti del piano (per dashboard).

- **Auth:** `requireSession`.
- **Response:** vedi `UsageLimitsService.getDashboardSnapshot()` —
  [TODO future] documentare shape.

```bash
curl https://app.example.com/api/usage/status \
  -H "Cookie: sb-...-auth-token=..."
```

---

## Area: WhatsApp opt-outs

### `GET /api/whatsapp/opt-outs`

Stato opt-out di un singolo customer.

- **Auth:** `requireSession`.
- **Query params:**

```ts
{ customerIdentifier: string (5-64) }
```

### `DELETE /api/whatsapp/opt-outs`

Revoca opt-out (re-opt-in lato operatore).

- **Auth:** `requireSession`.
- **Query params:** stesso schema.

```bash
curl -X DELETE "https://app.example.com/api/whatsapp/opt-outs?customerIdentifier=393331234567" \
  -H "Cookie: sb-...-auth-token=..."
```

---

## Area: Internal jobs

Tutti questi endpoint richiedono header `x-ambrogio-job-secret:
$INTERNAL_JOB_SECRET`. Pensati per essere chiamati da cron worker (Vercel
Cron, GitHub Actions, Cloudflare Worker), MAI dal browser. Runtime: `nodejs`.

### `POST /api/internal/jobs/appointment-reminders`

Invia promemoria appuntamenti in scadenza.

- **Auth:** internal-job-secret.
- **Request body:**

```ts
{
  tenantId?: uuid,  // opzionale: filtra per tenant
  limit?: int (1-100)
}
```

```bash
curl -X POST https://app.example.com/api/internal/jobs/appointment-reminders \
  -H "x-ambrogio-job-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":50}'
```

### `POST /api/internal/jobs/gdpr-hard-delete`

Esegue hard delete dei tenant scaduti dalla grace period (30gg).

- **Auth:** internal-job-secret.
- **Request body:**

```ts
{
  limit?: int (1-100, default 50),
  dryRun?: boolean (default false)
}
```

- **Response:**

```json
{
  "ok": true,
  "data": {
    "processedAt": "2026-05-08T12:00:00.000Z",
    "candidates": 3,
    "processed": 3,
    "results": [
      {
        "tenantId": "...",
        "scheduledHardDeleteAt": "2026-05-07T...",
        "status": "executed"
      }
    ],
    "dryRun": false
  }
}
```

`status` ∈ `executed | skipped_dry_run | failed`.

### `POST /api/internal/jobs/whatsapp-outbox`

Worker outbox: spedisce messaggi WhatsApp in coda.

- **Auth:** internal-job-secret.
- **Request body:**

```ts
{ limit?: int (1-50) }
```

### `POST /api/internal/jobs/whatsapp-template-sync`

Sincronizza i template WhatsApp 360dialog per un tenant.

- **Auth:** internal-job-secret.
- **Request body:**

```ts
{ tenantId: uuid }  // required
```

### `POST /api/internal/jobs/whatsapp-voice`

Worker pipeline vocale (STT/TTS) per messaggi audio WhatsApp.

- **Auth:** internal-job-secret.
- **Request body:**

```ts
{ limit?: int (1-50) }
```

---

## Area: Internal booking API

API booking interna usata dagli agenti AI (WhatsApp NLU) per creare,
spostare, cancellare appuntamenti. Tutti gli endpoint richiedono
`INTERNAL_JOB_SECRET`. Runtime: `nodejs`.

### `POST /api/internal/booking/availability`

Slot disponibili in un range temporale.

- **Auth:** internal-job-secret.
- **Request body:**

```ts
{
  tenantId: uuid,
  serviceId: uuid,
  from: ISO date,
  to: ISO date,
  durationMinutes?: int (>0),
  maxSlots?: int (1-50),
  slotStepMinutes?: int (5-240)
}
```

### `POST /api/internal/booking/appointments`

Crea appuntamento.

- **Auth:** internal-job-secret.
- **Request body:**

```ts
{
  tenantId: uuid,
  serviceId: uuid,
  conversationId?: uuid|null,
  customerIdentifier: string (1+),
  customerName: string (1+),
  customerPhone?: string|null,
  customerEmail?: string|null (email),
  scheduledAt: ISO date,
  durationMinutes?: int (>0),
  notes?: string|null (max 4000),
  bookingSource?: 'manual' | 'whatsapp_ai' | 'dashboard' | 'api' (default 'api'),
  requireCalendarSync?: boolean,
  sendConfirmation?: boolean
}
```

### `PATCH /api/internal/booking/appointments`

Riprogramma appuntamento.

- **Auth:** internal-job-secret.
- **Request body:**

```ts
{
  tenantId: uuid,
  appointmentId: uuid,
  scheduledAt: ISO date,
  durationMinutes?: int (>0),
  notes?: string|null (max 4000),
  customerEmail?: string|null (email),
  requireCalendarSync?: boolean,
  sendConfirmation?: boolean
}
```

### `DELETE /api/internal/booking/appointments`

Cancella appuntamento. **NB:** body in DELETE — non standard ma funziona con
Next.js.

- **Auth:** internal-job-secret.
- **Request body:**

```ts
{
  tenantId: uuid,
  appointmentId: uuid,
  requireCalendarSync?: boolean,
  sendCancellation?: boolean
}
```

```bash
curl -X DELETE https://app.example.com/api/internal/booking/appointments \
  -H "x-ambrogio-job-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"...","appointmentId":"...","sendCancellation":true}'
```

---

## Area: Webhooks

### `GET /api/webhook/whatsapp`

Handshake Meta/360dialog per verificare il webhook URL al setup.

- **Auth:** none. Verifica `hub.verify_token === WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- **Query params:** `hub.mode`, `hub.verify_token`, `hub.challenge`.
- **Response 200:** body = `challenge` (text plain).
- **Response 403:** `{ ok: false, error: { code: 'webhook_rejected' } }`.

### `POST /api/webhook/whatsapp`

Riceve messaggi/status callback da WhatsApp Business Platform.

- **Auth:** static secret header
  - **Header:** `x-ambrogio-webhook-secret` (override via
    `WHATSAPP_WEBHOOK_HEADER_NAME`).
  - **Secret:** `WHATSAPP_WEBHOOK_HEADER_SECRET`.
  - Compare timing-safe (`crypto.timingSafeEqual`).
- **Rate limit:** per `ip` (config env, vedi sopra).
- **Request body:** validato con `WhatsAppWebhookPayloadSchema` (Zod). Vedi
  `src/types/whatsapp.ts` per shape (typing 360dialog/Meta).
- **Response 200:** `{ ok: true, data: { processed: boolean, ...stats } }`.
- **Errori:** `webhook_rejected` (401) se secret mismatch, `bad_request`
  (400) se payload non valido.

### `POST /api/webhook/stripe`

Riceve eventi Stripe (subscription, invoice, payment).

- **Auth:** Stripe signature (`stripe-signature` header) verificata con
  `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`.
- **Rate limit:** per `ip`.
- **Request body:** raw JSON Stripe event. `request.text()` deve essere
  letto **prima** del parsing (richiesto per signature verification).
- **Response 200:** `{ ok: true, data: { processed: boolean, reason?: string } }`.
- **Errori:** `webhook_rejected` (401) per signature invalida, `internal`
  (500) se `STRIPE_WEBHOOK_SECRET` non configurato.

```bash
# Esempio test locale con stripe CLI:
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

---

## Area: Health

### `GET /api/health`

Liveness probe edge-runtime. Sempre disponibile, latenza minima.

- **Auth:** none.
- **Runtime:** `edge`. Cache-Control: `no-store`.
- **Response 200 / 503:**

```json
{
  "ok": true,
  "service": "ambrogio-ai",
  "version": "0.1.0",
  "region": "fra1",
  "timestamp": "2026-05-08T12:00:00.000Z",
  "checks": [
    { "name": "app", "status": "ok", "details": "Edge runtime active" },
    { "name": "env", "status": "ok" }
  ]
}
```

### `GET /api/health/deep`

Readiness probe con check verso Supabase, Upstash, Stripe.

- **Auth:** none.
- **Runtime:** `nodejs`. Timeout per check: 2-3s.
- **Response 200 / 503:** stessa shape, con `checks[]` che include
  `latencyMs` e `details` su failure. Status per check ∈ `ok | degraded |
  down`.

---

## Errors

Tutti gli errori esposti seguono [`AppErrorCode`](../src/lib/errors/app-error.ts):

| Code | HTTP | Quando | `expose` default |
|---|---|---|---|
| `bad_request` | 400 | Body/query non valido (Zod fail), JSON invalido | true |
| `conflict` | 409 | Risorsa duplicata o stato incompatibile | true |
| `unauthorized` | 401 | JWT mancante/invalido | true |
| `forbidden` | 403 | JWT valido ma claim/role insufficienti, internal-secret mismatch | true |
| `not_found` | 404 | Risorsa non trovata, anti-enumeration | true |
| `rate_limited` | 429 | Quota policy superata | true |
| `upstream_error` | 502 | Errore provider esterno (Stripe, 360dialog, Google) | true |
| `webhook_rejected` | 401 | Signature/secret webhook mismatch | true |
| `internal` | 500 | Errore non previsto, secret non configurato | **false** |

Errori non `AppError` vengono wrappati in `internal` con `expose: false` ⇒
client riceve `"Internal server error"`.

Errori Zod ⇒ `bad_request` con `message: "Invalid request payload"`. Detail
non esposti per sicurezza (potrebbero leakare shape).

---

## Webhook signature verification

### Stripe

```ts
import Stripe from 'stripe';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  // 1. Read RAW body (mai await request.json() prima della signature check)
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing signature', { status: 401 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return new Response('Invalid signature', { status: 401 });
  }

  // 2. Idempotency: store event.id in webhook_events table
  // 3. Process event
}
```

Implementazione attuale: `src/lib/stripe/webhook-security.ts` →
`constructStripeEvent(rawBody, signature)`.

### WhatsApp (360dialog)

Il provider **360dialog** non firma il body con HMAC SHA-256 nativo Meta,
ma supporta un header statico custom (configurato lato dashboard 360dialog).

```ts
import { timingSafeEqual } from 'node:crypto';

export function assertWhatsAppWebhookSecret(headers: Headers): void {
  const expected = process.env.WHATSAPP_WEBHOOK_HEADER_SECRET!;
  const received = headers.get(process.env.WHATSAPP_WEBHOOK_HEADER_NAME ?? 'x-ambrogio-webhook-secret');

  if (!received) throw new Error('Missing secret');

  // Timing-safe per evitare timing attacks
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Webhook secret mismatch');
  }
}
```

Implementazione attuale: `src/lib/whatsapp/webhook-security.ts`.

> **Future improvement:** se si migra a Meta API diretta sara' richiesta
> verifica HMAC SHA-256 sul raw body (`x-hub-signature-256` header). La
> shape `assertWhatsAppWebhookSecret` puo' essere estesa per accettare
> entrambi gli schemi.

### Internal jobs

```ts
// Header: x-ambrogio-job-secret
// Compare: timing-safe (no leakage di lunghezza/contenuto)
const expected = process.env.INTERNAL_JOB_SECRET!;
const received = headers.get('x-ambrogio-job-secret');

if (!received || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
  throw new AppError('forbidden', 'Invalid internal job secret');
}
```

Esempio cron (Vercel Cron `vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/internal/jobs/appointment-reminders",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

> **NB:** Vercel Cron non passa header custom. Per questi setup serve un
> proxy Cloudflare Worker o un secondary cron service (Upstash QStash,
> GitHub Actions con `curl`).

---

## Footer

### Endpoints con shape inferita / TODO

I seguenti endpoint hanno **response shape inferita dal nome del service** e
non da un type esplicito Zod-validato in route. La sorgente reale di verita'
e' il file `src/server/**/*.ts`. TODO per future iterazioni: estrarre type
condivisi o generare OpenAPI:

- `GET /api/onboarding/tenant` — `getStatus()` shape
- `GET /api/settings/tenant` — `getSnapshot()` shape
- `GET /api/settings/business-hours` — `listBusinessHours()` shape
- `GET /api/settings/services` — `listServices()` shape
- `GET /api/billing/status` — `StripeBillingService.getStatus()`
- `POST /api/billing/checkout|portal` — `{ url, sessionId? }`
- `GET /api/conversations` + `/:id` — `ConversationInbox` types
- `GET /api/knowledge-base` + `/:id` — `KnowledgeBaseDocumentService`
- `GET /api/integrations/google-calendar/status` — service shape
- `GET /api/usage/status` — `getDashboardSnapshot()` shape
- `GET /api/whatsapp/opt-outs` — service shape

### Roadmap

- [ ] OpenAPI 3.1 spec auto-generata da Zod (es. `zod-to-openapi`).
- [ ] Header `Retry-After` su risposte 429.
- [ ] Migrare WhatsApp webhook a HMAC SHA-256 (Meta direct).
- [ ] Wire `gdprDelete` rate-limit policy su `DELETE /api/tenant/account`.

### Contact

Per dubbi sull'API contract o per segnalare divergenze tra doc e codice,
aprire una issue interna o pingare il maintainer (Christian Calabro').

Ultimo aggiornamento: 2026-05-08. Generato leggendo tutte le route in
`src/app/api/**/route.ts`.
