# PROMPT 07 - DASHBOARD CLIENTE

## PROMPT OPERATIVO CODEX

Costruiamo il dashboard dove i tenant gestiscono il loro ambrogio. Design moderno, chiaro, SaaS-style.

STEP 1 - Layout dashboard

Crea src/app/(app)/ con:
- layout.tsx: sidebar + topbar + main content
- Responsive: mobile first con sidebar collassabile
- Dark mode toggle (preferenza utente salvata)

Sidebar sections:
- Dashboard (overview)
- Conversazioni (elenco + ricerca)
- Appuntamenti (calendar view + lista)
- Knowledge Base (FAQ management)
- Integrazioni (WhatsApp, Calendar, etc)
- Team (se role=owner/admin)
- Impostazioni
- Fatturazione (solo owner)

STEP 2 - Overview dashboard

/dashboard/page.tsx:

Cards in grid:
- Conversazioni oggi (con % vs ieri)
- Appuntamenti prenotati oggi (con % vs media 7 giorni)
- Tasso risposta AI (% messaggi gestiti senza escalation)
- Tempo medio risposta (secondi)

Grafici:
- Line chart: conversazioni ultime 30 giorni
- Bar chart: appuntamenti per giorno settimana
- Donut: distribuzione intent (prenotazioni, info, altri)
- Heatmap: orari di picco messaggi in ingresso

Lista "ultime conversazioni" (10 piu' recenti con preview).

STEP 3 - Conversazioni view

/conversations/page.tsx:
- Lista stile WhatsApp (split view: lista a sinistra, chat aperta a destra)
- Filtri: status (active/escalated/closed), channel, data
- Search bar (full-text search su messaggi)
- Badge "AI escalated" per conversazioni in attesa intervento umano
- Click su conversazione apre dettaglio con tutti i messaggi
- Possibilita' di inviare messaggio manuale "takeover mode" (pausa AI, rispondi tu, poi riprende AI)

Componente ConversationDetail:
- Tutti i messaggi chronologically
- Ogni messaggio AI mostra: intent classificato, confidence, tokens used
- Possibilita' flag "AI ha sbagliato" per migliorare prompts

STEP 4 - Appointments view

/appointments/page.tsx:
- Toggle: calendar view / list view
- Calendar view: FullCalendar component integrato con Google Calendar
- List view: tabella ordinabile per data/cliente/status
- Filtri: status (confirmed/cancelled/completed/no_show), date range
- Quick actions: conferma, cancella, marcare come no-show
- Export CSV/Excel per periodo

STEP 5 - Knowledge base management

/knowledge/page.tsx:
- Lista FAQ/informazioni caricate
- Add new: form con title + content + category
- Upload PDF: parsing automatico con pdf-parse, estrazione testo, chunking, embedding
- Edit/delete entries
- Preview search: "digita una domanda, vedi cosa risponderebbe l AI"

STEP 6 - Integrations management

/integrations/page.tsx:
- Grid di integrazioni disponibili (WhatsApp, Google Calendar, Cal.com, Calendly, Fatture in Cloud)
- Ogni integrazione: status (connected/disconnected), last sync, connect/disconnect button
- Per WhatsApp: visualizza numero connesso, template status (approved/pending)

STEP 7 - Settings

/settings/page.tsx con tabs:
- Generale: nome studio, indirizzo, orari apertura
- Team: gestione utenti, invite, remove
- Sicurezza: password change, MFA setup, sessioni attive
- AI Config: tone of voice (formale/informale), lingue supportate, keyword emergency
- Voice Config ElevenLabs:
  - toggle "Trascrivi vocali WhatsApp"
  - toggle "Risposte vocali WhatsApp"
  - selezione voice_id
  - preview audio
  - warning consenso se si usa/clona una voce reale
- Notifiche: email/push preferences per escalation
- Privacy: export dati, cancellazione account
- Branding (solo piano Agency): logo custom, colori, domain

STEP 8 - Billing

/billing/page.tsx (solo role=owner):
- Piano attuale + utilizzo mese (conversazioni consumed / quota)
- Usage chart ultimi 6 mesi
- Fatture scaricabili PDF
- Upgrade/downgrade plan
- Cambio metodo pagamento
- Link to Stripe Customer Portal per gestione advanced

STEP 9 - Onboarding wizard

Per nuovi tenant, prima del dashboard:
- Step 1: Dati studio (nome, tipo, indirizzo)
- Step 2: Orari apertura
- Step 3: Connetti WhatsApp (QR code 360dialog)
- Step 4: Connetti Calendar
- Step 5: Upload knowledge base / FAQ
- Step 6: Test conversazione (manda messaggio al tuo bot per provare)
- Step 7: Attiva trial

Save progress: se utente chiude, riprende dove ha lasciato.

STEP 10 - Real-time updates

Usa Supabase Realtime per aggiornare dashboard live:
- Nuovo messaggio in ingresso -> appare in lista conversazioni senza reload
- Nuovo appuntamento -> counter dashboard si aggiorna
- Escalation alert -> notifica browser push + toast

Disconnessione robusta: se socket drop, mostra banner "riconnessione in corso" e retry.
