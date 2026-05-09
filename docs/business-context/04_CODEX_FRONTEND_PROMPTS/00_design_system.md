# DESIGN SYSTEM - AMBROGIO.AI

Prompt da dare a Codex frontend come PRIMA cosa, prima di qualunque singola pagina. Definisce il linguaggio visivo del prodotto.

---

## CONTESTO

Stiamo costruendo Ambrogio.ai, un SaaS B2B italiano che vende AI receptionist su WhatsApp a studi professionali (dentisti, estetisti, veterinari, palestre).

Target utente finale:
- Eta' 35-55 anni
- Non tech-savvy ma usa smartphone quotidianamente
- Non tollera design complicati o troppo "AI futurista"
- Vuole sentirsi professionale, non startupparo
- Decisione di acquisto: si', questo mi aiuta davvero

Referenze visive da tenere presenti (chiedi all'utente di fornirti screenshot):
- Stripe.com (chiarezza, SaaS premium)
- Linear.app (modernita', tipografia)
- Vercel.com (minimalismo premium)
- Attio.com (dashboard SaaS B2B pulito)

---

## BRAND IDENTITY

### Personalita' del brand
- Professionale ma umano
- Affidabile, non "tech-cold"
- Italian-friendly: diretto, chiaro, niente gergo
- Warm, non corporate freddo
- Competente, non sfacciato

### Voice & Tone
- Lingua primaria: italiano colloquiale professionale (uso "tu" nel marketing, "Lei" nel prodotto quando parla con i pazienti)
- Seconda lingua: inglese pulito per fase 2
- Evita: gergo tech pesante, buzzword AI, superlativi vuoti ("rivoluzionario", "game-changer")
- Usa: verbi concreti, esempi reali, numeri specifici
- Regola naming: Ambrogio.ai e' il brand/prodotto; "Ambrogio" puo' essere trattato come assistente digitale. Non scrivere "il tuo ambrogio" o "ambrogio automatico": suona innaturale. Usa "Ambrogio risponde", "la tua segreteria AI", "receptionist AI", "assistente WhatsApp".

Esempi:
- ✅ "Prenota appuntamenti anche di notte"
- ✅ "Ambrogio risponde ai WhatsApp del tuo studio anche quando sei chiuso"
- ✅ "La tua segreteria risponde solo in orario. Ambrogio risponde sempre"
- ❌ "Leverage AI per enterprise scalability"
- ❌ "Il tuo ambrogio non dorme mai"

---

## COLORI

### Palette primaria

Primary (azione, CTA, accenti):
- Nome: "Prenotazione Blue"
- Hex: #2563EB (blu Tailwind 600)
- Variante scura: #1D4ED8 (blu 700)
- Variante chiara: #DBEAFE (blu 100, backgrounds)

Giustificazione: blu trasmette affidabilita', usato universalmente in medicale e booking (Calendly blue). Non azzurro troppo tech, non verde troppo generico.

Accent (highlight, badge, success):
- Nome: "Verde Conferma"  
- Hex: #10B981 (emerald 500)
- Uso: conferme prenotazione, success states

Error / Warning:
- Error: #EF4444 (red 500)
- Warning: #F59E0B (amber 500)

### Neutrali

Background:
- Bianco puro: #FFFFFF (light mode main)
- Grigio freddo chiarissimo: #F9FAFB (sections alternate)
- Bordo sottile: #E5E7EB
- Bordo medio: #D1D5DB

Testo:
- Primary text: #111827 (near-black, alta readability)
- Secondary text: #6B7280 (grigio medio)
- Tertiary text: #9CA3AF (grigio chiaro)
- Text on dark: #F9FAFB

### Dark mode

Background:
- Main: #0B0F19 (quasi nero con leggera tinta blu)
- Card: #1A1F2E
- Elevated: #252B3D

Testo:
- Primary: #F9FAFB
- Secondary: #9CA3AF
- Tertiary: #6B7280

### Gradient (sparingly)

Hero accent:
- linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)
- Uso: solo hero landing page, email header, badge "Agency"

---

## TIPOGRAFIA

### Font principale
- **Inter** (Google Fonts) per UI e testo
- Pesi da caricare: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- Motivo: massima readability digitale, ottima per italiano, gratis

### Font accento (opzionale)
- **Instrument Serif** per headline hero landing page
- Uso limitato: max 1 headline per pagina, mai in app

### Scale tipografica

Desktop:
- Display (hero): 60px / 72px leading / -0.02em tracking / 700 weight
- H1: 48px / 56px / -0.02em / 700
- H2: 36px / 44px / -0.01em / 700
- H3: 28px / 36px / -0.005em / 600
- H4: 22px / 32px / 0 / 600
- Body large: 18px / 28px / 0 / 400
- Body: 16px / 24px / 0 / 400
- Body small: 14px / 20px / 0 / 400
- Caption: 12px / 16px / 0.02em / 500

Mobile (< 640px):
- Display: 40px / 48px
- H1: 32px / 40px
- H2: 28px / 36px
- Altri: stessa scala desktop

---

## SPACING

Scale basata su 4px:
- 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px, 80px, 96px, 128px

Uso:
- Padding componenti piccoli: 8-16px
- Padding card: 24-32px
- Padding sezioni: 64-96px desktop, 40-64px mobile
- Gap tra elementi inline: 8-12px
- Gap tra sezioni stacked: 24-48px

---

## BORDER RADIUS

- Sharp (0px): mai, poco moderno
- Subtle (4px): input fields, small badge
- Standard (8px): button, small card
- Medium (12px): card principale
- Large (16px): hero card, featured
- Full (9999px): avatar, badge pill

Coerenza: tutta la UI deve condividere lo stesso "linguaggio di curvatura". Non mixare 4px qui e 16px la' senza logica.

---

## ELEVAZIONI (SHADOW)

Shadow subtle (card hover):
- 0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)

Shadow medium (dropdown, popover):
- 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)

Shadow elevated (modal, dialog):
- 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)

Shadow dramatic (hero element, sparingly):
- 0 40px 80px -20px rgba(37, 99, 235, 0.25)

Dark mode: invece di shadows, usa border semi-transparent e elevated background.

---

## ICONE

- **Lucide Icons** (gia' installato con shadcn/ui)
- Stroke width: 1.5 (default) o 2 (per piccole dimensioni)
- Size: 16px (inline text), 20px (button), 24px (headline), 32px+ (feature card)
- Colore: match al testo circostante, mai colore random
- Nessuna icona emoji in UI strutturata (ok solo in WhatsApp context)

---

## COMPONENTI (shadcn/ui customization)

### Button
- Primary: bg primary, text white, hover bg primary-dark
- Secondary: bg transparent, border neutral, hover bg neutral-50
- Destructive: bg error-500, text white
- Ghost: bg transparent, hover bg neutral-50
- Link: text primary, underline on hover

Sizes: sm (32px), default (40px), lg (48px), xl (56px hero CTA)

### Input
- Border 1px neutral-200
- Radius 8px
- Focus: border primary, ring primary/20 2px
- Error state: border error-500
- Placeholder: neutral-400
- Altezza: 40px standard, 48px per form principali

### Card
- Background: bianco (o card dark mode)
- Border: 1px neutral-100
- Radius: 12px
- Padding: 24px default, 32px su card principali
- Shadow: subtle on hover only

### Table
- Zebra stripes molto sottili (bg-neutral-50 su righe pari)
- Header: font-medium, text-neutral-600, border-bottom-2
- Row hover: bg-neutral-50
- Dense mode per dashboard dati-pesanti

### Navigation
- Sidebar: 260px desktop, collapsible to 64px
- Topbar: 64px altezza, bg bianco con border bottom
- Mobile: bottom nav su device < 768px

---

## ANIMAZIONI

Durate:
- Micro (hover, focus): 150ms
- Short (dropdown open): 200ms
- Medium (modal appear): 300ms
- Long (page transition): 400ms

Easing:
- Default: cubic-bezier(0.4, 0, 0.2, 1) (ease-out)
- Entrance: cubic-bezier(0, 0, 0.2, 1)
- Exit: cubic-bezier(0.4, 0, 1, 1)
- Bouncy (sparingly): cubic-bezier(0.68, -0.55, 0.265, 1.55)

Principi:
- Animazioni servono a comunicare, non a decorare
- Niente micro-interactions su ogni elemento (fatica cognitiva)
- Movimento suggerisce causalita' (click -> modal scale up da point click)
- Respect prefers-reduced-motion

---

## LAYOUT

### Container widths
- Content max-width: 1280px (desktop)
- Narrow content (form, articoli): 720px
- Dashboard: full width con sidebar

### Grid
- 12 column grid desktop
- 6 column tablet
- 4 column mobile
- Gutter: 24px desktop, 16px mobile

### Breakpoints (Tailwind default)
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px
- 2xl: 1536px

---

## PRINCIPI DI DESIGN

1. **Chiarezza > bellezza.** Se una scelta e' piu' bella ma meno chiara, va scartata.
2. **Progressive disclosure.** Mostra solo cio' che serve adesso. Avanzato = hidden dietro "Opzioni avanzate".
3. **No placeholder abusivo.** I label sopra i campi, i placeholder solo per esempio.
4. **Densita' appropriata.** Landing = respiro (spacing ampio). Dashboard = densita' (spacing stretto).
5. **Italiano first.** Ogni testo pensato in italiano, poi tradotto. Stringhe variabili lingua gestite con dictionary file.
6. **Accessibilita' non negoziabile.** WCAG AA minimo: contrast ratio 4.5:1 per testo, focus visible, keyboard nav.
7. **Performance matters.** Ogni asset ottimizzato, animazioni GPU-accelerated, no libraries da 1MB per 1 componente.

---

## OUTPUT ATTESO

Quando chiedo una pagina o componente:
1. Usa SEMPRE questo design system
2. Se devi deviare, spiega perche' prima di farlo
3. Fornisci codice JSX/TSX pronto da incollare (Next.js + Tailwind + shadcn)
4. Se richiedi immagini, specifica dimensioni e suggerisci fonti (Unsplash query specifiche)
5. Se serve illustrazione, suggerisci stile e fornisci prompt per DALL-E/Midjourney
