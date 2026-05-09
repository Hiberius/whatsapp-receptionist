# REGISTRO DEI TRATTAMENTI - ROPA TEMPLATE

Bozza operativa preparata da Codex il 24 aprile 2026. Serve come base per il Registro dei trattamenti ai sensi dell'art. 30 GDPR.

## 1. Ambrogio.ai come Titolare

| Trattamento | Interessati | Dati | Finalita' | Base giuridica | Conservazione | Fornitori |
| --- | --- | --- | --- | --- | --- | --- |
| Account e onboarding | Clienti, utenti dashboard | Identita', contatti, ruoli, tenant | Creare e gestire account | Contratto | Durata account + 24 mesi | Supabase, Vercel |
| Billing | Clienti | Dati fiscali, piano, fatture, stato pagamenti | Pagamenti e contabilita' | Obbligo legale/contratto | 10 anni | Stripe |
| Supporto | Clienti, prospect | Ticket, email, log, note | Assistenza e onboarding | Contratto/legittimo interesse | 24 mesi | Resend, Sentry |
| Sicurezza | Utenti dashboard | IP, log accessi, audit log, eventi | Protezione account e piattaforma | Legittimo interesse/obbligo legale | 12-24 mesi | Cloudflare, Sentry, Supabase |
| Marketing B2B | Lead, prospect, clienti | Email, nome, azienda, preferenze | Newsletter e comunicazioni commerciali | Consenso/soft spam dove ammesso | Fino a revoca | Resend, PostHog |
| Analytics prodotto | Utenti dashboard | Eventi uso, tenant id, user id pseudonimo | Miglioramento prodotto e metriche | Legittimo interesse/consenso cookie | 24 mesi | PostHog |

## 2. Ambrogio.ai come Responsabile

| Trattamento | Interessati | Dati | Finalita' | Istruzione Cliente | Conservazione default | Sub-responsabili |
| --- | --- | --- | --- | --- | --- | --- |
| Conversazioni WhatsApp/DM/chat | Utenti finali Cliente | Telefono, username, messaggi, metadati | Gestire richieste e risposte | Configurazione canali e assistente | 24 mesi configurabili | Supabase, Meta, 360dialog |
| Messaggi vocali | Utenti finali Cliente | Audio, trascrizione, lingua, durata | Trascrivere vocali e generare risposta | Toggle voice tenant | Audio 30 giorni, transcript come messaggio | ElevenLabs, Supabase |
| AI intent e risposte | Utenti finali Cliente | Prompt minimizzato, contesto conversazione | Classificare intent e generare risposta | Prompt/knowledge base Cliente | Log minimizzati | Anthropic |
| Appuntamenti | Utenti finali Cliente | Nome, contatto, data/ora, servizio, note | Prenotare e modificare appuntamenti | Config calendario/servizi | 24 mesi configurabili | Google, Supabase |
| Opt-out | Utenti finali Cliente | Telefono/user id, stato opt-out | Rispettare preferenze comunicazione | Obbligo configurato | Finche' necessario | Supabase |
| Audit e sicurezza tenant | Utenti dashboard Cliente | Eventi, ruoli, azioni admin | Tracciabilita' e sicurezza | Contratto/DPA | 24 mesi | Supabase, Sentry |

## 3. Valutazioni da completare

- [ ] Confermare se Ambrogio.ai deve nominare DPO.
- [ ] Completare Transfer Impact Assessment per USA/subprocessor extra SEE.
- [ ] Completare DPIA per clienti sanitari e voice AI.
- [ ] Documentare base giuridica consigliata per messaggi proattivi WhatsApp.
- [ ] Definire retention differenziata per settori: beauty, medicale, legale, ristorazione.

## Note operative interne

- Fatto da Codex.
- Mantenere questo file sincronizzato con schema DB e Privacy Policy.
