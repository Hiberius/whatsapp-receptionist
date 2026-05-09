# PROMPT 08 - BILLING CON STRIPE

## PROMPT OPERATIVO CODEX

Implementa subscription billing con Stripe (Italia, IVA 22% gestita).

STEP 1 - Stripe setup

Crea in Stripe Dashboard:
- Products: Starter, Professional, Agency
- Prezzi mensili e annuali per ogni piano
- Setup fee come one-time charge
- Tax rate Italia IVA 22%
- Customer Portal config: permetti self-service upgrade/downgrade, cancellation

Env variables:
- STRIPE_SECRET_KEY (sk_live_...)
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_STARTER_MONTHLY
- STRIPE_PRICE_STARTER_YEARLY
- STRIPE_PRICE_PROFESSIONAL_MONTHLY
- STRIPE_PRICE_PROFESSIONAL_YEARLY
- STRIPE_PRICE_AGENCY_MONTHLY
- STRIPE_PRICE_AGENCY_YEARLY

STEP 2 - Checkout flow

Crea src/app/api/billing/checkout/route.ts:
- Input: plan_id, billing_cycle (monthly/yearly)
- Crea Stripe Customer se non esiste, salva customer_id in tenants
- Crea Checkout Session con:
  - line_items: prezzo abbonamento + setup_fee
  - mode: subscription
  - success_url: /dashboard?welcome=true
  - cancel_url: /billing?cancelled=true
  - tax_behavior: inclusive con Italian VAT
  - allow_promotion_codes: true
  - billing_address_collection: required (serve per IVA)
  - customer_update: address, name
- Ritorna URL Stripe checkout

STEP 3 - Webhook handler

Crea src/app/api/webhook/stripe/route.ts:
- Verifica signature Stripe con STRIPE_WEBHOOK_SECRET
- Handle eventi:
  - checkout.session.completed: attiva subscription, aggiorna tenant.plan
  - invoice.paid: registra in billing_events
  - invoice.payment_failed: notifica owner, segna subscription_past_due
  - customer.subscription.updated: aggiorna piano
  - customer.subscription.deleted: downgrade a trial, notifica
- Ritorna 200 OK (Stripe retry se non)

STEP 4 - Trial logic

- Nuovo tenant parte con trial 14 giorni (plan='trial')
- Dopo 14 giorni senza checkout: downgrade a stato "expired", sospende funzionalita' (bot si ferma, dashboard mostra banner)
- Reminder email a giorno 7, 12, 14
- Non richiediamo carta per trial (lowering friction)

STEP 5 - Usage-based metering

Per piani Starter/Professional c'e' limite conversazioni/mese:
- Counter in tabella usage_metrics (tenant_id, month, conversations_count)
- Alert quando utilizzo supera 80% quota
- Blocco soft quando supera 100%: AI non risponde piu', dashboard mostra upgrade prompt
- Reset mensile via cron Trigger.dev

STEP 6 - Fatturazione italiana

Requisiti IVA Italia:
- Cliente Italia con P.IVA: IVA 22% applicata (reverse charge se B2B UE)
- Cliente EU senza P.IVA: IVA 22% Italia
- Cliente extra-EU: esenzione IVA
- Cliente business Italia: serve codice destinatario SDI per fatturazione elettronica

Alternative per fatturazione elettronica:
- Opzione 1: Stripe Tax (gestisce IVA ma non fatturazione elettronica italiana)
- Opzione 2: Integrazione Fatture in Cloud API (fattura elettronica SDI automatica)
- Opzione 3: Delega a commercialista (semplice ma manuale)

Consiglio: parti con Stripe Tax + fattura elettronica manuale prime settimane, poi integra Fatture in Cloud quando >20 clienti.

STEP 7 - Customer portal

Link da dashboard a Stripe Customer Portal:
- Gestione metodo pagamento
- Storico fatture (PDF)
- Cambio piano
- Cancellazione subscription

STEP 8 - Cancellation flow

Quando utente cancella:
- Survey opzionale "perche' cancelli?" (per retention insights)
- Subscription rimane attiva fino fine billing period
- Email conferma cancellazione
- Automatic downgrade a trial state a scadenza periodo
- Retention email 7 giorni prima scadenza con offerta 30% discount per restare

STEP 9 - Dunning management

Se pagamento fallisce:
- Giorno 1: email "pagamento fallito, update carta"
- Giorno 3: email reminder + WhatsApp (se abilitato)
- Giorno 7: subscription pausata, bot si ferma
- Giorno 14: subscription cancellata definitivamente

STEP 10 - Test

Usa Stripe test mode:
- Test checkout successo (carta 4242...)
- Test checkout fallito (4000 0000 0000 0002)
- Test webhook delivery (Stripe CLI: stripe listen --forward-to localhost:3000/api/webhook/stripe)
- Test upgrade/downgrade
- Test cancellation + renewal
- Test tax calculation (cliente Italia vs UE vs extra-UE)

STEP 11 - FATTURAZIONE ELETTRONICA ITALIA (SDI) - CRITICO per B2B Italia

Stripe Tax gestisce IVA 22% ma NON emette fatture conformi al Sistema di Interscambio italiano (SDI) richiesto per ogni transazione B2B in Italia. Senza integrazione SDI, i clienti italiani NON possono detrarre IVA e non sono legalmente compliance.

SOLUZIONE: integrare provider italiano di fatturazione elettronica.

Opzioni valutate:
1. **Fatture in Cloud API** (TeamSystem) - ~€8-15/mese + piano Premium API
   - REST API documentata
   - Invio automatico SDI incluso
   - Gestione conservazione a norma 10 anni inclusa
   - Consigliato per startup SaaS

2. **Aruba Fatturazione Elettronica API** - ~€5/mese + €0.19/fattura
   - Più cheap ma meno developer-friendly
   - API SOAP legacy (meno moderna)

3. **Commercialista emette a mano** - €0 setup ma non scala oltre 20-30 clienti/mese

SCELTA: Fatture in Cloud API.

Crea src/lib/invoicing/fattureincloud.ts:
- Client wrapper con Bearer token auth
- Funzione createInvoice(subscription, customer, amount, vat_number)
- Funzione sendToSDI(invoice_id) - auto dopo creazione

Flow integrato:
1. Stripe webhook invoice.paid arriva
2. Verifica se cliente è Italia (billing_address.country === 'IT')
3. Se SI: chiama Fatture in Cloud API per creare fattura elettronica
   - Tipo documento: TD01 (fattura ordinaria) se setup fee, TD24 (fattura differita) se abbonamento
   - Natura IVA: N6 se reverse charge, altrimenti imponibile 22%
   - Include P.IVA cliente (obbligatorio)
   - Auto-invia a SDI
4. Se NO (EU o extra-UE): Stripe invoice è sufficiente
5. Salva fatture_in_cloud_invoice_id in DB per audit

Schema DB aggiunto:
\`\`\`sql
CREATE TABLE invoices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  stripe_invoice_id text NOT NULL UNIQUE,
  fattureincloud_invoice_id text, -- NULL se cliente non-IT
  invoice_number text NOT NULL,
  amount_cents integer NOT NULL,
  vat_cents integer NOT NULL,
  status text NOT NULL, -- draft, sent, paid, void
  sdi_status text, -- not_sent, sent, accepted, rejected (solo clienti IT)
  issued_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON invoices(tenant_id);
CREATE INDEX ON invoices(stripe_invoice_id);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
\`\`\`

Env variables aggiuntive:
- FATTUREINCLOUD_API_TOKEN
- FATTUREINCLOUD_COMPANY_ID

Onboarding cliente Italia:
- Durante signup, raccogli: Ragione sociale, P.IVA, Codice SDI o PEC, Indirizzo completo
- Validazione P.IVA con regex + checksum (algoritmo Luhn italiano)
- Salva in tenants.billing_info (encrypted)

Test obbligatori:
- Cliente IT con P.IVA → fattura SDI emessa
- Cliente IT con codice fiscale (privato) → fattura SDI con destinatario "0000000"
- Cliente EU (es. DE, ES) → solo Stripe invoice, reverse charge nota
- Cliente extra-UE (es. UK post-Brexit, US) → solo Stripe invoice, IVA 0%

NOTA IMPORTANTE: se la società operativa non è italiana (es. Malta Ltd o Estonia OÜ) e non fatturi da Italia, la fatturazione elettronica SDI NON si applica: emetti invoice standard Stripe in reverse charge. Vedi `08_LAUNCH_CHECKLIST.md` per decisione entità legale.
