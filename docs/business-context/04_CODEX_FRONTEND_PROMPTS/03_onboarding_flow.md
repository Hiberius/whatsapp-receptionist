# ONBOARDING FLOW - DESIGN PROMPT

Il momento piu' critico dell'esperienza cliente. Dalla registrazione al primo messaggio AI funzionante. Target: <10 minuti, <20% drop-off.

---

## STRUTTURA FLOW

7 step principali. Ogni step:
- Progress bar in alto (7 step visualizzati)
- Titolo chiaro + sottotitolo esplicativo
- Contenuto centrale
- CTA "Avanti" (primary) + "Indietro" (ghost)
- "Salva e continua dopo" sempre disponibile

---

### STEP 1 - Dati studio

Titolo: "Parliamo del tuo studio"
Subtitle: "Queste info servono all'AI per rispondere in modo coerente"

Campi:
- Nome dello studio (es. "Studio Dentistico Rossi")
- Tipo di attivita' (select):
  - Studio dentistico
  - Centro estetico
  - Clinica veterinaria
  - Palestra / Centro fitness
  - Studio fisioterapia
  - Studio legale
  - Studio commercialista
  - Altro (campo custom)
- Indirizzo (autocomplete Google Places)
- Telefono
- Email di contatto
- P.IVA (opzionale in questo step, obbligatoria a checkout)
- Sito web (opzionale)

Validation: real-time con Zod + react-hook-form.

### STEP 2 - Orari apertura

Titolo: "Quando sei aperto?"
Subtitle: "L'AI non propone appuntamenti fuori da questi orari"

Componente "WeeklySchedule":
- 7 righe giorno (Lun-Dom)
- Toggle aperto/chiuso per giorno
- Se aperto: input time from + time to (possibilita' 2 slot, es. 9-13 + 15-19 per pausa pranzo)
- Timezone pre-compilato (Europe/Rome, modificabile)
- Link "Copia da lunedi" per velocizzare

Sezione aggiuntiva:
- Durata default appuntamento (15/30/45/60 minuti)
- Buffer tra appuntamenti (0/5/10/15 minuti)

### STEP 3 - Connetti WhatsApp Business

Titolo: "Colleghiamo il tuo WhatsApp Business"
Subtitle: "Non cambia nulla per i tuoi pazienti. Il numero rimane tuo, l'AI risponde al posto tuo quando vuoi."

Due path:

**Path A - "Ho gia' WhatsApp Business verificato"**
- Input numero telefono
- Click "Connetti" apre modal con istruzioni 360dialog
- Embedded iframe 360dialog OAuth flow
- Success -> continue

**Path B - "Non ho ancora WhatsApp Business API"**
- Spiegazione semplice: serve verifica Meta Business (2-3 settimane)
- CTA "Avvia verifica ora" -> apre Meta Business verification in new tab
- "Salta per ora, configura dopo" (puoi completare setup senza WhatsApp per testare)

### STEP 3B - Vocali WhatsApp

Titolo: "Vuoi che Ambrogio capisca anche i vocali?"

Opzioni:
- Toggle ON default: "Trascrivi i vocali dei clienti" (ElevenLabs Speech-to-Text)
- Toggle OFF default: "Rispondi con note vocali" (attivabile dopo preview)
- Voice preview: ascolta 2-3 voci Ambrogio disponibili
- Nota: "Non clonare la voce del titolare senza consenso scritto."

Sotto: FAQ collapsible "E' sicuro? Posso cambiare idea? Quanto costa?"

### STEP 4 - Connetti calendario

Titolo: "Dove vuoi che l'AI salvi gli appuntamenti?"

3 option card:
- Google Calendar (consigliato, OAuth 1 click)
- Cal.com (API key)
- Calendly (API key)
- "Solo interno Ambrogio" (skip, usa il nostro calendar)

Click option -> flow connessione.

Dopo connesso: selector "Quale calendario specifico?" (utente puo' avere multipli Google Calendar).

Success: "Calendario connesso. Pronti al prossimo step!"

### STEP 5 - Carica FAQ

Titolo: "Cosa chiedono i tuoi pazienti?"
Subtitle: "L'AI imparera' a rispondere. Piu' FAQ carichi, meglio risponde."

Due sub-path:

**A - Carica manualmente**
- Widget "FAQ Builder":
  - Aggiungi FAQ: domanda + risposta
  - Almeno 5 FAQ consigliate per step 5 (ma skippabile con warning)
  - FAQ suggerite per vertical (pre-popolate):
    - Dentista: orari, prima visita, urgenze, convenzioni, pagamenti
    - Estetista: servizi, prezzi, prenotazione, preparazione trattamenti
    - Vet: orari, urgenze, vaccini, sterilizzazione
- Ogni FAQ: campo domanda + textarea risposta + categoria

**B - Upload PDF**
- Drag & drop PDF (es. "faq-studio.pdf")
- Parsing automatico con preview chunks estratti
- L'utente conferma o edita

**C - Import da sito web** (fase 2)
- Inserisci URL, scraper estrae FAQ esistenti

### STEP 6 - Test conversazione

Titolo: "Proviamo insieme"
Subtitle: "Scrivi al tuo bot come se fossi un paziente. Vedi come risponde."

Due modalita':

**A - Test via WhatsApp (se connesso)**
- QR code + istruzioni: scansiona col TUO telefono, scrivi al bot
- Live preview conversazione in dashboard
- Dopo 2-3 messaggi, "Sei soddisfatto? Avanti"

**B - Test simulato in-app** (se WhatsApp non connesso)
- Chat widget in-app dove scrivi e l'AI risponde
- Stesso behavior reale

Tips sidebar:
- "Prova a chiedere: quando siete aperti?"
- "Prova a prenotare un appuntamento"
- "Prova una domanda fuori contesto per vedere come gestisce"

### STEP 7 - Attivazione trial

Titolo: "Tutto pronto. Attiva la tua prova gratis."
Subtitle: "14 giorni gratis. Nessuna carta richiesta. Cancelli con 1 click."

Summary:
- Checkmark verdi accanto a ogni cosa completata
- "Avrai 300 conversazioni nel trial"
- "Accesso a tutte le feature del piano Professional"

CTA grande: "Attiva trial gratuita"

Sotto:
- "Oppure [salta trial e vai direttamente al piano a pagamento]"
- Mini FAQ: "Cosa succede dopo 14 giorni?" "Devo inserire la carta?" "Posso invitare il mio team?"

Dopo click: redirect a /dashboard con welcome banner.

---

## DROPOUT RECOVERY

Se utente abbandona a meta' onboarding:
- Email day 1: "Hai lasciato il setup a meta'"
- Email day 3: "Ti aiuto io a finire" (offer call)
- Email day 7: "Scadenza prossima" (se trial gia' attivato)
- Email day 14: "Ultimo promemoria"

In dashboard, se onboarding incompleto: banner rosso persistente "Completa setup" con progress bar.

---

## EMPTY STATES (prima di creare il primo elemento)

### Dashboard dopo completamento ma prima di ricevere msg
- "Nessuna conversazione ancora"
- Illustrazione (esempio: iPhone con tre puntini)
- "Manda un messaggio al tuo numero WhatsApp per testare. O condividi il tuo numero con i pazienti."
- Button: "Copia il mio numero WhatsApp"

### Nessun appuntamento
- "Calendario vuoto, per ora"
- Illustrazione
- "Appena un paziente prenotera', lo vedrai qui"

### Nessuna FAQ
- "Aggiungi la tua prima FAQ per addestrare l'AI"
- CTA inline

---

## ANIMAZIONI E MICRO-INTERACTION

- Progress bar: smooth transition on step change (400ms)
- Success checkmark: spring scale animation quando step completato
- Input validation: border color transition verde/rosso (200ms)
- Confetti animation quando completa trial (subtle, 1 sec)

---

## SHORTCUT DEVELOPERS

Prova utenti technical: link "Skip all, populate con dati demo" (solo in staging, non in production).

Da usare per:
- Demo a potenziali clienti
- Testing interno
- Codex testing

---

## PROMPT CODEX FRONTEND

Costruisci:
1. `src/app/(app)/onboarding/layout.tsx` con progress bar + stepper
2. `src/app/(app)/onboarding/[step]/page.tsx` per ogni step (dynamic route)
3. Componenti:
   - OnboardingProgressBar
   - WeeklyScheduleBuilder
   - FAQBuilder
   - TestChatWidget
   - IntegrationConnector (WhatsApp, Calendar)

Prima di iniziare, fammi vedere:
- Flow diagram dei 7 step con stati (completato/corrente/bloccato)
- Proposta di illustrazioni/icone per empty states (descrittive, cercale su undraw.co o suggerisci prompt DALL-E)
- Lista di validation rules per step
