# PROMPT 10 - WHITE LABEL PER AGENZIE

## PROMPT OPERATIVO CODEX

Il piano Agency e' il nostro moltiplicatore. Un'agenzia gestisce N clienti finali sotto il proprio brand. Costruiamolo bene.

STEP 1 - Schema agency

Modifica tenants table:
- parent_tenant_id uuid nullable - se valorizzato, e' un cliente di un'agency
- is_agency boolean default false - true per tenant di tipo agency
- custom_domain text nullable - dominio custom (es. bot.agenziasole.it)
- branding_config jsonb - logo, colori, font

STEP 2 - Agency dashboard

Per tenant con is_agency=true, dashboard diverso:
- Overview: tutti i clienti gestiti + MRR aggregato + conversazioni totali
- Lista clienti: ogni cliente con status + ultimo pagamento + conversazioni mese
- Add client: wizard per creare nuovo tenant cliente sotto il proprio
- Impersonate client: switch context per vedere dashboard come se fossi il cliente

STEP 3 - Multi-tenant impersonation

Feature "Switch to client view":
- Agency user puo' cambiare tenant_id nella session
- JWT token refresh con nuovo tenant_id claim
- Banner in cima "Stai visualizzando come cliente XXX"
- Button "Torna alla vista agency"
- Audit log di ogni impersonation (chi, quando, quale client)

STEP 4 - Custom domain

Cliente agency puo' usare dominio custom invece di ambrogio.ai:
- DNS setup: aggiungi CNAME agency.ambrogio.ai -> custom domain
- Cloudflare SSL automatic
- Landing page brandizzata con logo e colori agency
- Email transazionali FROM custom domain

Processo:
1. Agency inserisce custom domain in dashboard
2. Sistema mostra istruzioni DNS (record + valore)
3. Verifica automatica propagazione (check ogni 5 min)
4. Appena propagato, certificate SSL issued automaticamente
5. Dominio attivo per quel cliente

STEP 5 - Branding customization

Config agency:
- Logo (upload file, stored Supabase Storage)
- Colore primario + secondario (CSS variables)
- Font custom (Google Fonts)
- Nome prodotto (es. "AIBot Pro" invece di "Ambrogio.ai")
- Email templates: logo + brand name
- Favicon

Applica branding su:
- Dashboard cliente (quando acceduto da loro)
- Email transazionali
- WhatsApp greeting messages
- Fatture (logo agency invece che nostro)

STEP 6 - Revenue sharing automation

Nel piano Agency, l'agenzia:
- Paga €897/mese con 5 clienti attivi inclusi
- Paga €79/mese per ogni cliente attivo extra
- Rivende a propri clienti a €200-350 con markup

Nel nostro sistema:
- Non ci preoccupiamo dei prezzi rivendita (sono loro clienti)
- Tracciamo utilizzo, clienti attivi e costi canale per addebitare extra se superano quota

Alert automatici:
- Agency al 80% quota inclusa: email "stai per raggiungere il limite di 5 clienti inclusi"
- Agency oltre quota: cliente extra fatturato o auto-upgrade proposto

STEP 7 - Agency tools

Per rendere l'agency produttiva:
- Bulk client creation (CSV upload)
- Template di FAQ condivise tra tutti i clienti agency (es. disclaimer GDPR standard)
- Quick setup per settori verticali (wizard "nuovo studio dentistico" con FAQ e config preimpostati)
- Reportistica mensile auto-generata per ogni cliente (PDF white-label da inviare)

STEP 8 - Commission tracking (fase 2)

Se vogliamo affiliate program in futuro:
- Tabella affiliate_links, signups_attributed
- Dashboard "le mie referral"
- Payout via Stripe Connect

STEP 9 - API per agency

Endpoint REST per agency sviluppatori:
- GET /api/v1/clients (lista clienti)
- POST /api/v1/clients (crea cliente)
- PATCH /api/v1/clients/:id
- GET /api/v1/clients/:id/conversations
- API key auth (salvata in integrations table)
- Rate limit agency-specific (500 req/min)

Documentazione Swagger/OpenAPI auto-generata.

STEP 10 - Test

Test end-to-end flow agency:
- Signup agency
- Create 3 clienti
- Impersonate client, invia messaggio test
- Switch back to agency view
- Verifica audit log
- Test custom domain setup (con domino test)
- Test branding su email template
