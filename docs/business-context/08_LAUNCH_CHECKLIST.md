# 🚀 Launch Checklist — Ambrogio.ai

## Uso

Questo è il checkpoint finale prima di dichiarare "Ambrogio.ai è live".
Da seguire nelle **4 settimane prima del launch pubblico**.

Marca ogni voce con:
- ✅ Fatto
- 🚧 In corso
- ❌ Non fatto (blocker)
- ⏭ Non applicabile fase 1

---

## 4 SETTIMANE PRIMA DEL LAUNCH

### Prodotto
- [ ] Feature set MVP definito e committed (no feature creep)
- [ ] Flow signup → onboarding → prima conversazione AI testato end-to-end
- [ ] Dashboard cliente usabile senza bisogno di tutorial
- [ ] Admin panel interno funzionante
- [ ] Error states gestiti (empty states, loading, errors)
- [ ] Mobile responsive (dashboard usabile su iPad)
- [ ] Italian language review (nessun typo, testi professionali)

### Brand
- [ ] Logo finale approvato
- [ ] Favicon
- [ ] Social banners (LinkedIn, Twitter, Instagram, TikTok)
- [ ] Color system applicato consistentemente
- [ ] Brand guidelines documento
- [ ] Email signatures templates

### Legal
- [ ] **Decisione entità legale presa** (vedi box sotto — da decidere con commercialista prima di tutto)
- [ ] Privacy policy pubblicata (IT + EN)
- [ ] Termini di servizio pubblicati (IT + EN)
- [ ] Cookie policy + banner
- [ ] DPA template pronta da firmare con clienti
- [ ] P.IVA attiva
- [ ] Registrazione al VIES (se fatturi B2B EU)
- [ ] Trademark Ambrogio.ai depositato in Italia (UIBM, €170)

> **⚠️ DECISIONE CRITICA — Entità legale (da chiarire PRIMA di tutto il resto)**
>
> Christian è attualmente basato a Malta. Non costituire una S.r.l. italiana di impulso — costa di più di quello che sembra e può essere fiscalmente inefficiente.
>
> **Opzione A — Mantieni Malta Ltd (o crea se non esiste)**
> - Malta Ltd costa ~€1.500-2.500 setup + €1.500-2.500/anno compliance
> - Tassazione effettiva: 5% (dopo rimborso 6/7) per non residenti su profitti distribuiti
> - Fatturi B2B a clienti italiani in reverse charge (IVA italiana a carico del cliente)
> - Svantaggio: fatturazione elettronica SDI NON applicabile direttamente (clienti italiani possono avere problemi di compliance)
> - Ideale per: volumi alti, clienti B2B EU tolleranti al reverse charge
>
> **Opzione B — S.r.l. semplificata Italia**
> - Costo reale: **€2.500-3.500 primo anno** (notaio €800-1.200 + visura + CCIAA + commercialista €1.500-2.500)
> - Capitale sociale minimo €1 (S.r.l.s.) ma atto notarile comunque obbligatorio
> - Tassazione: IRES 24% + IRAP ~4% + INPS gestione separata sugli amministratori
> - Fatturazione elettronica SDI nativa, clienti italiani felici
> - Ideale per: scaling solo Italia, clienti enterprise italiani
>
> **Opzione C — Estonia OÜ (e-Residency)**
> - Setup: ~€350-500 (e-Residency + OÜ digitale) + €70/mese contabilità
> - Tassazione: 0% su profitti reinvestiti, 20% solo su distribuzione
> - Fatturazione B2B EU in reverse charge
> - Ideale per: SaaS europei bootstrap, founder che resta non-residente in Estonia
> - Svantaggio: meno "familiare" per clienti italiani, banking setup complesso
>
> **Raccomandazione pratica:** prenota 1 ora con un commercialista internazionale (es. [StudioTributarioCambi](https://www.studiotributariocambi.it/) o [Sigma.Tax](https://www.sigma.tax/)) prima di costituire. Spesa: €200-400. Risparmio potenziale: migliaia di euro/anno in tasse mal strutturate.

---

## 3 SETTIMANE PRIMA

### Infrastructure
- [ ] Produzione Vercel deployata
- [ ] Supabase EU-West progetto prod configurato
- [ ] Cloudflare WAF attivo
- [ ] SSL valido su tutti i domini
- [ ] Redirect 301: `ambrogio.it` → `ambrogio.ai`
- [ ] Status page `status.ambrogio.ai` pubblica
- [ ] Monitoring Sentry attivo
- [ ] Uptime monitoring Better Stack
- [ ] Backup automatico testato

### Integrations
- [ ] Meta Business verified ✅
- [ ] 360dialog numero WhatsApp attivo
- [ ] Webhook WhatsApp funzionante (test msg end-to-end)
- [ ] ElevenLabs API key configurata per vocali WhatsApp
- [ ] Test vocale WhatsApp inbound → transcript → risposta AI
- [ ] Stripe live mode attivato
- [ ] Stripe tax settings Italia configurati
- [ ] Stripe webhook endpoint live
- [ ] Resend dominio verificato + SPF/DKIM/DMARC
- [ ] Google Calendar API funzionante
- [ ] FattureInCloud integrato per fatturazione elettronica

### Security
- [ ] Security checklist completata (vedi `security_checklist.md`)
- [ ] Tutte le voci 🚨 critiche spuntate
- [ ] Penetration test interno (OWASP Top 10)
- [ ] Secret scanning clean
- [ ] 2FA attivo per te e team
- [ ] Access list minimale per ogni servizio

---

## 2 SETTIMANE PRIMA

### Marketing & vendita
- [ ] Landing page finale pubblicata
- [ ] Video demo 2-minuti registrato (Loom)
- [ ] Sales deck Pitch.com finalizzato
- [ ] 3 case study verticali pronti
- [ ] Testimonial In2Pilates o pilota raccolto
- [ ] Blog/Resources section: 5-10 articoli SEO-ready
- [ ] SEO on-page: title, description, Open Graph su tutte le pagine
- [ ] Google Search Console setup + sitemap
- [ ] Google Analytics 4 o PostHog pubblico
- [ ] Bing Webmaster setup (non dimenticare)

### Content library
- [ ] 30 script TikTok/Reels pronti (vedi GTM folder)
- [ ] 20 email outreach templates pronti
- [ ] 15 LinkedIn templates pronti
- [ ] FAQ completa su sito
- [ ] Knowledge base interna (supporto)

### Social presence
- [ ] Account TikTok `@ambrogio.ai` live + 5 video pre-pubblicati
- [ ] Account Instagram `@ambrogio.ai` live
- [ ] LinkedIn Company Page `Ambrogio.ai`
- [ ] YouTube channel (per shorts)
- [ ] Twitter/X account (opzionale, low priority)
- [ ] 3 post su ciascun canale già pubblicati (account "caldo")

### Pilots
- [ ] In2Pilates pilota attivo + feedback raccolto
- [ ] Almeno 1 altro pilota italiano (dentista/estetista/veterinario)
- [ ] Video testimonial raccolti (anche semplici)

---

## 1 SETTIMANA PRIMA

### Technical final checks
- [ ] Load test: 100 request simultanee sostenute
- [ ] Test signup flow × 5 (da browser diversi)
- [ ] Test pagamento Stripe con card reale (€1 refund)
- [ ] Test disdetta subscription (customer portal)
- [ ] Test fattura elettronica
- [ ] Test WhatsApp webhook sotto carico
- [ ] Test vocali WhatsApp: audio chiaro, audio rumoroso, fallback transcript fallito
- [ ] Test disaster recovery (restore backup su staging)
- [ ] DNS propagation verificato globalmente
- [ ] Lighthouse score >90 mobile + desktop

### Operations
- [ ] Support email `support@ambrogio.ai` attivo
- [ ] Inbox monitorata (tu + co-founder)
- [ ] SLA risposta support definito (<4h business hours)
- [ ] Ticketing system (anche solo Gmail + label)
- [ ] Runbook issue comuni scritto
- [ ] On-call plan (tu H24 per primi 30 giorni)
- [ ] Comunicazione crisi plan (chi parla con clienti, quando)

### Go-to-market
- [ ] Lista 100 lead pronta in CRM per cold outreach giorno 1
- [ ] 5 agency partner pre-contattati
- [ ] Primo webinar schedulato (2 settimane post-launch)
- [ ] Product Hunt launch prep (opzionale ma utile)
- [ ] Indie Hackers post draft
- [ ] Communication to newsletter subscribers (se esiste)

### Team
- [ ] Christian disponibile 100% launch week
- [ ] Eventuali dev/freelance on-call
- [ ] VA/assistente virtuale pronto per support overflow (opzionale)

---

## GIORNO DEL LAUNCH

### Morning (pre-launch)
- [ ] Check uptime tutti servizi
- [ ] Check backup eseguito stanotte
- [ ] Monitor Sentry: 0 errori P0
- [ ] Smoke test signup + primo messaggio WhatsApp
- [ ] Smoke test vocale WhatsApp + transcript ElevenLabs
- [ ] Verifica Stripe webhook live
- [ ] DM team per conferma "go"

### Launch moment
- [ ] Pubblicazione post LinkedIn Christian
- [ ] Post Ambrogio.ai LinkedIn
- [ ] 3 TikTok/Reels pubblicati
- [ ] Instagram story annuncio
- [ ] Email a mailing list (se esiste)
- [ ] Cold outreach batch 1 (20 lead)
- [ ] Messaggio WhatsApp a clienti attuali (tuoi contatti)

### During day 1
- [ ] Monitor Sentry every 2 hours
- [ ] Rispondi a ogni comment social entro 30 min
- [ ] Rispondi a ogni email support entro 1h
- [ ] Cattura screenshot ogni milestone (primo signup, primo payment)
- [ ] Note qualitative su feedback ricevuto

### Evening
- [ ] Analisi metriche giorno 1:
  - Visite landing
  - Signup
  - Trial attivati
  - Conversazioni processate
  - Error rate
  - Feedback qualitativi
- [ ] Fix issue critiche emerse
- [ ] Plan giorno 2

---

## SETTIMANA 1 POST-LAUNCH

### Daily rituals
- [ ] Check Sentry 3x al giorno
- [ ] Check metriche PostHog funnel
- [ ] Rispondi support entro 4h
- [ ] Post 1 contenuto sociale/giorno
- [ ] Outreach 20 lead/giorno
- [ ] Call demo con chi ha trialled

### Weekly review (Sunday)
- [ ] MRR week 1
- [ ] Nuovi signup / trial attivati
- [ ] Churn
- [ ] Top issue support
- [ ] NPS feedback iniziale
- [ ] Plan settimana 2

---

## MESE 1 POST-LAUNCH

### Growth targets realistici
- Signup totali: 80-150
- Trial attivati: 30-50
- Paying customers: 8-15
- MRR: €800-2.500
- Churn: <5% (primi mesi tipicamente bassi)
- NPS: >40

### Attività chiave
- [ ] Minimo 4 demo/settimana
- [ ] 3-5 video TikTok/settimana
- [ ] 100 LinkedIn outreach/settimana
- [ ] Primo webinar eseguito
- [ ] 2-3 partnership agency avviate
- [ ] Primo contenuto PR (podcast, blog ospite)
- [ ] Product update #1 pubblicato

### Learning
- [ ] Intervista qualitativa 5 clienti paganti
- [ ] Intervista 5 trial non convertiti (perché?)
- [ ] Feedback prioritizzato in roadmap
- [ ] Release patch settimanale

---

## RED FLAGS DA MONITORARE

Se succede uno di questi → pausa/pivot rapido:

🚨 **Error rate >2%** → stop growth, fix prima
🚨 **Churn mese 1 >20%** → product-market fit non c'è, intervista+iterate
🚨 **Trial → paid <5%** → pricing o flow rotto
🚨 **WhatsApp API bloccata da Meta** → contingency plan, alternative BSP
🚨 **Costo variabile > ricavo** → pricing sbagliato, rivedi subito
🚨 **Data breach segnalato** → incident response immediato, notifiche legali
🚨 **Server down >30min** → incident + notifica clienti

---

## GREEN FLAGS DA CELEBRARE

Significa vai nella direzione giusta:

✨ **MRR >€2k al mese 1**
✨ **NPS >50**
✨ **Clienti ricomprano trial automatico senza interazione**
✨ **1 cliente porta 1 referral organico**
✨ **1 agency firma partnership**
✨ **1 video TikTok supera 50k views**
✨ **1 cliente chiede "posso pagare annuale?"**

---

## PAUSE & REFLECTION (dopo 60 giorni)

A 60 giorni dal launch fai una retrospettiva seria:
- Cosa ha funzionato? (raddoppia budget/tempo)
- Cosa NON ha funzionato? (taglia senza pietà)
- Quale canale porta più ROI? (focus lì)
- Quale tipo di cliente ha LTV maggiore? (ICP più stretto)
- Quali feature sono mai usate? (rimuovi per semplificare)
- Quali friction sono emerse? (roadmap next 60 giorni)

Adjust strategy basandoti su dati reali, non su ipotesi iniziali.

---

## Mindset per il launch

- **Progresso > perfezione**: se aspetti "perfetto", non lanci mai
- **Feedback > feature**: le prime 20 persone vere valgono più di 100 feature
- **Execution > idea**: chi parte primo e itera vince su chi aspetta
- **Ownership > delega**: primi 90 giorni, tu ovunque
- **Data > opinioni**: metriche cruente, non wishful thinking
- **Long game**: break-even a 6-12 mesi, €50k MRR a 18 mesi è realistico

Buon launch, Christian.
