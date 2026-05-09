# Ambrogio AI — API Quick Reference

> Tabella riassuntiva di tutti gli endpoint API. Per shape Zod / esempi curl
> completi vedi [`api-contract.md`](./api-contract.md).
>
> **Auth legend:**
> - `none` = pubblico
> - `user` = `requireAuthenticatedUser` (Supabase JWT)
> - `session` = `requireSession` (JWT + tenant_id + role)
> - `session-admin` = `requireSession` + role IN (owner, admin)
> - `internal` = header `x-ambrogio-job-secret`
> - `webhook-stripe` = `stripe-signature` HMAC
> - `webhook-whatsapp` = header secret static-compare timing-safe
>
> **Rate limit legend:**
> - `–` = nessuno
> - `RL:<policy>` = vedi `src/lib/rate-limit/policies.ts`

## Health

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/health` | GET | none | – | Liveness edge-runtime |
| `/api/health/deep` | GET | none | – | Readiness check Supabase/Upstash/Stripe |

## Onboarding

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/onboarding/tenant` | GET | user | – | Stato wizard onboarding |
| `/api/onboarding/tenant` | POST | user | RL:onboarding | Crea tenant, completa wizard |

## Settings

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/settings/tenant` | GET | session | – | Snapshot settings tenant |
| `/api/settings/tenant` | PATCH | session | RL:settingsWrite | Update parziale settings |
| `/api/settings/business-hours` | GET | session | – | Lista orari apertura |
| `/api/settings/business-hours` | PUT | session | RL:settingsWrite | Replace lista orari |
| `/api/settings/services` | GET | session | – | Lista servizi |
| `/api/settings/services` | POST | session | RL:settingsWrite | Crea servizio |
| `/api/settings/services/:serviceId` | PATCH | session | RL:settingsWrite | Update servizio |
| `/api/settings/services/:serviceId` | DELETE | session | RL:settingsWrite | Archivia servizio |

## Tenant account & GDPR

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/tenant/account` | DELETE | session | – | GDPR Art.17 — soft delete +30gg grace |
| `/api/tenant/account` | POST | session | – | Annulla deletion programmata |
| `/api/tenant/export` | GET | session-admin | RL:gdprExport | GDPR Art.15 — export tenant JSON |

## Customers GDPR

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/customers/:phone/export` | POST | session | – | GDPR Art.15 — export customer |
| `/api/customers/:phone` | DELETE | session | – | GDPR Art.17 — hard delete customer |

## Conversations

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/conversations` | GET | session | – | Lista conversazioni inbox (filtri) |
| `/api/conversations/:conversationId` | GET | session | – | Dettaglio conversazione + msg |
| `/api/conversations/:conversationId` | PATCH | session | – | Update status/AI/nome |
| `/api/conversations/:conversationId/messages` | POST | session | – | Invio manuale operatore |

## Knowledge base

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/knowledge-base` | GET | session | – | Lista documenti KB |
| `/api/knowledge-base` | POST | session | – | Crea documento KB |
| `/api/knowledge-base/:documentId` | GET | session | – | Dettaglio documento |
| `/api/knowledge-base/:documentId` | PATCH | session | – | Update documento |
| `/api/knowledge-base/:documentId` | DELETE | session | – | Archivia documento |

## Calendar (Google integration)

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/integrations/google-calendar/status` | GET | session | – | Stato connessione |
| `/api/integrations/google-calendar/connect` | GET | session | – | Avvia flow OAuth (redirect) |
| `/api/integrations/google-calendar/callback` | GET | session | – | Callback OAuth (redirect) |
| `/api/integrations/google-calendar/disconnect` | POST | session | – | Disconnetti calendar |

## Billing (Stripe)

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/billing/status` | GET | session | – | Stato sottoscrizione |
| `/api/billing/checkout` | POST | session | – | Crea Checkout Session |
| `/api/billing/portal` | POST | session | – | Crea Customer Portal Session |

## Usage

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/usage/status` | GET | session | – | Snapshot uso vs limiti piano |

## WhatsApp opt-outs

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/whatsapp/opt-outs` | GET | session | – | Stato opt-out customer |
| `/api/whatsapp/opt-outs` | DELETE | session | – | Revoca opt-out (re-opt-in) |

## Webhooks

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/webhook/whatsapp` | GET | none (handshake) | – | Verifica `hub.verify_token` |
| `/api/webhook/whatsapp` | POST | webhook-whatsapp | env-based per IP | Riceve messaggi/status WA |
| `/api/webhook/stripe` | POST | webhook-stripe | env-based per IP | Riceve eventi Stripe |

## Internal jobs (cron)

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/internal/jobs/appointment-reminders` | POST | internal | – | Invia promemoria |
| `/api/internal/jobs/gdpr-hard-delete` | POST | internal | – | Hard delete tenant scaduti |
| `/api/internal/jobs/whatsapp-outbox` | POST | internal | – | Worker outbox WA |
| `/api/internal/jobs/whatsapp-template-sync` | POST | internal | – | Sync template 360dialog |
| `/api/internal/jobs/whatsapp-voice` | POST | internal | – | Pipeline STT/TTS WA |

## Internal booking API (chiamata da AI agents)

| Path | Method | Auth | RL | Descrizione |
|---|---|---|---|---|
| `/api/internal/booking/availability` | POST | internal | – | Slot disponibili |
| `/api/internal/booking/appointments` | POST | internal | – | Crea appuntamento |
| `/api/internal/booking/appointments` | PATCH | internal | – | Riprogramma appuntamento |
| `/api/internal/booking/appointments` | DELETE | internal | – | Cancella appuntamento |

---

## Riepilogo numerico

- **Route file:** 27
- **Endpoint HTTP esposti:** 35 (alcuni file espongono piu' verb)
- **Edge runtime:** 1 (`/api/health`)
- **Node runtime esplicito:** tutti gli internal jobs + GDPR routes
- **Webhook (signature/secret verified):** 3 (Stripe, WhatsApp GET handshake,
  WhatsApp POST)
- **Cron-callable (internal-secret):** 9 (`internal/jobs/*` + `internal/booking/*`)

## Errori (tutti gli endpoint via `jsonHandler`)

| HTTP | Code | Quando |
|---|---|---|
| 400 | `bad_request` | Body/query invalido |
| 401 | `unauthorized` | JWT mancante |
| 401 | `webhook_rejected` | Signature/secret webhook mismatch |
| 403 | `forbidden` | Role/claim insufficiente, internal-secret mismatch |
| 404 | `not_found` | Risorsa non esistente, anti-enumeration |
| 409 | `conflict` | Stato/duplicate conflict |
| 429 | `rate_limited` | Quota superata |
| 500 | `internal` | Errore interno (msg non esposto) |
| 502 | `upstream_error` | Errore provider esterno |

## Header standard

| Header | Direzione | Note |
|---|---|---|
| `x-request-id` | both | UUID, propagato; max 128 char |
| `Content-Type: application/json` | both | sempre |
| `Cookie: sb-...-auth-token=...` | request | Supabase session |
| `x-ambrogio-job-secret: <secret>` | request | Internal jobs (override env) |
| `x-ambrogio-webhook-secret: <secret>` | request | WhatsApp webhook (override env) |
| `stripe-signature: <sig>` | request | Stripe webhook |
| `x-forwarded-for` | request | IP detection (rate limit) |
| `content-disposition: attachment` | response | GDPR export download |
| `Cache-Control: no-store` | response | Health, GDPR export |
