> **Nota — AI Scheduling Advisor**
>
> Questo repository è **AI Scheduling Advisor**, un fork-portfolio del progetto MIT
> [Hiberius/whatsapp-receptionist](https://github.com/Hiberius/whatsapp-receptionist): aggiunge un
> ranking deterministico e spiegabile degli slot e un registro auditabile delle decisioni di
> scheduling.
>
> La documentazione di portfolio è **[README.md](README.md)**: è il documento primario e l'unico che
> descrive le aggiunte del fork. Il documento italiano qui sotto descrive in larga parte
> l'applicazione originale a monte, il cui autore è Christian Calabrò — vedi
> [ATTRIBUTION.md](ATTRIBUTION.md).

<div align="center">
  <img src="docs/screenshots/hero-banner.svg" alt="WhatsApp Receptionist — il receptionist AI open source che prende appuntamenti veri su WhatsApp" width="100%" />

# WhatsApp Receptionist

### Il receptionist AI open source che prende appuntamenti veri su WhatsApp

**Costruito in Italia 🇮🇹 · GDPR-first · Self-hostable · MIT**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9_strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Anthropic Claude](https://img.shields.io/badge/Anthropic-Claude-D97757?logo=anthropic)](https://anthropic.com)
[![Test](https://img.shields.io/badge/test-579%20+%2056%20E2E-brightgreen)](#quality-gate)
[![Vulnerabilità produzione](https://img.shields.io/badge/vulnerabilit%C3%A0%20prod-0-brightgreen)](docs/SECURITY-AUDIT-NOTES.md)
[![GDPR](https://img.shields.io/badge/GDPR-first-2563eb)](#gdpr--sicurezza)
[![Stars](https://img.shields.io/github/stars/Hiberius/whatsapp-receptionist?style=social)](https://github.com/Hiberius/whatsapp-receptionist/stargazers)

[Stato del progetto](docs/STATO-DEL-PROGETTO.md) · [Quickstart](#quickstart) · [Documentazione](docs/) · [Roadmap](docs/ROADMAP.md) · [English 🇬🇧](README.md)

</div>

---

## Cosa fa

Un cliente scrive su WhatsApp — testo o vocale — alle 22:40 di domenica. L'AI capisce cosa vuole,
controlla la disponibilità reale sull'agenda, fissa l'appuntamento e lo conferma. Quando il
messaggio richiede una persona, passa la palla a te e avvisa il cliente che qualcuno sta arrivando.

- **Riceve messaggi WhatsApp e note vocali**, a qualsiasi ora
- **Capisce l'intento e prende appuntamenti veri** su Google Calendar, con conferme e promemoria
- **Passa a un umano** quando scatta un guardrail o il cliente lo chiede: la conversazione cambia stato, tu ricevi una email, il cliente riceve una risposta
- **Multi-tenant**: ogni cliente collega il proprio numero WhatsApp e configura orari, servizi, knowledge base e personalità dell'assistente

<img src="docs/screenshots/landing-1280.png" alt="Landing page" width="100%" />

> Gli screenshot di questo README sono catturati dall'applicazione in esecuzione con
> `node scripts/capture-screenshots.mjs`. Non sono mockup.

---

## Stato reale del progetto

Quasi tutti i README open source descrivono la versione migliore del progetto. Questo descrive
quella vera. Il quadro completo, con i comandi per riprodurre ogni numero, è in
**[docs/STATO-DEL-PROGETTO.md](docs/STATO-DEL-PROGETTO.md)**.

| Livello | Stato |
|---|---|
| Servizi di dominio (`src/server/`) | **Reali.** Booking con disponibilità e vincolo GiST contro la doppia prenotazione, ciclo di vita abbonamenti Stripe, outbox WhatsApp con `FOR UPDATE SKIP LOCKED`, retry/backoff e dead-letter, idempotenza webhook, OAuth Google Calendar, RAG pgvector, GDPR Art. 15/17. |
| Database (`supabase/migrations/`) | **Reale.** 23 tabelle, RLS su ognuna, `timestamptz` ovunque, importi in centesimi interi. |
| Primitivi di sicurezza | **Reali.** Firma Stripe sul raw body, confronto timing-safe, state OAuth firmato HMAC e legato al tenant, AES-256-GCM sulle credenziali salvate, CSP con nonce. |
| Registrazione self-service | **Funzionante.** Registrazione → magic link → `/auth/callback` → onboarding → dashboard, con guard su ogni segmento autenticato. |
| Dashboard tenant | **Funzionante.** Dashboard, inbox conversazioni con risposta operatore, calendario, fatturazione, impostazioni WhatsApp, orari, servizi, personalità AI, knowledge base — tutto su dati reali del tenant. |
| WhatsApp multi-tenant | **Funzionante.** Ogni tenant collega il proprio numero. La API key è cifrata a riposo e risolta per tenant al momento dell'invio; un numero non può essere rivendicato da un secondo tenant. |
| Escalation umana | **Funzionante.** Cambio di stato, email all'operatore con contesto e link diretto, e una risposta al cliente. |
| Job in background | **Funzionanti.** Sette cron, con un test di regressione che lega `vercel.json` agli handler realmente esportati. |
| Retention dei dati | **Funzionante.** Job giornaliero che applica esattamente le soglie dichiarate nella privacy policy, con modalità di simulazione e un test che fallisce se codice e policy divergono. |
| Alerting | **Parziale.** Un watchdog avvisa via email quando la coda di uscita smette di essere drenata. Non c'è ancora Sentry, quindi le singole eccezioni finiscono nei log ma non sono aggregate. |
| Isolamento tenant | **Parzialmente provato.** I filtri di repository sono coperti da test che falliscono se un filtro `tenant_id` viene rimosso. La RLS in sé non viene ancora mai valutata a runtime. **È il punto aperto più importante.** |
| Pannello admin cross-tenant | **Non collegato.** Quelle letture scavalcano la RLS e richiedono un servizio dedicato con test di isolamento. Le schermate lo dichiarano invece di mostrare dati inventati. |

**41 pagine frontend · 41 route API · 23 tabelle · 579 test unitari e di integrazione · 56 test E2E
Playwright · build di produzione verificata · zero vulnerabilità nelle dipendenze di produzione.**

---

## Quickstart

```bash
git clone https://github.com/Hiberius/whatsapp-receptionist.git
cd whatsapp-receptionist
cp .env.example .env.local
npm ci
npm run dev
```

Apri <http://localhost:3000>.

Il sito marketing, i piani, i verticali, il blog, l'help center e le pagine legali si vedono subito
senza nessuna credenziale. Per arrivare alla dashboard serve un progetto Supabase (il piano gratuito
basta): tutte le altre integrazioni sono opzionali e attivate per feature — senza chiave Anthropic
l'AI semplicemente non risponde, senza Resend il mailer logga invece di spedire. Niente si rompe
perché manca una chiave.

`./scripts/setup.sh` guida la configurazione passo passo. Il riferimento completo è in
[`.env.example`](.env.example), documentato riga per riga.

Per la produzione, vedi [`docs/deployment.md`](docs/deployment.md).

---

## Funzionalità

|     |     |
|-----|-----|
| **WhatsApp + voce** | Testo e note vocali via 360dialog Business API (BSP ufficiale Meta) più ElevenLabs per la trascrizione. Niente Baileys, niente client scraped. |
| **Prenotazioni vere** | OAuth Google Calendar, disponibilità calcolata da orari e servizi reali, protezione a livello di database contro la doppia prenotazione, conferme e promemoria. |
| **Escalation umana** | Guardrail sui temi sensibili, richieste esplicite di parlare con una persona, notifica all'operatore e risposta al cliente: il silenzio non è mai l'esito. |
| **Personalità AI modificabile** | Ogni tenant riscrive la personalità dell'assistente. Le regole di sicurezza e di output vengono composte attorno e non sono sovrascrivibili. |
| **Knowledge base con RAG** | Ricerca semantica pgvector sui documenti caricati dal tenant: listino, politica di disdetta, come raggiungere lo studio, domande frequenti. |
| **GDPR nativo** | Endpoint Art. 15 e Art. 17, audit log, redazione automatica dei dati personali nei log, hosting UE e un job di retention che applica la policy pubblicata. |
| **Stripe + SDI italiano** | Abbonamenti e Customer Portal, più fatturazione elettronica B2B tramite Fatture in Cloud. |
| **Multi-tenant per costruzione** | Row Level Security su tutte e 22 le tabelle, credenziali WhatsApp per tenant, tutto filtrato per tenant. |

---

## Stack tecnico

| Livello | Scelta | Perché |
|---|---|---|
| Framework | **Next.js 15.5** App Router | Server Components, Route Handlers, middleware |
| Runtime | **React 19** + Node 22 | Server component asincroni, rendering concorrente |
| Linguaggio | **TypeScript 5.9 strict** | `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, nessun `any` in `src/` |
| Database | **Supabase Postgres (UE)** | Postgres gestito, RLS nativa, pgvector. Le migration sono SQL scritto a mano, di proposito: le policy restano leggibili. |
| Auth | **Supabase Auth** | Cookie httpOnly + secure + sameSite, sessione SSR-aware |
| AI | **Anthropic Claude** | Gli ID modello sono configurazione (`ANTHROPIC_MODEL_PRIMARY` / `_FAST`), non hardcoded |
| Voce | **ElevenLabs** | Qualità della trascrizione in italiano |
| Messaggistica | **360dialog Business API** | BSP ufficiale Meta (`waba-v2.360dialog.io`) |
| Calendario | **Google Calendar OAuth** | Token cifrati, rilevamento conflitti |
| Fatturazione | **Stripe** + **Fatture in Cloud** | Abbonamenti, Customer Portal, fatturazione SDI |
| Rate limit | **Upstash Redis (UE)** | Policy nominate per endpoint |
| Logging | **Pino** | JSON strutturato con redazione automatica dei dati personali |
| Testing | **Vitest 4** + **Playwright** | 579 unit/integrazione + 56 E2E |
| Tooling | **ESLint 9 flat** + **Prettier 3** + **Husky** | lint-staged in pre-commit, gitleaks in CI |

---

## Architettura

```
src/
├── app/
│   ├── (admin)/              pannello super-admin cross-tenant
│   ├── (auth)/               login, registrazione
│   ├── (dashboard)/          dashboard tenant — il guard sta nel layout
│   ├── auth/callback/        atterraggio del magic link, con validazione anti open-redirect
│   ├── api/                  41 route handler
│   ├── legal/                privacy, termini, DPA, cookie, sicurezza
│   ├── verticali/            pagine marketing per settore
│   └── page.tsx              landing
├── components/
│   ├── marketing/            Hero, Features, Verticali, Piani, CTA
│   ├── dashboard/            shell, risposta operatore, documenti knowledge
│   ├── settings/             connessione WhatsApp, orari, servizi, personalità AI
│   └── forms/                useApiForm + FormFeedback, condivisi da ogni form
├── lib/
│   ├── api/                  jsonHandler, parsing del body
│   ├── auth/                 sessione, guard, cookie, redirect sicuro
│   ├── health/               probe delle dipendenze, condivise da /status e /api/health/deep
│   ├── http/                 fetchWithTimeout
│   ├── logging/              Pino con redazione PII
│   ├── rate-limit/           policy Upstash
│   ├── security/             nonce CSP, confronti timing-safe, auth dei job interni
│   └── supabase/             client server + admin
├── server/                   logica di dominio — mai importata da componenti client
│   ├── ai/                   adapter, intent router, estrattore booking, composizione prompt
│   ├── appointments/         prenotazioni, promemoria, ranking slot, decision ledger
│   ├── billing/              Stripe + Fatture in Cloud
│   ├── conversations/        inbox, messaggi operatore, escalation
│   ├── gdpr/                 export Art. 15, cancellazione Art. 17, retention
│   ├── monitoring/           health watchdog
│   ├── notifications/        mailer + template
│   └── whatsapp/             service, repository, outbox, provisioning, pipeline vocale
└── middleware.ts             nonce CSP + COEP/COOP/CORP

supabase/migrations/          23 tabelle, RLS su ognuna
tests/                        579 test unitari e di integrazione
e2e/                          56 test Playwright
```

---

## GDPR & sicurezza

Costruito per il mercato europeo, e i default lo riflettono.

- **Row Level Security su tutte e 22 le tabelle**, verificata da `npm run db:lint`, che ricava l'elenco delle tabelle dalle migration stesse invece che da una lista mantenuta a mano
- **Verifica della firma dei webhook** con confronto timing-safe (Stripe sul raw body, WhatsApp su segreto condiviso)
- **Credenziali cifrate a riposo** con AES-256-GCM: token OAuth e API key WhatsApp per tenant
- **CSP con nonce per richiesta**, HSTS, COEP, COOP, CORP, `X-Frame-Options: DENY`
- **Redazione automatica dei dati personali** nei log: email, telefono, codice fiscale, partita IVA, IBAN, token
- **Rate limiting** con policy nominate per endpoint
- **Export GDPR Art. 15 e cancellazione Art. 17** con audit log
- **Retention** applicata ogni giorno secondo le soglie che la privacy policy pubblica
- **Zero vulnerabilità nelle dipendenze di produzione**, imposto da un gate di CI. Una segnalazione solo-dev è accettata consapevolmente, con la sua condizione di riapertura scritta in [`docs/SECURITY-AUDIT-NOTES.md`](docs/SECURITY-AUDIT-NOTES.md)

**Limite noto, detto chiaramente:** i moduli server usano il client service-role, che scavalca la
RLS. L'isolamento poggia oggi su filtri `tenant_id` scritti a mano, ora coperti da test di
regressione che falliscono se un filtro viene rimosso — ma le policy in sé non vengono mai valutate
a runtime. Dimostrare l'isolamento contro un Postgres vero in CI è la priorità della v0.3.

---

## Quality gate

```bash
npm run verify   # typecheck + lint + 579 test + copertura RLS
npm run build    # build di produzione
npm run test:e2e # 56 test Playwright, nessuna credenziale richiesta
```

La CI esegue sei job su ogni pull request: **verify**, **coverage**, **build di produzione**,
**E2E**, **secret scan (gitleaks)** e **audit delle dipendenze di produzione**. Secret scan e audit
sono bloccanti: un gate che non può fallire non è un gate.

Una nota sulla build: `npm run verify` **non** la include, e `next build` intercetta cose che
`tsc --noEmit` non vede, per esempio un export non ammesso da un `route.ts`. Eseguili entrambi.

---

## Screenshot

| | |
|---|---|
| Piani | <img src="docs/screenshots/pricing-1280.png" alt="Pagina piani" width="100%" /> |
| Verticale (dentisti) | <img src="docs/screenshots/dental-1280.png" alt="Pagina verticale dentisti" width="100%" /> |
| Stato del servizio | <img src="docs/screenshots/status-1280.png" alt="Pagina di stato con probe reali" width="100%" /> |
| Landing (mobile) | <img src="docs/screenshots/landing-mobile.png" alt="Landing su mobile" width="45%" /> |

La pagina di stato esegue probe reali verso Supabase, Upstash, Stripe e Anthropic al momento della
richiesta. Non pubblica di proposito nessuna percentuale di uptime storico, perché nulla la misura
ancora.

Le schermate autenticate non sono mostrate: catturarle richiederebbe un tenant con conversazioni
vere, e riempirle di dati inventati è esattamente ciò che questo progetto ha passato una release a
rimuovere.

---

## Una nota sul brand

Il repository si chiama **WhatsApp Receptionist**, nome generico. L'applicazione mantiene invece il
brand **Ambrogio.ai** — testi, logo e pagine marketing in italiano — perché è il prodotto da cui è
stata estratta. Tutto ciò che è rivolto all'utente è sostituibile: le stringhe stanno nei componenti
marketing e in `NEXT_PUBLIC_APP_NAME`, i token di design in `src/styles/tokens.css`.

---

## Fa per te?

**Sì se** vuoi self-hostare un receptionist AI, se stai costruendo un SaaS di prenotazioni e ti
serve una base multi-tenant con RLS e Stripe già collegati, o se cerchi un codebase Next.js 15 +
Supabase reale e sostanzioso da cui imparare.

**No se** vuoi qualcosa che funzioni senza configurare WhatsApp Business, o se ti serve
l'amministrazione cross-tenant: quel pannello non è collegato.

---

## Perché esiste

Esistono i chatbot AI ed esistono i sistemi di prenotazione. Non esisteva niente che li unisse con
il rigore GDPR europeo e la conformità fiscale B2B italiana. È nato come installazione reale per uno
studio ed è diventato la cosa che mancava.

La versione 0.2 è stata ricostruita con **Claude Opus 5 in modalità ultracode**, l'orchestrazione
multi-agente di Anthropic. Un audit su otto dimensioni in cui ogni revisore è stato seguito da un
verificatore avversariale istruito a smentirne i risultati, poi workflow di implementazione
paralleli. Circa un terzo dei finding iniziali è caduto o è stato ridimensionato quando un secondo
agente ha provato a confutarli leggendo i file veri — che è esattamente il modo in cui fallisce una
review AI a passaggio singolo. I finding più gravi sono stati comunque verificati a mano prima di
toccare qualsiasi cosa.

Cosa ha trovato quel processo, e cosa ha deliberatamente lasciato stare, è pubblicato per intero:
[`docs/audit/2026-07-27-audit-prodotto.md`](docs/audit/2026-07-27-audit-prodotto.md).

Se lo forki per uso commerciale va benissimo — MIT vuol dire MIT. Solo non dire di averlo scritto
da zero.

---

## Roadmap

I prossimi passi, in ordine di priorità:

1. **Isolamento tenant dimostrato contro un database vero** — seminare due tenant in CI e verificare che A non legga B attraverso le policy RLS stesse
2. **Sentry** con source map e release tracking
3. **Entità risorsa e team** — uno studio con due poltrone oggi non è modellabile, e un tenant significa un utente per sempre
4. **Generazione AI spostata fuori dal webhook**, in un job outbox dedicato
5. **Prompt caching** e tetto di costo AI per tenant
6. **Pannello admin cross-tenant** sopra un servizio testato
7. **Difese contro il prompt injection** e un insieme di valutazione molto più ampio

Elenco completo, comprese le scommesse di lungo periodo: [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## Contribuire

Pull request benvenute — vedi [`CONTRIBUTING.md`](CONTRIBUTING.md).

Il repository è predisposto per [Claude Code](https://claude.com/claude-code): `CLAUDE.md` e
`AGENTS.md` contengono le convenzioni del progetto, così un agente che apre il repo parte già con il
contesto giusto.

Due regole della casa da conoscere prima di aprire una PR:

1. **Esegui `npm run verify` e `npm run build`.** Verify non include la build.
2. **Non aggiungere affermazioni che il codice non sostiene.** Se un numero compare nel README o nell'interfaccia, deve essere riproducibile. Questo progetto ha rimosso un intero strato di metriche inventate nella 0.2.0 e preferirebbe non farne crescere un altro.

---

## Licenza

MIT © [Christian Calabrò](https://github.com/Hiberius) — vedi [`LICENSE`](LICENSE).

---

<div align="center">

Fatto in Italia da Christian Calabrò ([@Hiberius](https://github.com/Hiberius))

Se ti ha fatto risparmiare tempo, [metti una stella](https://github.com/Hiberius/whatsapp-receptionist).

</div>
