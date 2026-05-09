# LANDING PAGE - DESIGN PROMPT

Prompt per Codex frontend per costruire la landing page che converte.

---

## CONTESTO

Questa landing deve convertire visitatori freddi (da cold outbound, Reels, Google Ads) in trial signup. Target: studi professionali italiani.

Goal primario: 5-8% visitor -> trial signup
Goal secondario: 15% visitor -> demo video play
Goal terziario: 30% visitor -> scroll oltre hero (qualifica intent)

---

## STRUTTURA PAGINA

### 1. NAVBAR (sticky, 64px)
- Logo a sinistra (ambrogio.ai, wordmark + icon)
- Link centro: Come funziona, Prezzi, Per Agenzie, Blog
- CTA destra: "Accedi" (ghost) + "Prova gratis" (primary)
- Su mobile: hamburger + sheet

### 2. HERO (sopra la piega)
Layout: split 60/40 (testo a sinistra, mockup a destra)

Testo sinistra:
- Micro-copy sopra titolo: "Per studi professionali italiani" (bg-blue-50 px-3 py-1 rounded-full text-xs font-medium text-blue-700)
- **Headline**: "La tua segreteria risponde solo in orario. Ambrogio risponde sempre."
  - 60px su desktop, font Inter 700
  - La parola "sempre" in gradient blu->viola
- **Subtitle**: "Ambrogio prenota appuntamenti, ascolta anche i vocali WhatsApp, risponde alle domande frequenti e passa i casi delicati al tuo team. In italiano, senza cambiare il tuo modo di lavorare."
  - 18px, text-neutral-600
- **CTA primario**: Button xl "Prova gratis 14 giorni" (+ arrow icon)
- **CTA secondario**: Link "Guarda una conversazione reale" con play icon
- **Trust bar sotto CTA**: 
  - "Senza carta richiesta" + check
  - "Setup in 10 minuti" + clock
  - "DPA e privacy-first" + shield
- **Social proof inline**: "Stiamo aprendo i primi 20 studi pilota in Italia" + micro badge "Beta selezionata"

Destra (mockup hero):
- Mockup iPhone che mostra conversazione WhatsApp reale:
  - Cliente: "Buongiorno, vorrei prenotare una pulizia dentale"
  - AI: "Buongiorno! Sono Ambrogio, l'assistente AI dello Studio Rossi. Le propongo questi slot per la pulizia: Mercoledi 15 alle 10:30, Giovedi 16 alle 16, Venerdi 17 alle 9. Quale preferisce?"
  - Cliente: "Mercoledi 10:30 grazie"
  - AI: "Perfetto, prenotato. Le ho inviato la conferma. A mercoledi!"
- Piccole "etichette animate" ai lati che mostrano: "Risposta in 3 secondi", "Prenotato su Google Calendar", "Notifica al titolare inviata"

### 3. DEMO INTERATTIVA WHATSAPP (prima del video)

Titolo: "Prova Ambrogio in 20 secondi"
Sottotitolo: "Scegli una richiesta tipica e guarda come risponde a un paziente."

Layout:
- Sinistra: mockup chat WhatsApp.
- Destra: 3 pulsanti/scenari cliccabili:
  1. "Vorrei prenotare una pulizia"
  2. "Quanto costa una prima visita?"
  3. "Devo spostare l'appuntamento"
  4. "Invio un vocale" (mostra onda audio, transcript e risposta)
- Al click, la chat aggiorna i messaggi con una micro-animazione.
- Non usare AI live in questa demo: sono conversazioni statiche curate per conversione e performance.

Messaggi esempio:
- Prenotazione: Ambrogio propone 3 slot e conferma quello scelto.
- Info prezzo: Ambrogio risponde con range/prezzo se presente e invita a prenotare.
- Spostamento: Ambrogio verifica identita' e propone nuovi slot.
- Vocale: Ambrogio trascrive il messaggio con ElevenLabs, capisce la richiesta e risponde in testo o nota vocale se abilitata.

### 4. PRIMA / DOPO

Titolo: "Prima perdevi richieste. Ora le trasformi in appuntamenti."

Due colonne:
- **Prima**
  - WhatsApp letti la sera tardi
  - Segreteria interrotta continuamente
  - Appuntamenti presi a mano
  - Pazienti che aspettano ore per una risposta
  - No-show gestiti senza promemoria
- **Dopo Ambrogio**
- Risposta immediata 24/7
- Vocali WhatsApp trascritti automaticamente
- Prenotazioni automatiche sul calendario
  - FAQ gestite senza disturbare il team
  - Escalation umana solo sui casi delicati
  - Reminder automatici prima dell'appuntamento

### 5. "COME FUNZIONA" (3 step orizzontali)

Titolo sezione: "Come funziona (spoiler: e' facile)"

3 card orizzontali:

**Step 1 - Connetti**
- Icona: WhatsApp logo
- Titolo: "Connetti il tuo WhatsApp Business"
- Testo: "2 minuti. Colleghi il numero che gia' usi, nulla cambia per i tuoi pazienti."

**Step 2 - Configura**
- Icona: cog
- Titolo: "Carica le tue FAQ e orari"
- Testo: "Gli rispondi una volta alle domande frequenti, lui impara e risponde al posto tuo."

**Step 3 - Lavora meno**
- Icona: sparkles
- Titolo: "Tu dormi, lui prenota"
- Testo: "Ogni notte ti svegli con appuntamenti gia' fissati. Prenotazioni anche di sabato e Pasqua."

### 6. DEMO VIDEO (sezione video embed)

Titolo: "Guarda Ambrogio.ai in azione (90 secondi)"
Sottotitolo: "Una conversazione vera tra un paziente e il bot di uno studio dentistico in Milano"
Video placeholder con play button grande
Sotto video: "Vuoi vederlo funzionare col TUO studio? [Richiedi demo personalizzata]" (link text)

### 7. BENEFICI (3x2 grid)

Titolo: "Cosa succede quando Ambrogio risponde al posto tuo"

6 card:
1. **+40% appuntamenti fuori orario** — Il 35% dei tuoi pazienti ti scrive dopo le 18. Oggi non rispondi. Da domani si.
2. **-80% stress per la tua segretaria** — Lei gestisce i casi importanti, il bot fa il resto. Meno errori, meno stress.
3. **Zero doppie prenotazioni** — L'AI vede il calendario in tempo reale. Mai piu' due pazienti nello stesso slot.
4. **Promemoria automatici** — -50% no-show. Il bot manda reminder 24h e 1h prima.
5. **Risposta in 3 secondi** — I pazienti non scappano dal concorrente che risponde subito.
6. **Capisce anche i vocali** — Il paziente puo' parlare come fa gia' su WhatsApp. Ambrogio trascrive, capisce e risponde.

### 8. VERTICALI

Titolo: "Pensato per studi veri, non per chatbot generici"
Sottotitolo: "Ogni settore ha richieste diverse. Ambrogio parte da esempi concreti."

5 card o tabs:
- **Dentisti**: igiene, prime visite, urgenze, no-show, richiami.
- **Estetiste**: trattamenti, pacchetti, ritocchi, disponibilita' serali.
- **Veterinari**: visite, vaccini, urgenze, richiami periodici.
- **Palestre e pilates**: prove gratuite, classi, abbonamenti, recuperi.
- **Studi professionali**: consulenze, appuntamenti, documenti necessari.

Ogni card deve mostrare:
- 1 richiesta WhatsApp reale del cliente finale.
- 1 risposta breve di Ambrogio.
- 1 outcome: "appuntamento prenotato", "caso passato al team", "info inviata".

### 9. TRUST / COMPLIANCE BAND

Titolo: "AI utile, ma con confini chiari"

Badge/check:
- Dati in Europa
- WhatsApp Business ufficiale
- ElevenLabs per vocali realistici e trascrizioni accurate
- GDPR-ready
- Escalation umana sui casi delicati
- Nessun consiglio medico automatico
- Log e audit per azioni importanti

Copy breve: "Ambrogio aiuta con prenotazioni e informazioni operative. Quando la richiesta e' clinica, urgente o incerta, passa al tuo team."

### 10. ROI CALCULATOR

Titolo: "Quanto ti costa non rispondere?"
Sottotitolo: "Un calcolo semplice per capire se Ambrogio si ripaga."

Input/slider:
- Messaggi WhatsApp ricevuti al giorno
- Percentuale fuori orario
- Valore medio di un appuntamento
- Percentuale richieste che diventano appuntamenti

Output:
- Richieste fuori orario/mese
- Appuntamenti potenzialmente recuperati/mese
- Valore stimato recuperato/mese
- Nota: "Stima indicativa, non promessa di risultato."

### 11. TESTIMONIANZE (carousel)

3-5 testimonial reali (quando li avrai):
- Foto titolare studio (real, non stock)
- Nome + titolo ("Dr. Luigi Rossi, Studio Dentistico Rossi - Milano")
- Quote 2-3 frasi
- Metric concreta: "+32 appuntamenti/mese dopo 2 mesi"

### 12. PRICING (tabella 3 colonne)

Titolo: "Prezzi semplici. Cancelli quando vuoi."

Toggle Mensile / Annuale (risparmia 2 mesi)

3 colonne pubbliche raccomandate (Starter €149, Professional €299 featured, Agency €897):
- Vedi 01_STRATEGIA/pricing.md per feature details
- Featured card (Professional) con border gradient + badge "Piu' scelto"
- Ogni card: titolo + prezzo + "per chi e'" + lista feature con check + CTA
- Sotto tabella: "Tutti i piani includono 14 giorni prova gratis. Senza carta."
- Nota piccola: "Costi WhatsApp/provider inclusi entro soglie di fair use o addebitati secondo piano."

### 13. FAQ (accordion)

Domande reali:
- E' legale usare l'AI per rispondere ai pazienti?
- Cosa succede se l'AI non sa rispondere?
- Serve cambiare il numero WhatsApp?
- I miei dati sono al sicuro?
- Posso personalizzare il tono delle risposte?
- Funziona anche per cliniche con piu' medici?
- Come gestite la privacy dei pazienti?
- Quanto costa davvero? Ci sono costi nascosti?
- Se non funziona, posso cancellare?
- Ambrogio puo' dare consigli medici?
- Cosa succede se un paziente scrive per un'urgenza?
- Ambrogio capisce anche i messaggi vocali?
- Posso scegliere se Ambrogio risponde con testo o con vocale?

### 14. CTA FINALE

Background gradient blu->viola
- Headline centrato: "Pronto a non perdere piu' appuntamenti?"
- Subtitle: "Setup in 10 minuti. 14 giorni gratis. Nessuna carta richiesta."
- CTA xl bianco: "Inizia ora gratis"
- Sotto: "Domande? [scrivici su WhatsApp]" con icon

### 15. FOOTER

- 4 colonne: Prodotto (link), Risorse (blog, docs), Azienda (chi siamo, careers), Legal (privacy, terms, dpa, cookie)
- Riga bottom: logo + copyright + social + selector lingua (IT/EN)
- Iscrizione newsletter piccola

---

## REQUISITI TECNICI

- Next.js App Router, TSX files in src/app/(marketing)/
- Tutte le immagini via next/image
- Hero image lazy = false (LCP critical)
- Viewport meta configurato
- Open Graph + Twitter Card meta
- JSON-LD Schema.org (Organization, Product)
- Performance target: LCP < 2s, CLS < 0.1, INP < 200ms
- Lighthouse score: 95+ su tutte le categorie

## SEO

- Titolo tag: "Ambrogio.ai | Il receptionist AI che prenota appuntamenti su WhatsApp"
- Meta description: "L'AI receptionist per studi italiani. Prenota appuntamenti su WhatsApp anche di notte. Setup in 10 minuti. Prova 14 giorni gratis."
- Keyword target h1-h2: "receptionist AI", "segreteria AI", "prenotazione appuntamenti whatsapp", "AI per studio dentistico", "receptionist virtuale italiano"
- Breadcrumbs schema
- URL puliti: /prezzi, /come-funziona, /per-agenzie

## RESPONSIVE

- Mobile-first (design prima il mobile, espandi al desktop)
- Breakpoints: 640, 768, 1024, 1280
- Su mobile: hero stack (testo sopra, mockup sotto), CTA full width
- Pricing su mobile: carousel invece di 3 colonne

## ANIMAZIONI (minimali)

- Hero: fade-in + subtle slide-up (300ms)
- Scroll-triggered: sezioni entrano con opacity 0->1 + translateY 20->0
- Mockup WhatsApp: messaggi che appaiono uno alla volta (typewriter/fade) - puo' essere GIF video invece
- CTA hover: scale 1.02 + shadow enhanced

---

## ASSET MANCANTI DA PROCURARE

- Logo Ambrogio.ai (fare con Figma o Midjourney)
- Mockup iPhone per hero (Figma community free template + custom content)
- Foto reali testimonial (fase 2, dopo primi clienti)
- Video demo 90 secondi (registrare con Loom + editing CapCut/DaVinci)

---

## PROMPT FINALE CODEX FRONTEND

Data la struttura sopra e il design system in 00_design_system.md, costruisci:

1. File src/app/(marketing)/page.tsx (landing homepage)
2. Componenti riutilizzabili in src/components/marketing/:
   - Hero.tsx
   - InteractiveWhatsAppDemo.tsx (include scenario vocale con transcript)
   - BeforeAfter.tsx
   - HowItWorks.tsx
   - BenefitsGrid.tsx
   - VerticalUseCases.tsx
   - TrustCompliance.tsx
   - ROICalculator.tsx
   - PricingTable.tsx
   - FAQAccordion.tsx
   - FinalCTA.tsx
   - MarketingFooter.tsx
3. File src/app/layout.tsx con metadata OG
4. File src/app/(marketing)/prezzi/page.tsx (pagina prezzi standalone)
5. File src/app/(marketing)/per-agenzie/page.tsx (landing agenzie)

Usa esclusivamente:
- Tailwind CSS per styling
- shadcn/ui per componenti base (Button, Card, Accordion)
- Lucide Icons
- Rispetta design system 00

Prima di iniziare, mostrami:
- Wireframe testuale di ogni sezione (per conferma)
- Scelta dei componenti shadcn che userai
- Suggerimenti di immagini da cercare su Unsplash (con query specifiche)
