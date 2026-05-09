# 🎯 AMBROGIO.AI — PIANO OPERATIVO COMPLETO

**Progetto:** AI Receptionist WhatsApp/DM per PMI italiane (dentisti, estetisti, veterinari, palestre, studi professionali)
**Modello di riferimento:** Bookedin.ai (USA, $50k MRR, team 2 persone)
**Mercato target:** Italia + eventualmente Spagna/Francia fase 2
**Founder:** Christian Calabrò

**Versione:** 1.1 (post code review — 23 aprile 2026)

---

## 📋 CHANGELOG v1.1 (modifiche post-review)

**Cambiamenti CRITICI:**
- ✅ Model ID Anthropic da configurare via env e verificare su documentazione ufficiale secondo documentazione Anthropic aggiornata al 25 aprile 2026.
- ✅ Pricing WhatsApp 2026 aggiornato al modello per-message (dal 1 lug 2025) con free service window worldwide. Margini ricalcolati correttamente.
- ✅ **ATTENZIONE Agency**: a €597/mese con 10 numeri 360dialog il margine rischia di essere negativo. Pricing aggiornato: Agency raccomandato €897/mese con 5 clienti inclusi + extra cliente. Vedi `01_STRATEGIA/pricing.md`.
- ✅ Aggiunta sezione decisione entità legale (Malta Ltd vs S.r.l. IT vs Estonia OÜ) in `08_LAUNCH_CHECKLIST.md`

**Cambiamenti IMPORTANT:**
- ✅ Fatturazione elettronica SDI (Fatture in Cloud API) aggiunta a billing — era mancante, bloccante per B2B Italia
- ✅ ElevenLabs aggiunto come layer audio: vocali WhatsApp inbound trascritti con Speech-to-Text e risposte vocali opzionali via Text-to-Speech
- ✅ Numeri SEO "60k ricerche" marcati come "da validare" con Keyword Planner (erano stime non verificate)
- ✅ Vercel Pro chiarito come **$20/utente**/mese
- ✅ Architettura URL formalizzata + opzione `api.ambrogio.ai` per isolamento webhook
- ✅ Stripe fees uniformate a 1.5% + €0.25

**Cambiamenti MINOR:**
- ✅ Trigger.dev pricing coerente ($20/mese)
- ✅ "Stripe Italia" → "Stripe Payments Europe Ltd (Dublino)"
- ✅ Google Workspace aggiornato a €7.20/utente 2026
- ✅ Documentato processo Green Tick Meta (Notable Brand) + conformità policy AI 15 gen 2026
- ✅ References README espanso da 1 riga a guida completa per Codex frontend

---

## 🚀 COME USARE QUESTA CARTELLA

Questa cartella contiene **TUTTO** quello che ti serve per costruire il progetto da zero. Segui quest'ordine:

### Fase 0 — Preparazione (1 giorno)
1. Leggi `01_STRATEGIA/positioning.md` — capisci il posizionamento esatto
2. Leggi `01_STRATEGIA/pricing.md` — struttura prezzi
3. Leggi `02_NOMI_E_BRAND/nomi_dominio.md` — scegli nome e compra dominio OGGI
4. Apri account: GitHub (privato), Vercel, Supabase EU, Anthropic, 360dialog, Stripe

### Fase 1 — Setup tecnico (settimana 1)
5. Segui `07_INFRASTRUCTURE/tech_stack.md` per setup iniziale
6. Usa **Codex** con i prompt nella cartella `03_CODEX_BACKEND_PROMPTS/` nell'ordine numerato (00 → 11)
7. Attiva i sotto-agenti descritti in `03_CODEX_BACKEND_PROMPTS/subagents/`

### Fase 2 — Design (parallelo settimana 1-2)
8. Usa **Codex frontend** con i prompt in `04_CODEX_FRONTEND_PROMPTS/`
9. Prima scegli 1-2 siti di riferimento e salvali come screenshot in `04_CODEX_FRONTEND_PROMPTS/references/`

### Fase 3 — Sviluppo (settimane 2-6)
10. Esegui prompt Codex in ordine, uno alla volta, con controllo qualità tra uno e l'altro
11. Dopo ogni feature importante, lancia manualmente `security_auditor.md` e `gdpr_checker.md`

### Fase 4 — Legal & Compliance (settimana 6)
12. Adatta i template in `05_LEGAL_GDPR/` con i tuoi dati
13. Fai rivedere privacy policy e DPA da avvocato italiano specializzato GDPR (€300-500 una tantum)

### Fase 5 — Go-to-market (settimana 7+)
14. Esegui playbook in `06_GTM_E_VENDITA/`
15. Primi 5 clienti gratis per testimonial
16. Scala con cold outbound + Reels + partnership agenzie

---

## ⚠️ REGOLE NON NEGOZIABILI

1. **NON usare Baileys o librerie non-ufficiali WhatsApp.** Solo Meta Cloud API o BSP ufficiale (360dialog consigliato per IT).
2. **NON saltare le policy RLS su Supabase.** Ogni tabella deve averle, senza eccezioni.
3. **NON committare mai secrets nel repo.** Usa pre-commit hook gitleaks.
4. **NON processare dati sanitari senza DPA firmato** con il cliente.
5. **NON vendere a clienti finali prima che il beta con In2Pilates sia concluso positivamente.**
6. **NON dire al freelance/dev esterno l'idea completa** — spezzetta i task, ogni dev vede solo la sua parte, tutti firmano NDA.
7. **NON mettere OpenAI come fallback** se ti impegni su data residency EU (Anthropic su AWS EU region è più sicuro per GDPR).
8. **NON clonare voci reali con ElevenLabs senza consenso scritto esplicito.** Usa una voce brand Ambrogio finche' non esiste consenso.

---

## 📊 METRICHE DA TRACCIARE DAL GIORNO 1

| Metrica | Target mese 3 | Target mese 6 | Target mese 12 |
|---------|---------------|---------------|----------------|
| Clienti paganti | 10 | 40 | 150 |
| MRR | €1.500 | €6.500 | €22.000 |
| Churn mensile | <10% | <5% | <3% |
| CAC (cost acquisition) | <€100 | <€80 | <€60 |
| LTV stimato | €800 | €1.500 | €3.000 |
| NPS | >40 | >50 | >60 |

---

## 🔴 PUNTI DI ATTENZIONE TEMPORALI

- **15 gennaio 2026:** Meta ha vietato general-purpose AI su WhatsApp → il nostro positioning "AI per appuntamenti" è task-specific = OK
- **2 agosto 2026:** full enforcement EU AI Act → i nostri chatbot sono "limited risk" (richiede solo disclosure "stai parlando con AI") = OK con disclosure
- **Legge 132/2025 Italia:** nuove disposizioni AI + deepfake = irrilevante per noi ma tenere d'occhio

---

## 💼 CONTATTI UTILI DA AVERE PRONTI

- **Avvocato GDPR italiano** — per privacy/DPA (preventivo €300-500)
- **Commercialista Malta + Italia** — già hai (hai P.IVA Malta)
- **Consulente trademark** — registrazione marchio Italia (€300-500)
- **DPO esterno consulente** — se superi i 250 clienti o tratti molti dati sanitari

---

Buon lavoro. Parti dal file `01_STRATEGIA/positioning.md` ora.
