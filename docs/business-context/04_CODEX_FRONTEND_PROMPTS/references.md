# REFERENCES - COME USARE I SITI DI RIFERIMENTO

Hai detto che vuoi usare un pacchetto di design di siti che ti piacciono. Ecco come gestirlo correttamente.

---

## WORKFLOW CONSIGLIATO

### Step 1 - Raccogli referenze

Prima di iniziare qualsiasi lavoro con Codex frontend:

1. Scegli 3-5 siti che ami per il prodotto
2. Per ogni sito, salva screenshot di:
   - Hero / landing page (full page)
   - Feature section
   - Pricing section
   - Dashboard (se accessibile)
   - Componenti specifici che ti piacciono
3. Salva tutti gli screenshot in questa cartella: `/references/`
4. Rinomina con schema chiaro: `stripe_hero.png`, `linear_pricing.png`, `attio_dashboard.png`

### Step 2 - Annota

Per OGNI screenshot, crea un file markdown accanto:

```markdown
# stripe_hero.png - NOTE

## Cosa mi piace
- Tipografia display grande e confident
- Spacing molto ampio (respira)
- Gradient sottile dietro headline
- CTA primario ben evidenziato ma non aggressivo
- Social proof inline senza essere invasivo

## Cosa NON voglio copiare
- Lo stile "developer-first" (non e' il nostro target)
- Menu navigation troppo denso
- Colori blu corporate (noi vogliamo piu' caldo)

## Elementi da ispirare
- Tipografia hero: adotta
- Spacing verticale: adotta
- Pattern "label badge sopra title": adotta
```

### Step 3 - Brief a Codex frontend

Quando inizi una sessione Codex frontend, comincia sempre con:

```
CONTESTO:
Sto costruendo la landing page di Ambrogio.ai (vedi 01_landing_page.md).

REFERENZE VISIVE:
Ho allegato 3 screenshot. Per ciascuno, leggi anche il file .md con le mie note:
1. stripe_hero.png - mi piacciono: tipografia, spacing, pattern badge
2. linear_feature.png - mi piacciono: card con gradient subtle, icone monocromatiche
3. attio_dashboard.png - mi piace: densita' informazione, colori sidebar

DESIGN SYSTEM:
Seguimi rigorosamente il design system in 00_design_system.md.

COMPITO:
Costruisci [sezione specifica] prendendo ispirazione dai pattern dei screenshot ma applicando il NOSTRO design system (colori, font, brand).

Non copiare 1:1. Adatta. Italianizza.
```

---

## SITI CONSIGLIATI COME REFERENCE (per il NOSTRO tipo di prodotto)

### Per landing SaaS B2B
- **Stripe.com** - chiarezza, hierarchy, trust signals
- **Linear.app** - modernita' minimale, tipografia forte
- **Vercel.com** - premium minimalism
- **Attio.com** - dashboard SaaS pulito
- **Supabase.com** - dev tool friendly ma accessibile
- **Resend.com** - italian flavor, pulito
- **Cal.com** - pertinente al nostro settore (appointment booking)
- **Clay.com** - UI creative ma professional

### Per dashboard B2B
- **Linear.app** (dashboard issue tracking)
- **Attio.com** (CRM dashboard)
- **Stripe Dashboard** (metrics + lists)
- **Vercel Dashboard** (project overview)
- **Notion** (flexible content)
- **Superhuman** (keyboard-first UX)

### Per flusso onboarding
- **Notion onboarding** (persona-based)
- **Linear onboarding** (skip-friendly)
- **Attio onboarding** (guided setup)
- **Supabase onboarding** (3 step max)

### Per sito italiano compatibile
- **Fiscozen.it** - B2B italiano, tono giusto
- **Satispay.com** - italian + internazionale
- **Prima Assicurazioni** - dense info ma pulite
- **Young Platform** - italian crypto, design moderno

### DA NON COPIARE
- Siti tipo Bookedin.ai (competitor diretto): vedrai il loro design, evita di sembrare un clone
- Siti enterprise bloated (Salesforce, HubSpot): troppo corporate
- Siti troppo "AI-futuristic" (robot, circuiti): alienanti per il nostro target

---

## COME ESTRARRE IL VALORE DA UNA REFERENCE

Per ogni screenshot, decomponi questi 8 aspetti:

1. **Layout**: quante colonne, come distribuito il contenuto, proporzioni
2. **Tipografia**: font, size hierarchy, contrast tra titoli e body
3. **Colore**: palette primaria, secondaria, bg, accenti
4. **Spacing**: quanto respira, rapporto tra blocchi
5. **Componenti**: che pattern di card/button/input usa
6. **Movimento**: animazioni visibili o accennate
7. **Copy**: lunghezza testi, density word, tone
8. **Trust signals**: loghi, testimonial, numeri, badge

Non prendere tutti e 8 da una sola reference. Prendi 1-2 punti forti da ciascuna.

---

## TRAPPOLE DA EVITARE

### Il "copia-incolla bello"
Se copi 1:1 un design famoso, i tuoi utenti italiani lo riconoscono come "non originale" (anche subconsciamente). Il risultato: zero brand identity.

**Soluzione**: adatta almeno 3 dimensioni (colore, font, spacing) dal pattern originale.

### Il "design ambizioso fuori scope"
Vedi Linear che fa animazioni spettacolari, le copi, ma non hai budget developer per mantenerle.

**Soluzione**: valuta sempre il costo di implementazione + manutenzione.

### Il "design che funziona per loro ma non per te"
Stripe ha una landing minimalista perche' loro sono gia' conosciuti. Tu non lo sei. Potresti aver bisogno di MORE informazione, non MENO.

**Soluzione**: chiediti sempre "funziona per il mio target italiano di 45 anni proprietario di studio dentistico?"

### Il "mood board infinito"
Troppe reference paralizzano.

**Soluzione**: massimo 5 screenshot totali per progetto. Se ne hai 20, elimina 15.

---

## TEMPLATE BRIEF FOR CODEX FRONTEND

Copia e incolla all'inizio di ogni sessione:

```
CONTESTO PROGETTO: [leggi sempre 00_design_system.md + 00_context_project.md]

OBIETTIVO DI QUESTA SESSIONE:
[cosa vogliamo produrre]

REFERENZE ALLEGATE:
- [file1.png]: prendi ispirazione su X, Y, Z
- [file2.png]: prendi ispirazione su A, B
- [file3.png]: prendi ispirazione su solo C

DESIGN SYSTEM:
Rispetta rigorosamente 00_design_system.md (colori, font, spacing).

DELIVERABLE RICHIESTO:
[formato output: React components TSX + Tailwind]

PRIMA DI INIZIARE:
1. Mostrami un wireframe testuale
2. Indica dubbi o trade-off
3. Lista i componenti shadcn che userai

Procedi solo dopo mia conferma.
```
