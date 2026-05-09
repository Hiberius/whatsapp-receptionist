# 🗺️ ROADMAP OPERATIVA — 90 GIORNI

## Settimana 1 — Fondamenta

### Giorno 1-2: Setup account e acquisti
- [ ] Registra dominio (vedi `02_NOMI_E_BRAND/nomi_dominio.md`)
- [ ] Crea account:
  - [ ] GitHub (piano Team per privacy + branch protection, ~€4/utente/mese)
  - [ ] Vercel Pro ($20/utente/mese — solo te = $20)
  - [ ] Supabase Pro EU region ($25/mese)
  - [ ] Anthropic Console (Anthropic API)
  - [ ] Stripe (Italia) → setup prodotti IVA 22%
  - [ ] Cloudflare (gratis per CDN + WAF)
  - [ ] Resend (email transazionali, gratis fino 3k/mese)
  - [ ] Trigger.dev (queue jobs, free tier)
  - [ ] PostHog (analytics + feature flags, free tier)
  - [ ] Sentry (error monitoring, free tier)
- [ ] Crea Meta Business Account + inizia verifica (richiede 2-3 settimane → parti SUBITO)
- [ ] Apri ticket con **360dialog** per onboarding WhatsApp BSP italiano

### Giorno 3-5: Repository e base infrastruttura
- [ ] Segui `03_CODEX_BACKEND_PROMPTS/01_setup_iniziale.md`
- [ ] Repo GitHub privato `ambrogio-ai` creato
- [ ] Branch protection main (require PR, require reviews)
- [ ] Pre-commit hook con gitleaks installato
- [ ] Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui installato
- [ ] Connessione a Supabase funziona
- [ ] Deploy su Vercel con dominio custom

### Giorno 6-7: Design system base
- [ ] Scegli 2 siti di riferimento che ti piacciono (salva screenshot)
- [ ] Segui `04_CODEX_FRONTEND_PROMPTS/00_design_system.md`
- [ ] Tokens di design (colori, tipografia, spacing) definiti
- [ ] Componenti base shadcn/ui installati e custom themed

---

## Settimana 2 — Database e autenticazione

### Obiettivi
- Schema completo database con RLS
- Login/registrazione multi-tenant
- Invio email di verifica
- Test di isolamento tenant passati

### Deliverable
- [ ] Esegui `03_CODEX_BACKEND_PROMPTS/02_database_schema.md`
- [ ] Esegui `03_CODEX_BACKEND_PROMPTS/03_auth_multi_tenant.md`
- [ ] Tutti i test RLS passano (esegui test script incluso)
- [ ] Un utente del tenant A NON PUÒ vedere dati del tenant B — verificato
- [ ] Sotto-agente `security_auditor.md` eseguito, output salvato

---

## Settimana 3 — Integrazione WhatsApp

### Obiettivi
- Webhook WhatsApp funzionante
- Ricezione messaggi in DB
- Ricezione vocali WhatsApp + trascrizione ElevenLabs
- Risposta manuale dal dashboard
- Intent router base con Anthropic Haiku

### Deliverable
- [ ] Meta Business verificato (se tardi, usa numero temp 360dialog)
- [ ] Esegui `03_CODEX_BACKEND_PROMPTS/04_whatsapp_integration.md`
- [ ] Messaggio WhatsApp → arriva nel DB → visibile dashboard
- [ ] Vocale WhatsApp → scaricato → trascritto con ElevenLabs → visibile dashboard
- [ ] Test: mandi "ciao" a WhatsApp, vedi entro 2 sec in dashboard
- [ ] Verifica webhook WhatsApp attiva con header segreto custom 360dialog, idempotenza e replay protection

---

## Settimana 4 — AI engine e calendar

### Obiettivi
- Anthropic Sonnet 4.6 (model ID Anthropic configurato via env) risponde in modo coerente
- Knowledge base caricabile (PDF, testo)
- Integrazione Google Calendar
- Flow completo: messaggio → AI → prenotazione → conferma

### Deliverable
- [ ] Esegui `03_CODEX_BACKEND_PROMPTS/05_ai_engine_anthropic.md`
- [ ] Esegui `03_CODEX_BACKEND_PROMPTS/06_calendar_booking.md`
- [ ] Test end-to-end: "Vorrei un appuntamento giovedì pomeriggio" → AI propone slot → cliente sceglie → evento creato su GCal
- [ ] Confirm message inviato automaticamente
- [ ] Log audit di ogni azione AI
- [ ] Test: vocale "vorrei prenotare giovedi pomeriggio" → transcript → AI propone slot

---

## Settimana 5 — Dashboard e billing

### Obiettivi
- Dashboard cliente completo
- Onboarding wizard self-service (<10 minuti)
- Stripe subscription attiva
- Trial 14 giorni + downgrade funzionante

### Deliverable
- [ ] Esegui `03_CODEX_BACKEND_PROMPTS/07_dashboard_cliente.md`
- [ ] Esegui `03_CODEX_BACKEND_PROMPTS/08_billing_stripe.md`
- [ ] Un utente nuovo può: registrarsi, connettere WhatsApp, caricare FAQ, attivare trial, vedere conversazioni
- [ ] Stripe checkout testato end-to-end
- [ ] Downgrade/upgrade funziona senza errori

---

## Settimana 6 — White-label e hardening

### Obiettivi
- Piano Agency funzionante
- Sicurezza hardened (pen-test base)
- Legal docs pubblicati

### Deliverable
- [ ] Esegui `03_CODEX_BACKEND_PROMPTS/10_white_label.md`
- [ ] Esegui `03_CODEX_BACKEND_PROMPTS/11_security_hardening.md`
- [ ] Privacy policy + Terms + DPA pubblicati (template in `05_LEGAL_GDPR/`)
- [ ] Pen test base: OWASP ZAP automated scan, fix dei critical
- [ ] Rate limiting attivo su tutti gli endpoint sensibili
- [ ] Cookie banner GDPR-compliant attivo

---

## Settimana 7 — Beta e lancio soft

### Obiettivi
- 3 clienti beta gratuiti attivi (In2Pilates + 2 italiani)
- Landing page live e SEO-optimized
- Prima campagna outbound partita

### Deliverable
- [ ] In2Pilates setup completo, bot risponde ai clienti Malta
- [ ] 2 dentisti/estetisti italiani setup gratuito per 2 mesi
- [ ] Landing page su dominio principale con video demo di 90 secondi
- [ ] Lista 500 cold leads italiani (dentisti + estetisti principali città)
- [ ] Primo batch 50 cold email inviate
- [ ] Primo Reel TikTok italiano pubblicato

---

## Settimana 8-12 — Crescita e iterazione

### Obiettivi mese 2-3
- 10-20 clienti paganti primi 30 giorni post-lancio
- Primi 2 deal Agency (€1.000+ MRR solo da quello)
- Iterazione prodotto sui feedback reali

### Metriche da monitorare settimanalmente
- [ ] MRR (Monthly Recurring Revenue)
- [ ] Numero clienti attivi
- [ ] Churn rate mensile
- [ ] Numero messaggi processati
- [ ] AI accuracy (% conversazioni senza escalation umana)
- [ ] CAC per canale (outbound, Reels, referral)
- [ ] NPS clienti attivi

---

## Red flags che devono fermarti

Se a 45 giorni dal lancio **NON hai**:
- ❌ Almeno 5 clienti beta felici che hanno dato feedback positivo → il prodotto non funziona, fermati e itera
- ❌ Almeno 1 deal fatto in outbound senza il tuo network → il messaggio non converte, riscrivi
- ❌ Meno del 50% dei messaggi gestiti correttamente dall'AI → il prodotto è immaturo, NON scalare ads

Se a 90 giorni dal lancio **NON hai**:
- ❌ €3.000+ MRR → problema di posizionamento o prezzo, rivedi strategia
- ❌ Almeno 1 agenzia partner → il canale B2B2B non parte, cambia approccio (verticalizza o fai outbound diretto)

**Non andare avanti a oltranza sperando che "funzioni".** Se a 90 giorni i numeri non ci sono, o pivoti con dati (cambi ICP, cambi pricing, cambi canale) o fermi e valuti se vale la pena continuare.

---

## Calendar check-in con te stesso

- **Ogni lunedì mattina:** 30 minuti di review numeri settimana precedente
- **Ogni venerdì sera:** 30 minuti di planning settimana successiva
- **Ogni 15 del mese:** review MRR + churn + roadmap prossimo mese
- **Ogni 90 giorni:** retrospettiva grande, aggiorna roadmap

Non saltare questi slot. Sono la differenza tra costruire un business e avere un side project.
