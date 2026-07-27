# Stato del progetto — cosa funziona, cosa manca, cosa resta da fare

**Ultima verifica: 27 luglio 2026 · Versione 0.2.0 · Branch `main`**

Questa pagina è lo stato reale e verificabile di **WhatsApp Receptionist** (Ambrogio.ai), il
**receptionist AI open source per WhatsApp** che prende appuntamenti veri. Ogni affermazione qui
sotto è stata controllata contro il codice, la suite di test e una build di produzione nella data
indicata — non stimata.

Se stai valutando il progetto, leggi questa pagina **prima** del README. Il README presenta; questa
pagina ti dice esattamente dove sono i buchi.

---

## Indice

- [Che cos'è questo progetto](#che-cosè-questo-progetto)
- [Numeri verificati](#numeri-verificati)
- [Cosa funziona oggi](#cosa-funziona-oggi)
- [Cosa non funziona ancora](#cosa-non-funziona-ancora)
- [Cosa resta da fare](#cosa-resta-da-fare)
- [Come è stata costruita questa release](#come-è-stata-costruita-questa-release)
- [Come verificare tutto da solo](#come-verificare-tutto-da-solo)

---

## Che cos'è questo progetto

Un **receptionist AI open source, self-hostable e multi-tenant** per piccole imprese italiane —
studi dentistici, centri estetici, palestre, studi professionali — pensato GDPR-first.

Riceve messaggi WhatsApp e note vocali, capisce l'intento con **Anthropic Claude**, trascrive
l'audio con **ElevenLabs**, controlla la disponibilità reale, fissa l'appuntamento su **Google
Calendar**, fattura con **Stripe** e passa la conversazione a un umano quando è giusto farlo.

**Stack:** Next.js 15 App Router · React 19 · TypeScript 5.9 strict · Supabase Postgres con Row
Level Security · Anthropic Claude · ElevenLabs STT/TTS · 360dialog WhatsApp Business API · Stripe
Subscriptions · Upstash Redis · Playwright · Vitest · licenza MIT.

---

## Numeri verificati

| Metrica | Valore |
|---|---|
| Pagine frontend | 41 |
| Route API | 39 |
| Moduli di dominio server-side | 16 |
| Tabelle a database (tutte con RLS) | 22 |
| Test unitari e di integrazione | **521** su 80 file |
| Test end-to-end (Playwright) | **56** su 5 spec |
| Righe di TypeScript in `src/` | ~39.700 |
| Vulnerabilità nelle dipendenze di produzione | **0** |
| Build di produzione | verificata |

---

## Cosa funziona oggi

### Il ciclo centrale: messaggio in ingresso, risposta in uscita

Un messaggio WhatsApp arriva su `POST /api/webhook/whatsapp`, viene verificato con confronto
timing-safe, deduplicato per chiave di idempotenza, classificato per intento, gestito da Claude e
consegnato attraverso un outbox transazionale con `FOR UPDATE SKIP LOCKED`, backoff esponenziale e
coda dead-letter.

**Corretto in 0.2.0:** i cinque cron Vercel restituivano HTTP 405 a **ogni singola esecuzione**,
perché `vercel.json` li schedulava mentre le route esportavano solo `POST` e Vercel Cron invoca in
`GET`. L'outbox non veniva quindi mai drenato e il prodotto era silenziosamente muto in produzione.
Un test di regressione lega ora `vercel.json` agli handler esportati.

### Registrazione self-service e onboarding

Registrazione → magic link → `/auth/callback` → onboarding → dashboard. Ogni segmento autenticato è
protetto a livello di layout, così una pagina aggiunta domani nasce protetta per costruzione e non
per disciplina. Il parametro di redirect `next` è validato contro l'open redirect.

**Corretto in 0.2.0:** tutti e quattro i form pubblici inviavano
`application/x-www-form-urlencoded` verso route che fanno `JSON.parse` del raw body, quindi ogni
invio falliva e il browser navigava sul JSON grezzo dell'API. `/auth/callback` non esisteva
affatto, pur essendo già configurato come `emailRedirectTo` del magic link: ogni email di accesso
portava a un 404.

### Multi-tenancy reale sul canale WhatsApp

Ogni tenant collega il proprio numero WhatsApp dalla dashboard. La API key del provider è cifrata a
riposo con AES-256-GCM e non viene mai restituita dall'API. Un numero già rivendicato da un altro
tenant viene rifiutato, perché il webhook risolve il tenant proprio dal `phone_number_id`: senza
quel controllo un tenant avrebbe potuto **ricevere le conversazioni di un altro**.

**Corretto in 0.2.0:** l'outbox usava una sola chiave API globale per tutti, quindi ogni cliente
avrebbe risposto dallo stesso numero WhatsApp, condividendo identità di brand, quota e rischio di
ban. Il secondo cliente pagante rompeva il modello.

### Escalation a operatore umano

Quando un guardrail rileva un messaggio sensibile, o il cliente chiede una persona, la conversazione
passa a `escalated`, l'operatore riceve una email con il contesto e il link diretto, e soprattutto
**il cliente viene avvisato che un umano sta arrivando**.

**Corretto in 0.2.0:** `escalated` esisteva solo come tipo e non veniva mai scritto;
`human_escalation_email` veniva salvato e mai letto. A un messaggio con "dolore forte" rispondeva il
silenzio totale.

### Prenotazioni che non inventano disponibilità

Gli slot provengono dalla disponibilità reale, protetta a livello di database da un exclusion
constraint GiST contro la doppia prenotazione. Gli importi sono in centesimi interi, i timestamp in
`timestamptz`.

**Corretto in 0.2.0:** la comprensione di date e orari in italiano sbagliava su frasi comunissime —
"alle 3 del pomeriggio" veniva letto come 03:00, "il 15 maggio" ignorato, i minuti catturati ma
scartati.

### Personalità AI modificabile, con limiti inviolabili

Il system prompt è composto come **[regole di sicurezza, personalità del tenant, regole di output]**
e le sezioni di sicurezza non sono sovrascrivibili.

**Corretto in 0.2.0:** un prompt del tenant *sostituiva* il prompt di sistema, cancellando in
silenzio i divieti su diagnosi mediche e promesse non mantenibili — un rischio concreto in un
prodotto usato da studi dentistici.

### Il resto

Inbox conversazioni con risposta operatore, che rispetta la finestra di servizio di 24 ore di
WhatsApp e lo stato di opt-out. Knowledge base con ricerca semantica pgvector reale. Viste
calendario e fatturazione. Configurazione di orari di apertura e servizi. Export GDPR Art. 15 e
cancellazione Art. 17 con audit log. CSP con nonce, HSTS, COEP/COOP/CORP. Logging Pino con
redazione automatica dei dati personali.

---

## Cosa non funziona ancora

Detto apertamente, perché scoprirlo dopo il clone è peggio che leggerlo qui.

### Pannello admin cross-tenant — non collegato

Le viste tenant, utenti, fatturazione e audit mostrano uno stato esplicito di "non collegato" con
rimando alla fonte autorevole, al posto dei dati inventati che mostravano prima.

**Perché non è stato semplicemente cablato:** quelle letture girano in `service_role`, che scavalca
la Row Level Security. Meritano un servizio dedicato in `src/server/admin/` con test di isolamento,
non query improvvisate dentro una pagina.

### L'isolamento tra tenant è applicativo, non dimostrato dal database

24 moduli server usano il client service-role, quindi l'isolamento poggia su circa 66 filtri
`.eq('tenant_id')` scritti a mano. Le policy RLS esistono su tutte e 22 le tabelle ma non vengono
mai valutate a runtime, e nessun job di CI semina due tenant e dimostra che il tenant A non può
leggere il tenant B.

**È il punto aperto più importante in assoluto.** Va considerato il prerequisito per gestire dati di
clienti reali su scala.

### Nessun error tracking, nessun alerting

Non c'è Sentry, non c'è OpenTelemetry, non ci sono avvisi. Se il bot smette di rispondere alle 3 di
notte, nessuno se ne accorge finché un cliente non si lamenta. `/api/health/deep` esegue probe reali
ed è utilizzabile come endpoint di monitoraggio esterno, ma nulla lo consuma.

### Nessun job di retention

La privacy policy pubblica dichiara una retention di 24 mesi. I dati delle conversazioni crescono
oggi senza limite: il job di cancellazione non esiste.

### Il modello dati esclude due casi comuni

Non esiste un'entità risorsa o operatore, quindi il vincolo anti-doppia-prenotazione è per tenant:
uno studio con due poltrone non è modellabile correttamente. E un tenant significa un utente per
sempre: non esiste un flusso di invito per il team.

### Altri limiti noti

- La risposta AI viene generata in modo sincrono dentro il webhook, senza `maxDuration`
- Nessun prompt caching, quindi il costo AI per conversazione è più alto del necessario
- Nessuna difesa contro il prompt injection dai messaggi WhatsApp in ingresso
- Docker Compose non ha uno scheduler e il Valkey incluso non può servire il client REST Upstash:
  il percorso self-hosted non è eseguibile end-to-end
- Il job E2E è non bloccante in CI finché la suite non dimostra stabilità; la condizione di
  promozione è scritta in `.github/workflows/ci.yml`
- Una vulnerabilità solo-dev accettata consapevolmente, documentata con la sua condizione di
  riapertura in [`SECURITY-AUDIT-NOTES.md`](SECURITY-AUDIT-NOTES.md)

---

## Cosa resta da fare

In ordine di rapporto impatto/sforzo.

1. **Isolamento tra tenant dimostrato in CI.** Avviare Supabase, applicare le migration da zero,
   seminare due tenant e asserire che A non legge B. Inoltre far registrare ai fake dei test gli
   argomenti di `eq`, così che rimuovere un filtro tenant faccia diventare rosso un test — oggi non
   accade.
2. **Error tracking e watchdog.** Sentry con source map e release tracking, più un job che si
   accorga quando l'outbox smette di drenare.
3. **Job di data retention**, allineato alla retention che la privacy policy già promette.
4. **Entità risorsa e team.** Vincoli di prenotazione per risorsa e flusso di invito del team.
5. **Spostare la generazione AI fuori dal webhook** in un job outbox dedicato: elimina in un colpo
   solo la latenza sincrona e il rischio di retry.
6. **Prompt caching e tetto di costo AI per tenant.**
7. **Cablare il pannello admin cross-tenant** sopra un servizio `src/server/admin/` testato.
8. **Difese contro il prompt injection** e un insieme di valutazione molto più ampio per il livello
   AI.

Gli obiettivi di lungo periodo sono in [`ROADMAP.md`](ROADMAP.md).

---

## Come è stata costruita questa release

La versione 0.2.0 è stata prodotta con **Claude Opus 5 in modalità ultracode** — l'orchestrazione
multi-agente di Anthropic, in cui uno script di workflow distribuisce il lavoro su molti subagent
indipendenti e ne sintetizza i risultati in modo deterministico.

Il processo, in ordine:

1. **Audit multi-dimensionale.** Otto revisori indipendenti hanno esaminato dimensioni separate del
   codebase — completezza di prodotto, sicurezza multi-tenant, qualità del livello AI, affidabilità,
   livello dati, testing, esperienza open-source e frontend. Ogni revisore è stato seguito da un
   **verificatore avversariale** istruito a *smentirne* i risultati aprendo i file citati. 69
   finding sono sopravvissuti a quella verifica; i sei più gravi sono stati poi controllati a mano
   prima di scrivere una riga di codice.
2. **Prima l'onestà.** Ogni affermazione pubblica non verificabile è stata rimossa prima di
   qualunque lavoro sulle funzionalità.
3. **Implementazione parallela.** Quattordici subagent su due workflow, ciascuno proprietario di un
   insieme di file disgiunto, con verifica centralizzata a valle.

Totale: **31 agenti, circa 4,3 milioni di token**. L'audit completo, inclusi i finding su cui si è
scelto di *non* intervenire, è pubblicato in
[`audit/2026-07-27-audit-prodotto.md`](audit/2026-07-27-audit-prodotto.md).

Una nota sul metodo, perché è la parte interessante: il valore non è venuto dal generare codice in
fretta. È venuto dal passaggio di verifica avversariale. Circa un terzo dei finding iniziali è stato
smentito o ridimensionato quando a un secondo agente è stato chiesto di confutarli leggendo i file
veri — che è esattamente il modo in cui fallisce una review AI a passaggio singolo, ed è il motivo
per cui i sei finding più gravi sono stati comunque confermati a mano prima di toccare qualsiasi
cosa.

---

## Come verificare tutto da solo

Non fidarti di questa pagina. Ogni numero qui sopra è riproducibile:

```bash
git clone https://github.com/Hiberius/whatsapp-receptionist.git
cd whatsapp-receptionist
npm ci
npm run verify          # typecheck + lint + 521 test + controllo copertura RLS
npm audit --omit=dev    # 0 vulnerabilità
npm run build           # build di produzione
npx playwright install chromium && npm run test:e2e   # 56 test E2E
```

Per verificare le affermazioni su cosa *manca*, questi sono i comandi che le hanno prodotte:

```bash
grep -rn "createSupabaseAdminClient" src/server | wc -l   # uso del service role
grep -rn "eq('tenant_id'" src/server | wc -l              # filtri di isolamento scritti a mano
grep -rn "Sentry\|opentelemetry" package.json             # error tracking: nessuno
```

---

*Domande, correzioni, o un'affermazione che abbiamo sbagliato?* Apri una issue: un'affermazione di
questa pagina che non è riproducibile è un bug, e come tale verrà trattata.
