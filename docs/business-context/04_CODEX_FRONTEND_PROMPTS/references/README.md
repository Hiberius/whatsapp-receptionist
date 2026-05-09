# References cartella — Come usarla

Qui metti i riferimenti visivi che ispireranno il design di Ambrogio.ai. Codex frontend li userà per generare un design system coerente.

## Cosa mettere qui

### 1. Screenshot di siti/app che ti piacciono (consigliato)

Fai screenshot di pagine intere (full-page screenshot) di prodotti che ritieni avere un design forte e ben fatto. Esempi di buoni reference per un SaaS B2B moderno:

- **Linear.app** — landing + app design minimalista dark/light
- **Vercel.com** — tipografia forte, uso sapiente del bianco
- **Raycast.com** — dark mode + colori accent vibranti
- **Attio.com** — CRM moderno, dashboard complessa ben organizzata
- **Stripe.com** — landing B2B enterprise-grade
- **Cal.com** — scheduling (vicino al nostro use case)
- **Supabase.com** — product page tecnica ben strutturata
- **Resend.com** — email SaaS, landing pulita

### 2. Componenti specifici

Se ti piace solo una parte di un sito (es. una pricing table, un hero specifico, una dashboard sidebar), fai screenshot mirati e nomina i file in modo chiaro:
- `linear_pricing_table.png`
- `attio_dashboard_sidebar.png`
- `stripe_hero_section.png`

### 3. Palette colori (se già decisa)

Se hai scelto colori specifici, crea un file `palette.md` con i valori HEX:
```
Primary: #0052CC
Primary dark: #003E99
Accent: #FFD166
Neutral 900: #0A0E1A
Neutral 100: #F7F9FC
Success: #10B981
Danger: #EF4444
```

### 4. Logo reference (se hai già ispirazioni)

Se hai idee su direzione logo (wordmark vs icon+word, colori, stile), mettili qui nominando chiaramente:
- `logo_direction_wordmark.png`
- `logo_direction_icon.png`

### 5. Moodboard Figma/FigJam link

Se hai un moodboard già costruito su Figma o FigJam, copia il link condivisibile in un file `moodboard_links.md`.

## Come nominare i file

Usa convention chiara:
```
[source]_[what]_[context].[ext]
```
Esempi:
- `linear_landing_hero_dark.png`
- `stripe_pricing_table_3_tiers.png`
- `vercel_dashboard_overview.png`
- `raycast_settings_panel_mobile.png`

## Come passare i reference a Codex frontend

Quando apri una conversazione con Codex frontend:

1. **Upload degli screenshot** nella chat (1-5 alla volta, non di più)
2. **Specifica il ruolo** di ogni screenshot nel prompt:
   ```
   Sto progettando la landing page di Ambrogio.ai.
   
   Reference style generale: [linear_landing_hero_dark.png]
   Reference pricing table: [stripe_pricing_table.png]
   Reference dashboard feel (per screenshot prodotto in landing): [attio_dashboard.png]
   
   Genera [quello che vuoi]...
   ```

3. **Dichiara cosa copiare e cosa evitare**:
   - "Mi piace la tipografia Linear ma preferisco colori meno desaturati"
   - "Voglio la densità informativa di Attio ma con più whitespace"

## Pacchetto design "di un sito che ti piace"

Se ricevi o acquisti un design kit/template (es. Framer template, Tailwind UI component, Figma file a pagamento):

1. Estrai i token design:
   - Colori (primary, secondary, neutrals, semantic)
   - Tipografia (font family, scale, weights)
   - Spacing scale (4px, 8px, 16px, 24px, 32px, 48px, 64px)
   - Border radius
   - Shadow system
2. Crea file `design_tokens.md` con questi valori
3. Passa a Codex frontend → aggiornerà `00_design_system.md` con i tuoi token

## Cosa NON mettere qui

- ❌ Screenshot di competitor diretti (Bookedin, Iginius, ecc.) — rischi di copiare inconsciamente, e non vogliamo. Analizzali mentalmente, non farli replicare.
- ❌ Screenshot di siti che usano pattern copyright/brand forte (Apple, Disney, banche) — design troppo caratteristico, rischi brand confusion.
- ❌ Reference che ti piacciono "esteticamente" ma non sono B2B SaaS (es. portfolio designer, siti fashion, magazine). Possono ispirare ma non sono la baseline giusta per il nostro prodotto.

## Workflow consigliato

1. **Giorno 1 (oggi):** raccogli 5-10 reference principali, dropali qui
2. **Giorno 2:** definisci palette + typography con Codex frontend
3. **Giorno 3:** genera prima iterazione design system
4. **Giorno 4-5:** iterazione landing page
5. **Settimana 2:** iterazione dashboard

Tempo totale realistico dalla raccolta reference alla dashboard funzionante: **10-14 giorni**.

