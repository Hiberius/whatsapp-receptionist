# Frontend Handoff Contract

## Fatto da Codex - 2026-04-24

Questa base frontend e' solo un telaio tecnico. Dal 2026-04-25 Codex mantiene ownership operativa anche di frontend coordination, visual direction, componenti finali, copy e interazioni. Eventuali riferimenti a Codex frontend sono legacy handoff, salvo nuova delega esplicita del founder.

## Route Disponibili

- `/` placeholder tecnico.
- `/login` placeholder auth.
- `/register` placeholder signup tenant.
- `/dashboard` placeholder dashboard cliente.
- `/conversations` placeholder inbox conversazioni.
- `/settings` placeholder impostazioni tenant.
- Legal pages da creare lato frontend/statico:
  - `/privacy-policy`
  - `/terms`
  - `/cookie-policy`
  - `/dpa`
  - `/subprocessors`
  - `/security`
- `/api/health` healthcheck backend.
- `/api/onboarding/tenant` GET/POST stato e completamento onboarding tenant.
- `/api/webhook/whatsapp` webhook WhatsApp MVP.
- `/api/internal/booking/availability` availability backend protetta da secret interno.
- `/api/internal/booking/appointments` create appointment backend protetta da secret interno.
- `/api/integrations/google-calendar/status` stato integrazione Google Calendar per dashboard settings.
- `/api/integrations/google-calendar/connect` redirect OAuth Google Calendar.
- `/api/integrations/google-calendar/callback` callback OAuth Google Calendar.
- `/api/integrations/google-calendar/disconnect` disconnect/revoke Google Calendar.
- `/api/whatsapp/opt-outs?customerIdentifier=<numero>` GET/DELETE stato e revoca consenso WhatsApp per owner/admin.
- `/api/settings/tenant` GET/PATCH snapshot e configurazione tenant.
- `/api/settings/services` GET/POST servizi tenant.
- `/api/settings/services/[serviceId]` PATCH/DELETE servizio tenant, DELETE archivia soft.
- `/api/settings/business-hours` GET/PUT orari apertura tenant.
- `/api/conversations` GET inbox conversazioni con filtri.
- `/api/conversations/[conversationId]` GET/PATCH dettaglio conversazione e stato/AI.
- `/api/knowledge-base` GET/POST documenti knowledge base.
- `/api/knowledge-base/[documentId]` GET/PATCH/DELETE documento knowledge base, DELETE archivia soft.

## Contratto Onboarding Tenant

Fatto da Codex il 2026-04-26.

`GET /api/onboarding/tenant`

Restituisce stato onboarding per utente autenticato Supabase:

```json
{
  "ok": true,
  "data": {
    "onboarded": false,
    "tenant": null,
    "role": null
  }
}
```

`POST /api/onboarding/tenant`

Crea tenant trial 14 giorni senza carta, primo owner, config iniziale, servizio/orari seed e sincronizza i claim auth.

Payload minimo:

```json
{
  "tenantName": "Studio Rossi",
  "billingEmail": "amministrazione@studiorossi.it"
}
```

Payload opzionale:

- `timezone`, default `Europe/Rome`;
- `businessType`;
- `studioName`, `assistantName`;
- `city`, `address`, `phone`, `email`, `fullName`;
- `services[]` con `name`, `description`, `durationMinutes`, `priceCents`, `active`;
- `businessHours[]` con `weekday`, `opensAt`, `closesAt`, `active`.

Risposta:

```json
{
  "ok": true,
  "data": {
    "onboarded": true,
    "role": "owner",
    "tenant": {
      "id": "uuid",
      "slug": "studio-rossi-12345678",
      "name": "Studio Rossi",
      "trialEndsAt": "2026-05-10T12:00:00.000Z"
    }
  }
}
```

Note UI:

- Dopo `POST`, ricaricare sessione/token Supabase o forzare refresh auth per ricevere `app_metadata.tenant_id` e `role`.
- Se `GET` torna `onboarded=true`, saltare wizard e andare alla dashboard.
- Default seed: servizio "Prima visita" 30 minuti e orari lunedi-venerdi 09:00-18:00.

## Contratto Settings Google Calendar

Fatto da Codex il 2026-04-25.

`GET /api/integrations/google-calendar/status?returnTo=/settings?tab=calendar`

Risposta envelope:

```json
{
  "ok": true,
  "data": {
    "provider": "google_calendar",
    "connected": true,
    "status": "active",
    "calendarId": "primary",
    "externalDisplayId": "Google Calendar",
    "connectedAt": "2026-04-25T10:00:00.000Z",
    "disconnectedAt": null,
    "lastSyncAt": "2026-04-25T10:00:00.000Z",
    "updatedAt": "2026-04-25T10:01:00.000Z",
    "scopes": ["calendar.events"],
    "canManage": true,
    "connectUrl": "/api/integrations/google-calendar/connect?returnTo=%2Fsettings%3Ftab%3Dcalendar",
    "disconnectUrl": "/api/integrations/google-calendar/disconnect"
  }
}
```

Note UI:

- Mostrare `connectUrl` solo se `canManage=true`.
- Chiamare `disconnectUrl` con `POST`, non link GET.
- Non aspettarsi token o credenziali dal frontend: non vengono mai esposti.
- Dopo callback, leggere query `google_calendar=connected` o `google_calendar=error`.

## Contratto Consenso WhatsApp

Fatto da Codex il 2026-04-26.

`GET /api/whatsapp/opt-outs?customerIdentifier=393331112233`

```json
{
  "ok": true,
  "data": {
    "channel": "whatsapp",
    "customerIdentifier": "393331112233",
    "optedOut": true,
    "reason": "keyword_stop",
    "optedOutAt": "2026-04-26T08:00:00.000Z",
    "createdAt": "2026-04-26T08:00:00.000Z"
  }
}
```

`DELETE /api/whatsapp/opt-outs?customerIdentifier=393331112233`

Restituisce lo stesso stato con `optedOut=false` e `revoked=true|false`.

Note UI:

- Mostrare solo a owner/admin.
- La revoca e' idempotente: `revoked=false` significa che non c'era piu un opt-out da cancellare.
- Ogni `DELETE` viene auditato lato backend con utente, IP, user agent e stato precedente.
- Non riattivare comunicazioni marketing senza base giuridica e copy chiaro.

## Contratto Tenant Settings

Fatto da Codex il 2026-04-26.

- `GET /api/settings/tenant`: restituisce `{ tenant, config, services, businessHours }`.
- `PATCH /api/settings/tenant`: owner/admin, aggiorna profilo tenant e config assistant/voice/booking.
- `GET /api/settings/services`: lista servizi.
- `POST /api/settings/services`: owner/admin, crea servizio.
- `PATCH /api/settings/services/[serviceId]`: owner/admin, aggiorna servizio.
- `DELETE /api/settings/services/[serviceId]`: owner/admin, archivia servizio (`active=false`).
- `GET /api/settings/business-hours`: lista orari.
- `PUT /api/settings/business-hours`: owner/admin, sostituisce orari con validazione overlap.

Campi principali:

- Tenant: `name`, `timezone`, `businessType`.
- Config: `studioName`, `assistantName`, `autoReplyEnabled`, `voiceMessagesEnabled`, `voiceRepliesEnabled`, `bookingMinLeadMinutes`, `bookingSlotStepMinutes`, `bookingBufferMinutes`, `bookingMaxDaysAhead`, `elevenlabsVoiceId`.
- Service: `name`, `description`, `durationMinutes`, `priceCents`, `active`.
- Business hour: `weekday` 0-6, `opensAt`, `closesAt`, `active`.

Ogni mutazione settings viene auditata lato backend.

## Contratto Inbox Conversazioni

Fatto da Codex il 2026-04-26.

- `GET /api/conversations?status=active&channel=whatsapp&limit=30&before=<iso>`: lista conversazioni tenant-scoped.
- `GET /api/conversations/[conversationId]?messageLimit=100`: dettaglio conversazione con messaggi.
- `PATCH /api/conversations/[conversationId]`: owner/admin, aggiorna `status`, `aiEnabled`, `customerName`.

Status supportati: `active`, `escalated`, `closed`, `spam`.

Nota UI: l'invio manuale operatore non e' ancora esposto; prima va collegato a opt-out, outbox e policy finestra WhatsApp 24h/template.

## Contratto Knowledge Base

Fatto da Codex il 2026-04-26.

- `GET /api/knowledge-base?active=true&category=orari&limit=50`: lista documenti.
- `POST /api/knowledge-base`: owner/admin, crea documento.
- `GET /api/knowledge-base/[documentId]`: dettaglio documento.
- `PATCH /api/knowledge-base/[documentId]`: owner/admin, aggiorna documento.
- `DELETE /api/knowledge-base/[documentId]`: owner/admin, archivia documento (`active=false`).

Campi documento: `title`, `content`, `category`, `active`, `hasEmbedding`.

Nota UI: `generateEmbedding` default `true`; se OpenAI embeddings non e' configurato, il backend salva il documento senza embedding e mantiene fallback lessicale.

## Vincoli Frontend Per Codex

- Non spostare la logica backend da `src/lib`.
- Puoi sostituire markup e CSS dei placeholder.
- Mantieni route groups `(auth)` e `(dashboard)` salvo motivo forte.
- Trial copy corrente: 14 giorni senza carta.
- Non usare claim assoluti tipo "GDPR compliant" finche' i documenti non sono rivisti da legale. Preferire "progettato con basi GDPR-first" o "DPA e sub-responsabili trasparenti".
- Pricing aggiornato da Codex: beta Starter 97 / Professional 247; pubblico raccomandato Starter 149 / Professional 299 / Agency 897 con costi canale chiari.

## Direzione Landing Aggiornata Da Codex

- Ambrogio.ai e' il brand; Ambrogio e' l'assistente digitale. Non usare frasi come "il tuo ambrogio".
- Hero consigliato: "La tua segreteria risponde solo in orario. Ambrogio risponde sempre."
- Aggiungere alla landing:
  - demo interattiva WhatsApp statica con 4 scenari, incluso messaggio vocale;
  - sezione Prima/Dopo;
  - verticali Dentisti, Estetiste, Veterinari, Palestre/Pilates, Studi professionali;
  - banda Trust/GDPR/WhatsApp ufficiale;
  - ROI calculator indicativo.
- Evitare social proof non verificata. Usare "Stiamo aprendo i primi 20 studi pilota in Italia" finche' non ci sono numeri reali.
- Componenti suggeriti: `InteractiveWhatsAppDemo`, `BeforeAfter`, `VerticalUseCases`, `TrustCompliance`, `ROICalculator`.
- Aggiungere nei setting dashboard un pannello Voice/ElevenLabs con toggle trascrizione vocali, toggle risposte vocali, scelta voce e preview audio.
- Aggiungere nei setting dashboard un pannello Booking con servizi, business hours, lead time, buffer, step slot e stato Google Calendar usando il contratto API sopra.

## Asset Visuali Pronti

Fatto da Codex il 2026-04-24: generata libreria di 20 immagini originali per il sito.

- Cartella: `public/assets/site-images/ambrogio/`
- Manifest: `public/assets/site-images/ambrogio/manifest.json`
- Preview completa: `public/assets/site-images/ambrogio/contact-sheet.webp`
- SVG sorgenti: `public/assets/site-images/ambrogio/svg/`
- PNG export: `public/assets/site-images/ambrogio/png/`
- WebP export: `public/assets/site-images/ambrogio/webp/`

Uso consigliato:

- Hero/background e sezioni editoriali: WebP.
- Illustrazioni inline/componenti responsive: SVG.
- Deck, social preview e export statici: PNG.
- Non ci sono loghi ufficiali di provider terzi dentro gli asset, cosi' possono essere usati senza rischio di trademark misuse.

## Legal E Pricing Per Frontend

- Usare come fonti i file in `05_LEGAL_GDPR/`:
  - `privacy_policy_template.md`
  - `terms_of_service.md`
  - `cookie_policy_template.md`
  - `dpa_template.md`
  - `subprocessors.md`
- Footer landing: Privacy, Terms, Cookie, DPA, Subprocessors, Security.
- Checkout/signup:
  - checkbox Terms + Privacy obbligatoria e non preselezionata;
  - opt-in marketing separato;
  - link DPA per clienti business.
- Pricing section:
  - chiarire cosa e' incluso;
  - indicare "costi WhatsApp/provider secondo piano o fair use";
  - non promettere "illimitato" per voice/WhatsApp senza fair use.

## Skill Design Installate

Fatto da Codex il 2026-04-24 con `npx skills add ... --yes --global`.

- `emil-design-eng` da `emilkowalski/skill`: polish UI, component quality, animazioni e dettagli invisibili.
- `impeccable` da `pbakaus/impeccable`: UX/UI audit, hierarchy, accessibility, responsive behavior, copy e performance.
- `industrial-brutalist-ui`, `gpt-taste`, `image-taste-frontend`, `minimalist-ui`, `full-output-enforcement`, `redesign-existing-projects`, `high-end-visual-design`, `stitch-design-taste`, `design-taste-frontend` da `Leonxlnx/taste-skill`.

Nota: riavviare Codex se le skill appena installate non compaiono immediatamente nella sessione.

## Contratto Stripe Billing

Fatto da Claude Code il 2026-04-27.

`GET /api/billing/status`

Restituisce uno snapshot billing per la sessione tenant corrente.

```json
{
  "ok": true,
  "data": {
    "plan": "trial",
    "status": "active",
    "trialEndsAt": "2026-05-10T12:00:00.000Z",
    "currentPeriodEnd": null,
    "cancelAtPeriodEnd": false,
    "subscriptionStatus": null,
    "hasStripeCustomer": false,
    "hasActiveSubscription": false,
    "canCheckout": true,
    "canManageBilling": false,
    "availablePlans": ["starter", "professional"]
  }
}
```

Note UI:

- `availablePlans` riflette i price ID configurati lato server. Mostrare solo i piani presenti.
- `canCheckout=true` solo se l'utente e' owner/admin e non ha gia' una sottoscrizione attiva.
- `canManageBilling=true` solo se esiste gia' un Customer Stripe (cioe' dopo il primo checkout).
- Il piano Agency NON e' selezionabile via self-checkout in MVP: tenant Agency vengono creati manualmente dal founder. Mostrare un CTA "Contatta vendite" per Agency.

`POST /api/billing/checkout`

Crea una Checkout Session Stripe (`mode: 'subscription'`) e ritorna l'URL hosted.

Payload:

```json
{ "plan": "starter" }
```

Plan ammessi: `starter` | `professional` (Zod strict). Owner/admin only.

Risposta:

```json
{
  "ok": true,
  "data": {
    "url": "https://checkout.stripe.com/c/pay/cs_..."
  }
}
```

Note UI:

- Reindirizzare il browser su `data.url`.
- Configurare `STRIPE_CHECKOUT_SUCCESS_URL` e `STRIPE_CHECKOUT_CANCEL_URL` puntando a `/dashboard/billing` con query `?checkout=success|cancel`.
- Il backend crea il Customer Stripe in modo lazy: nessuna chiamata Stripe finche' l'utente non clicca "upgrade".

`POST /api/billing/portal`

Crea una Billing Portal Session per l'autogestione subscription/metodi pagamento.

Risposta:

```json
{ "ok": true, "data": { "url": "https://billing.stripe.com/p/session/..." } }
```

Note UI:

- Owner/admin only.
- Mostrare il bottone "Gestisci abbonamento" solo se `hasStripeCustomer=true` (altrimenti il backend torna `bad_request`).
- Reindirizzare su `data.url`.

`POST /api/webhook/stripe`

Endpoint webhook server-side. Lato frontend non viene chiamato. Stripe deve essere configurato con questo URL nel Dashboard. La signature viene verificata con `STRIPE_WEBHOOK_SECRET`.

Eventi gestiti:

- `checkout.session.completed`
- `customer.subscription.created` / `updated` / `deleted`
- `invoice.paid` / `invoice.payment_succeeded` / `invoice.payment_failed`

Comportamento cancel:

- `cancel_at_period_end=true`: il piano resta attivo fino a `currentPeriodEnd`, il dashboard mostra "rinnovo disattivato".
- Webhook `customer.subscription.deleted`: il tenant torna a `plan='trial'` + `status='cancelled'` e perde l'accesso ai piani a pagamento. Il trial originale NON viene esteso.

Trial 14 giorni:

- Resta gestito esclusivamente in Supabase (`tenants.trial_ends_at`).
- Nessuna chiamata Stripe avviene durante l'onboarding.
- L'upgrade da trial fa partire la subscription Stripe immediatamente: il flag `hasActiveSubscription` diventa `true` quando lo status Stripe e' `active`/`trialing`/`past_due`.

## Contratto Usage Limits

Fatto da Claude Code il 2026-04-27.

`GET /api/usage/status`

Restituisce lo snapshot dei limiti del piano per il tenant corrente.

```json
{
  "ok": true,
  "data": {
    "plan": "starter",
    "metricMonth": "2026-04-01",
    "conversations": {
      "used": 412,
      "limit": 500,
      "percent": 82,
      "exceeded": false,
      "warning": true
    },
    "voiceMessages": {
      "used": 75,
      "limit": 200,
      "percent": 38,
      "exceeded": false,
      "warning": false
    },
    "messages": { "used": 1840 },
    "aiCostCents": { "used": 1430 },
    "autoReplyAllowed": true,
    "blockReason": null,
    "softWarning": true
  }
}
```

Note UI:

- Mostrare un banner di **soft warning** quando `softWarning=true` (e `autoReplyAllowed=true`): "Stai usando l'82% del piano. Aggiorna a Professional per non interrompere le risposte automatiche."
- Mostrare un banner di **hard block** quando `autoReplyAllowed=false`. Copy in base a `blockReason`:
  - `conversations_exceeded`: "Hai raggiunto il limite di conversazioni del piano. Ambrogio ha sospeso le risposte automatiche fino al primo del mese o all'upgrade del piano."
  - `voice_exceeded`: "Hai raggiunto il limite di vocali. Le risposte automatiche ai messaggi vocali sono sospese."
- I numeri (`used`, `limit`, `percent`) sono pronti per essere mostrati come progress bar.
- Il rollover e' mensile, nessun carry-over.
- Limiti per piano (riferimento, non da hardcodare nel client):

  | Piano | Conversazioni/mese | Vocali/mese |
  |---|---|---|
  | Trial | 100 | 50 |
  | Starter | 500 | 200 |
  | Professional | 2.000 | 500 |
  | Agency | 2.000 per tenant | 500 per tenant |

- Quando `autoReplyAllowed=false`, Ambrogio NON manda risposte automatiche, ma il webhook continua a ricevere messaggi (storia inbox, opt-out, voice STT e booking conversazionale restano attivi). L'operatore puo' rispondere manualmente quando l'invio manuale sara' disponibile.
- Per Agency: il limite e' applicato per-tenant (un cliente finale dell'agenzia). Per la dashboard multi-cliente, aggregare gli snapshot dei tenant gestiti.

## Contratto Invio Manuale Operatore

Fatto da Claude Code il 2026-04-27.

`POST /api/conversations/[conversationId]/messages`

Permette a owner/admin di inviare un messaggio manuale WhatsApp da inbox.

Payload (Zod strict):

```json
{ "content": "Ciao Mario, confermo l'appuntamento di domani alle 10." }
```

- `content`: stringa 1..4096 caratteri (limite WhatsApp text body). Trim automatico server-side.

Risposta success:

```json
{
  "ok": true,
  "data": {
    "messageId": "uuid",
    "externalId": "manual:uuid",
    "conversationId": "uuid",
    "enqueuedJobId": "uuid",
    "customerServiceWindowExpiresAt": "2026-04-28T11:00:00.000Z"
  }
}
```

Errori:

- `403 forbidden`: ruolo member, oppure customer e' opted-out;
- `404 not_found`: conversazione mancante o non tenant-scoped;
- `400 bad_request`: channel diverso da `whatsapp`, contenuto vuoto/whitespace o troppo lungo;
- `409 conflict`: customer service window 24h chiusa (l'invio template manuale non e' ancora supportato).

Note UI:

- Mostrare l'input manuale solo a owner/admin.
- Disabilitare l'input quando il customer e' opted-out (conoscibile da `/api/whatsapp/opt-outs`) o la finestra 24h e' chiusa.
- Per calcolare se la finestra e' aperta: `now < lastInboundMessageAt + 24h`. La risposta success ritorna `customerServiceWindowExpiresAt` per refreshare il countdown post-invio.
- Dopo invio andato a buon fine, il messaggio appare in inbox con `senderType='human'` e va nell'outbox WhatsApp (consegna asincrona). Il `messages.status` evolvera' man mano che il provider conferma (`pending` → `sent` → `delivered` → `read` o `failed`).
- Doppio click protetto: l'`externalId` e' generato server-side e univoco, nessun rischio di doppi invii dallo stesso click.
- Il messaggio rispetta l'opt-out e la finestra 24h sempre, anche se l'auto-reply e' bloccato per usage limit. L'invio manuale NON conta verso il limite conversations/voice.

## Client API Tipizzato (Browser-Side)

Fatto da Claude Code il 2026-04-27.

`src/lib/api-client/` contiene un client TypeScript tipizzato per consumare le route aggiunte durante il takeover (Stripe billing, usage limits, invio manuale operatore). E' pure plumbing: zero UI, zero copy, zero design. Codex puo' adottarlo, estenderlo o sostituirlo senza vincoli sulla direzione visiva.

**Scope coperto** (solo route Claude Code):

- `createBillingClient()`:
  - `getStatus()` → `BillingStatus`
  - `createCheckoutSession({ plan })` → `{ url }`
  - `createPortalSession()` → `{ url }`
- `createUsageClient()`:
  - `getStatus()` → `UsageSnapshot`
- `createConversationsClient()`:
  - `sendOperatorMessage({ conversationId, content })` → `SendOperatorMessageResult`

**Scope NON coperto**: route Codex pre-esistenti (settings, conversations GET/PATCH, knowledge-base, onboarding, integrations). Codex le coprira' al rientro con il pattern frontend di sua scelta, restando proprietario della direzione visiva.

**Esempio d'uso (Client Component):**

```tsx
'use client';
import { useEffect, useState } from 'react';
import {
  ApiError,
  createBillingClient,
  type BillingStatus,
} from '@/lib/api-client';

const billing = createBillingClient();

export function BillingPanel() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    billing
      .getStatus({ signal: ac.signal })
      .then(setStatus)
      .catch((err) => setError(err instanceof ApiError ? err : null));
    return () => ac.abort();
  }, []);

  // ... render
}
```

**Caratteristiche**:

- Validazione runtime via Zod su ogni response (envelope + payload).
- Errori envelope server mappati a `ApiError` tipizzato con `code` e `status`.
- Error code aggiuntivi client-side: `network_error` (fetch fallito), `invalid_response` (JSON malformato o schema mismatch).
- Nessuna dipendenza nuova: usa solo `zod` (gia' presente).
- Nessuna libreria di state management/query caching imposta: Codex sceglie liberamente TanStack Query, SWR, server actions o RSC.
- Browser-only: `credentials: 'same-origin'` per i cookie Supabase. Per RSC/Server Actions invocare direttamente i service in `src/server/...`.
- Funzioni `createXxxClient({ baseUrl })` accettano `baseUrl` opzionale per testing/SSR-friendly.

Per estendere il client a nuovi endpoint (es. settings inbox), Codex puo' aggiungere file gemelli (`settings.ts`, `inbox.ts`) seguendo lo stesso pattern: schema Zod + funzione che chiama `apiFetch`. Vedi `src/lib/api-client/billing.ts` come riferimento.
