# GDPR, AI ACT E PRIVACY CHECKLIST - PRE-LANCIO

Checklist operativa aggiornata da Codex il 24 aprile 2026. Va completata prima del lancio pubblico di Ambrogio.ai e rivista con consulente legale.

## Stato decisioni

- [x] Trial default: 14 giorni senza carta.
- [x] Ambrogio.ai agisce come Titolare per sito/account/billing/supporto.
- [x] Ambrogio.ai agisce come Responsabile per conversazioni degli utenti finali dei Clienti.
- [x] I vocali WhatsApp sono funzionalita' esplicita: STT in ingresso e TTS opzionale in uscita.
- [x] L'assistente deve dichiarare che e' AI.
- [ ] Entita' legale, P.IVA, sede e PEC confermate.
- [ ] DPO: valutazione documentata completata.
- [ ] Responsabile interno privacy/security nominato.

## Documenti pubblici

- [ ] Privacy Policy pubblicata su `/privacy-policy`.
- [ ] Terms & Conditions pubblicati su `/terms`.
- [ ] DPA scaricabile e accettabile su `/dpa`.
- [ ] Cookie Policy pubblicata su `/cookie-policy`.
- [ ] Lista sub-responsabili pubblicata su `/subprocessors`.
- [ ] Security page o trust page minima pubblicata su `/security`.
- [ ] Versioni documenti salvate con data, hash e changelog.
- [ ] Link a Privacy, Terms, Cookie, DPA e Subprocessors nel footer.
- [ ] Link Privacy/AI disclosure nel primo messaggio WhatsApp automatico.
- [ ] Tutti i documenti rivisti da avvocato GDPR italiano.

## Documenti interni

- [ ] Registro dei trattamenti (RoPA) creato.
- [ ] DPIA template creato.
- [ ] DPIA completata per clienti sanitari o trattamenti ad alto rischio.
- [ ] Legitimate Interest Assessment per sicurezza, analytics tecnici e soft spam B2B.
- [ ] Transfer Impact Assessment per provider extra SEE.
- [ ] Data breach response plan.
- [ ] Vendor register con DPA, SCC, regioni e retention.
- [ ] Access matrix team/collaboratori.
- [ ] Incident log anche se vuoto.

## Consensi e trasparenza

- [ ] Checkbox Terms + Privacy al signup, non preselezionata.
- [ ] Accettazione DPA per piani B2B, con versione, timestamp, IP e user id.
- [ ] Opt-in marketing separato dal contratto.
- [ ] Revoca marketing facile e tracciata.
- [ ] Cookie banner con rifiuta, accetta e preferenze granulari.
- [ ] Nessun cookie marketing/analytics non esente prima del consenso.
- [ ] Banner accessibile e richiamabile.
- [ ] Log consensi con versione documento, finalita', timestamp, IP e user agent.
- [ ] Primo messaggio AI include disclosure chiara: "Sono l'assistente AI di [azienda]".
- [ ] L'assistente risponde chiaramente se l'utente chiede se e' umano.
- [ ] Escalation umana disponibile.

## WhatsApp e canali

- [ ] Verificare policy WhatsApp Business e Business Solution Terms correnti prima del go-live.
- [ ] Confermare che Ambrogio.ai e' posizionato come assistente verticale per aziende, non chatbot general purpose.
- [ ] Template WhatsApp approvati e classificati correttamente.
- [ ] Opt-in/legitimate basis per messaggi proattivi definita dal Cliente.
- [ ] Opt-out automatico gestito e persistito.
- [ ] Webhook WhatsApp protetto con meccanismo reale del provider, non assunzioni HMAC non confermate.
- [ ] Idempotenza webhook implementata.
- [ ] Media WhatsApp scaricati solo quando necessario.
- [ ] Retention audio e transcript configurabile per tenant.

## AI e vocali

- [ ] Anthropic commercial/API terms e DPA verificati.
- [ ] Anthropic configurato senza training su customer data, salvo opt-in esplicito che non useremo.
- [ ] ElevenLabs DPA verificato e archiviato.
- [ ] ElevenLabs EU data residency e zero retention valutati per clienti sanitari/sensibili.
- [ ] Disabilitare feedback/training manuale verso provider AI, ove applicabile.
- [ ] Prompt vietano diagnosi, emergenze, consulenza professionale e raccolta dati non necessari.
- [ ] Log AI redatti e minimizzati.
- [ ] Human fallback per dati sensibili, reclami, urgenze, cancellazioni e casi fuori policy.
- [ ] Test su allucinazioni, refusal, escalation e dati sanitari spontanei.

## Data residency e sub-responsabili

- [ ] Supabase in regione EU.
- [ ] Storage allegati/media in regione EU o con garanzie adeguate.
- [ ] Vercel region/runtime configurati per ridurre trasferimenti inutili.
- [ ] PostHog EU Cloud o self-hosted.
- [ ] Resend regione e DPA verificati.
- [ ] Cloudflare DPA/SCC archiviati.
- [ ] Sentry configurato senza PII nei payload.
- [ ] Stripe Payments Europe e fatturazione configurate.
- [ ] 360dialog DPA e condizioni privacy verificati.
- [ ] Google OAuth scope calendar minimizzati.
- [ ] Pagina sub-responsabili aggiornata a ogni cambio vendor.

## Implementazione diritti GDPR

- [ ] `GET /api/gdpr/export` per export dati Cliente.
- [ ] `POST /api/gdpr/delete-me` per richiesta cancellazione account.
- [ ] `GET /api/gdpr/processing` per dati trattati e basi giuridiche.
- [ ] Flusso richiesta cancellazione tenant.
- [ ] Export conversazioni e appuntamenti per Cliente/Titolare.
- [ ] Flusso per cercare/cancellare dati di utente finale su richiesta del Cliente.
- [ ] Conferma identita'/re-auth prima di export o delete.
- [ ] Audit log per export, delete, consent change e accessi admin.

## Retention

- [ ] Conversazioni: default 24 mesi, configurabile.
- [ ] Audio WhatsApp temporanei: default max 30 giorni, meno per clienti sensibili.
- [ ] Trascrizioni: stessa retention dei messaggi.
- [ ] Log tecnici: 12 mesi.
- [ ] Audit log: 24 mesi o piu' se necessario.
- [ ] Backup: 30-90 giorni secondo provider.
- [ ] Fatture e documenti contabili: 10 anni.
- [ ] Account cancellato: grace period 30 giorni, poi cancellazione applicativa.
- [ ] Opt-out: conservato finche' necessario a rispettare la scelta.

## Sicurezza

- [ ] MFA obbligatoria per owner/admin.
- [ ] RLS attiva su tutte le tabelle tenant-scoped.
- [ ] Test isolamento tenant A/B.
- [ ] No service role key in client code.
- [ ] Secrets solo in env/vault.
- [ ] Rate limiting su login, webhook, API admin.
- [ ] WAF Cloudflare attivo.
- [ ] Dependency audit.
- [ ] Gitleaks o secret scan in CI.
- [ ] SAST/lightweight code scan in CI.
- [ ] Pen test o almeno OWASP ZAP scan pre-lancio.
- [ ] Backup restore testato.
- [ ] Procedura rotazione segreti.

## Billing e consumer law

- [ ] Pricing mostra chiaramente cosa include WhatsApp/BSP/voice e cosa e' pass-through.
- [ ] IVA e fatturazione chiarite.
- [ ] Trial senza carta coerente in Terms, pricing e landing.
- [ ] Refund policy coerente in Terms e checkout.
- [ ] Clausole vessatorie B2B accettate separatamente dove necessario.
- [ ] Se si vendono a consumatori, diritto di recesso e Codice del Consumo verificati.

## Red flags bloccanti

- [ ] Nessuna entita' legale definita.
- [ ] Privacy e Terms non rivisti.
- [ ] Nessun DPA per clienti B2B.
- [ ] Dati sanitari trattati senza DPIA.
- [ ] Vocali abilitati senza DPA/retention ElevenLabs valutata.
- [ ] Uso WhatsApp come AI general purpose.
- [ ] Cookie marketing caricati prima del consenso.
- [ ] RLS non testata.
- [ ] Service role esposta lato client.
- [ ] Sub-responsabili non pubblicati.
- [ ] Pricing che promette costi WhatsApp inclusi senza copertura margini.

## Scadenze e monitoraggio

- **Prima del beta pubblico:** documenti legali, DPA, sub-responsabili, cookie banner, RLS test, webhook security.
- **Prima clienti sanitari:** DPIA, retention ridotta, provider voice/AI verificati, informativa specifica.
- **2 agosto 2026:** entrata in applicazione degli obblighi AI Act su trasparenza chatbot/sistemi AI interattivi.
- **Ogni mese:** review audit log e incidenti.
- **Ogni trimestre:** review sub-responsabili e security posture.
- **Ogni anno:** review legale completa.

## Fonti operative da monitorare

- Garante Privacy: https://www.garanteprivacy.it
- EDPB: https://www.edpb.europa.eu
- Commissione Europea SCC: https://commission.europa.eu
- EU AI Act: https://eur-lex.europa.eu
- Meta/WhatsApp Business Platform Terms e pricing.
- 360dialog docs e pricing.
- Anthropic Privacy/Commercial Terms.
- ElevenLabs DPA, data residency e zero retention.

---

## Note operative interne

- Fatto da Codex.
- Codex: usare questa checklist come gate per backend auth, webhook, vocali, AI engine e billing.
- Codex frontend: preparare pagine legal/trust senza claim assoluti tipo "GDPR compliant" finche' non abbiamo audit e revisione legale.
