# DASHBOARD LAYOUT - DESIGN PROMPT

Prompt per Codex frontend per costruire il layout del dashboard cliente. Questa e' la UI che il cliente vede ogni giorno dopo login.

---

## PRINCIPI GUIDA

- Densita' informazione alta ma non sovraccarica
- Azioni primarie sempre a portata di click
- Stato del sistema sempre chiaro (bot attivo? quanti msg oggi?)
- Mobile-responsive ma desktop-first (il 70% dell'uso sara' da desktop)

---

## STRUTTURA

### LAYOUT GENERALE

Desktop (>= 1024px):
```
+------+-------------------------------+
|      |  Topbar (64px)                |
|      +-------------------------------+
| Side |                               |
| bar  |  Main content area            |
| 260px|  (scrollable)                 |
|      |                               |
|      |                               |
+------+-------------------------------+
```

Mobile (< 1024px):
```
+-----------------------------------------+
| Topbar (hamburger + logo + avatar) 56px |
+-----------------------------------------+
|                                         |
| Main content                            |
|                                         |
+-----------------------------------------+
| Bottom nav (4 voci max) 64px            |
+-----------------------------------------+
```

### SIDEBAR (desktop)

Width: 260px fissa, collapsible a 64px (icon only)

Top section:
- Logo Ambrogio.ai (click -> /dashboard)
- Selector tenant (per utenti multi-tenant, es. agenzie):
  - Avatar + nome tenant corrente + chevron
  - Click apre dropdown con lista tenants + "Aggiungi cliente"

Navigation (section titles + items):
- **OPERATIVITA'**
  - Dashboard (icon: layout-dashboard)
  - Conversazioni (icon: message-circle, badge numerico per escalation)
  - Appuntamenti (icon: calendar)
- **CONFIGURAZIONE**
  - Knowledge Base (icon: book-open)
  - Integrazioni (icon: plug)
  - Orari & Servizi (icon: clock)
- **TEAM** (solo owner/admin)
  - Utenti (icon: users)
- **ACCOUNT**
  - Impostazioni (icon: settings)
  - Fatturazione (icon: credit-card) - solo owner

Bottom section:
- Status card: "Bot attivo" con pulsante pause (o "Bot in pausa" con resume)
- Utilizzo mese: progress bar "347 / 1.500 conversazioni"
- Avatar utente + dropdown (profilo, logout)

### TOPBAR

Desktop (64px):
- Left: Breadcrumb (Dashboard > Conversazioni > Chat #1234)
- Center: Search bar globale (cmd+K shortcut)
- Right: 
  - Notifications bell (badge numero non lette)
  - Help button (icon: life-buoy, apre help widget)
  - Quick create (+) button -> dropdown (nuova FAQ, nuovo appuntamento manuale, invita utente)

Mobile (56px):
- Left: Hamburger
- Center: Logo compact
- Right: Avatar

### BOTTOM NAV (mobile)

4 voci:
- Dashboard
- Conversazioni
- Appuntamenti
- Menu (apre sheet con tutto il resto)

---

## PAGINE PRINCIPALI

### /dashboard

Hero stats (4 card in grid):
1. "Conversazioni oggi": 47 / +12% vs ieri
2. "Appuntamenti prenotati oggi": 8 / +25% vs media 7gg
3. "Tasso risposta AI": 94% / -1% vs settimana scorsa
4. "Tempo medio risposta": 2.3s / stabile

Ogni card:
- Icona in cerchio colorato (bg leggero)
- Label sopra
- Numero grande (32-40px)
- Variazione in verde/rosso con arrow
- Click apre view dettaglio

Sotto le 4 card:

Row 1 (split 66/33):
- Left: Line chart "Conversazioni ultimi 30 giorni" (Recharts)
- Right: Donut chart "Distribuzione intent" (prenotazione, info, altri)

Row 2 (split 50/50):
- Left: "Ultime 10 conversazioni" (lista compatta, avatar + preview + timestamp)
- Right: "Appuntamenti oggi" (lista ordinata per ora)

Row 3:
- Alert/Insight card: "Hai 3 conversazioni in escalation da gestire" con CTA

### /conversations

Split view desktop:

Left panel (320px):
- Search bar in alto
- Filtri: All, Active (default), Escalated (badge), Closed
- Lista conversazioni:
  - Avatar (generated da hash del numero)
  - Nome cliente (o numero se non identificato)
  - Preview ultimo messaggio (1 riga)
  - Timestamp (relative: "5 min fa")
  - Unread dot + counter se non letto
- Lazy load su scroll

Right panel (remaining):
- Header: avatar + nome + numero + status badge + actions (pause AI, close, mark spam)
- Chat view: bubble style WhatsApp-like
  - Bubble AI: bianca con bordo sottile, left-aligned
  - Bubble cliente: verde chiaro #DCF8C6 o primary-50, right-aligned
  - Timestamp sotto messaggio
  - Badge "AI" su risposte AI
  - Icona escalation se messaggio ha triggered escalation
- Scroll infinito
- Input bottom: "Rispondi manualmente (AI in pausa)" - textarea + send button

Mobile: lista full screen, click apre dettaglio full screen (back button top left).

### /appointments

Toggle top: Calendar / List

**Calendar view:**
- FullCalendar wrapper
- View: month, week, day
- Eventi colorati per status (verde confermato, giallo tentativo, rosso cancellato)
- Click evento: drawer da destra con dettagli + azioni

**List view:**
- Tabella con colonne: Data, Ora, Paziente, Servizio, Status, Azioni
- Ordinamento per colonna
- Filtri: date range, status, servizio
- Bulk actions: conferma multipli, cancella multipli, esporta CSV
- Sticky header on scroll

### /knowledge

Layout a 2 colonne:

Left (280px): Lista categorie
- "Tutte le FAQ" (default)
- Orari e apertura
- Servizi e prezzi
- Come raggiungerci
- Procedure specifiche
- + Aggiungi categoria

Right: Lista FAQ
- Toolbar: Search, Filter, Sort, Bulk actions, "Aggiungi FAQ" primary button
- Card per ogni FAQ:
  - Title (clickable, apre modal edit)
  - Preview content (3 righe max, "..." se tronca)
  - Category tag
  - Last updated
  - Hamburger menu (edit, duplicate, delete)
- Import from PDF button (che triggera upload + parsing)

Modal "Aggiungi FAQ":
- Title input
- Content rich text editor (Tiptap o simile)
- Category select (con inline create)
- "Test this FAQ" button che mostra cosa risponderebbe l'AI

### /integrations

Grid 3 colonne (su desktop) di card integrazioni:

Ogni card:
- Logo integrazione (grande)
- Nome
- Descrizione 1 frase
- Status badge: Connected (verde) / Not connected (grigio) / Error (rosso)
- Last sync info (se connected)
- CTA: "Connetti" o "Gestisci"

Integrazioni v1:
- WhatsApp Business (360dialog)
- Google Calendar
- Cal.com
- Calendly
- Fatture in Cloud (fatturazione)

v2 (coming soon):
- Instagram DM
- Slack notifications
- HubSpot
- Zapier

### /settings

Layout tabs in sidebar interna (secondaria):
- Generale: dati studio, logo, orari apertura, timezone
- Team: lista utenti + invite + remove + role change
- Sicurezza: password, MFA, sessioni attive, API keys
- AI Config: tone of voice slider (formale <-> informale), lingue supportate, keyword emergency personalizzabili
- Voice Config: toggle "Trascrivi vocali WhatsApp", toggle "Risposte vocali", voice picker ElevenLabs, preview audio, disclaimer consenso voce
- Notifiche: matrix di eventi x canali (email/push/slack)
- Privacy: export dati GDPR, retention settings, cancellazione account (con countdown)
- Branding (piano Agency): logo, colori, domain custom

### /billing (solo owner)

Sections:
- Current plan card: piano attuale + prezzo + prossimo rinnovo
- Usage: grafico utilizzo mensile + quota
- Payment method: last 4 carta + "Cambia metodo" (apre Stripe Portal)
- Invoices: tabella con download PDF
- Plan change: upgrade/downgrade buttons

---

## COMPONENTI REUSABLE

1. **StatsCard** - usata in dashboard overview
2. **ConversationListItem** - singolo item lista chat
3. **MessageBubble** - messaggio chat (AI/human/customer variants)
4. **AppointmentCard** - card appuntamento (list o calendar)
5. **FAQCard** - card knowledge base
6. **IntegrationCard** - card provider integrazione
7. **UsageProgressBar** - progress bar con label
8. **StatusBadge** - badge colorato per status
9. **EmptyState** - when no data (illustrazione + CTA)
10. **LoadingSkeleton** - skeleton state per async content

---

## STATI UI

Per OGNI pagina, gestisci esplicitamente:
- Loading state (skeleton UI, non spinner)
- Empty state (illustrazione + testo + CTA)
- Error state (messaggio + retry + support link)
- Success state (toast o inline confirm)

---

## SHORTCUT TASTIERA (power users)

- Cmd/Ctrl + K: search globale
- G poi C: vai a Conversazioni
- G poi A: vai a Appuntamenti
- G poi D: vai a Dashboard
- N: nuovo (context-dependent)
- ?: mostra tutti gli shortcut (modal help)

---

## PROMPT FINALE CODEX FRONTEND

Usando design system in 00_design_system.md, costruisci:

1. `src/app/(app)/layout.tsx` con sidebar + topbar
2. Tutti i page.tsx per le route sopra
3. Componenti in `src/components/dashboard/`
4. Mobile responsive con bottom nav
5. Tema chiaro + scuro (CSS variables)

Prima di iniziare mostrami:
- Wireframe ASCII del layout principale
- Lista componenti shadcn da installare in piu'
- Dubbi o scelte ambigue su cui vuoi conferma
