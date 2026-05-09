# Ricerca legal/GDPR/pricing - 24 aprile 2026

Fatto da Codex. Obiettivo: consolidare fonti aggiornate per Privacy Policy, GDPR/DPA, Terms & Conditions e valutazione prezzi Ambrogio.ai.

## Tipo ricerca

- Legal/privacy: fonti normative e provider.
- Market/pricing: benchmark competitivo pubblico.
- Output operativo: aggiornamento documenti in repo e raccomandazioni.

## Evidenze legali e privacy

### GDPR e ruoli

- Il GDPR richiede informativa con identita' titolare, finalita', basi giuridiche, destinatari, trasferimenti, retention, diritti e logica di eventuali decisioni automatizzate. Fonte consultata: testo GDPR art. 13, mirror navigabile del testo normativo: https://gdpr-info.eu/art-13-gdpr/
- Per trattamenti per conto del Cliente serve un contratto/DPA art. 28 con istruzioni documentate, confidenzialita', misure art. 32, sub-responsabili, assistenza diritti, cancellazione/restituzione e audit. Fonti: EDPB controller/processor guidelines e Commissione Europea SCC art. 28.
- EDPB ha linee guida sui concetti di titolare/responsabile: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor-gdpr_en
- La Commissione Europea ha SCC per controller/processor in EU/EEA pubblicate il 4 giugno 2021: https://commission.europa.eu/publications/standard-contractual-clauses-controllers-and-processors-eueea_en

### Cookie e consenso

- Le linee guida cookie del Garante richiedono informativa estesa, possibilita' di accettare, rifiutare/chiudere senza consenso ai cookie non necessari e gestione granulare delle preferenze. Fonte: https://www.gpdp.it/web/guest/home/docweb/-/docweb-display/docweb/9677876
- EDPB Guidelines 05/2020 sul consenso confermano che il consenso deve essere libero, specifico, informato e inequivocabile. Fonte: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en

### AI Act

- L'art. 50 AI Act entra in applicazione il 2 agosto 2026 e impone trasparenza per sistemi AI che interagiscono direttamente con persone fisiche, salvo che sia ovvio dal contesto. Fonte consultata: https://artificialintelligenceact.eu/article/50/
- Raccomandazione: il primo messaggio WhatsApp deve dire chiaramente che l'utente sta parlando con l'assistente AI del Cliente.

### WhatsApp e rischio policy AI

- La Commissione Europea, nel comunicato del 15 aprile 2026, riporta che Meta aveva annunciato il 15 ottobre 2025 una modifica ai WhatsApp Business Solution Terms che di fatto bandiva assistenti AI general purpose dal 15 gennaio 2026, poi sostituita da un framework di pricing oggetto di indagine antitrust. Fonte: https://europa.eu/newsroom/ecpc-failover/pdf/ip-26-805_en.pdf
- Implicazione: Ambrogio.ai va mantenuto e descritto come assistente verticale per aziende, customer support e appuntamenti, non come chatbot general purpose distribuito su WhatsApp.

### Provider AI e voice

- Anthropic dichiara che, per prodotti commerciali come Anthropic API/Anthropic commercial products, di default non usa input/output per training dei modelli, salvo feedback/opt-in. Fonte: link ufficiale Anthropic privacy/model-training da archiviare
- Anthropic indica che il DPA con SCC e' incorporato nei Commercial Terms. Fonte consultata: supporto ufficiale Anthropic da archiviare
- ElevenLabs DPA aggiornato l'8 aprile 2026 disciplina trattamento come processor, subprocessor, breach, retention e SCC. Fonte: https://elevenlabs.io/dpa
- ElevenLabs Data Residency e' feature Enterprise; standard customer data e' hosted/stored in US, con opzioni EU/India e zero retention opzionale per casi sensibili. Fonte: https://elevenlabs.io/docs/overview/administration/data-residency
- Implicazione: per clienti sanitari o dati vocali sensibili va verificato Enterprise/EU/zero retention oppure limitare/evitare voice.

## Evidenze pricing

### Costi canale WhatsApp

- 360dialog indica che ogni WhatsApp Business channel richiede una subscription attiva. Regular Channel Tier: 49 EUR/mese, Premium: 99 EUR/mese, Higher Throughput: 249 EUR/mese. Fonte: https://docs.360dialog.com/docs/get-started/pricing
- 360dialog indica che messaging/call fees sono determinate da Meta rate cards e dipendono da categoria, paese/timezone WABA e volume.
- Implicazione: non si puo' assumere una quota BSP "condivisa" tra clienti se ogni cliente ha il proprio numero/canale. Questo impatta Starter e Agency.

### Benchmark AI receptionist e voice

- Goodcall pricing pubblico: Starter 79 USD/mese, Growth 129 USD/mese, Scale 249 USD/mese per agent, con unique customers inclusi e overage. Fonte: https://www.goodcall.com/pricing
- My AI Front Desk pricing pubblico: Basic 99 USD/mese, Growth 149 USD/mese, minuti voce limitati e overage a 0.25 USD/min sui piani non enterprise. Fonte: https://www.myaifrontdesk.com/pricing
- Bland AI pricing pubblico: Build 299 USD/mese + 0.12 USD/min, Scale 499 USD/mese + 0.11 USD/min, free start a 0.14 USD/min. Fonte: https://www.bland.ai/pricing
- Synthflow pricing pubblico: pay-as-you-go e Enterprise, con focus Voice AI e compliance. Fonte: https://synthflow.ai/pricing

### Benchmark WhatsApp automation

- Manychat offre piani economici da 15 USD/mese o Pro 39 USD/mese su nuovo modello, ma e' piattaforma automation generica e i costi WhatsApp/AI possono essere separati. Fonti: https://manychat.com/pricing e https://help.manychat.com
- Trengo si posiziona su team inbox/omnichannel con piani da circa 299-599 EUR/mese. Fonte: https://trengo.com/prices
- Wati mostra piani WhatsApp automation con message charges aggiuntive e automation triggers inclusi, ma prezzi principali possono dipendere da regione/rendering pagina. Fonte: https://www.wati.io/en/pricing/

## Inferenze

- Ambrogio.ai puo' sostenere prezzi piu' alti dei chatbot generici perche' vende setup verticale, appointment booking, WhatsApp ufficiale, vocali, compliance e human escalation.
- Il vecchio Starter a 97 euro/mese e' aggressivo e utile per beta, ma rischia margine basso se include 360dialog.
- Professional a 247 euro/mese e' competitivo; 299 euro/mese e' piu' sano se include voice e canale.
- Agency a 597 euro/mese per 10 clienti non e' sostenibile con 360dialog per numero.
- Il pricing pubblico deve distinguere "software Ambrogio" e "costi canale/provider pass-through" senza diventare opaco.

## Raccomandazioni

1. Pubblicare beta con Starter 97 e Professional 247 solo per early adopter e con note chiare sui costi canale.
2. Lanciare pubblico a Starter 149, Professional 299, Agency 897 con 5 clienti inclusi.
3. Aggiornare checkout/billing per tracciare costi reali per tenant.
4. Prima di clienti sanitari: DPIA, DPA vendor, retention audio e provider voice in EU/zero retention.
5. Evitare claim "GDPR compliant" assoluti; usare formule piu' difendibili tipo "progettato con impostazioni GDPR-first" finche' non c'e' audit legale.

## File aggiornati

- `05_LEGAL_GDPR/privacy_policy_template.md`
- `05_LEGAL_GDPR/terms_of_service.md`
- `05_LEGAL_GDPR/dpa_template.md`
- `05_LEGAL_GDPR/gdpr_checklist.md`
- `05_LEGAL_GDPR/cookie_policy_template.md`
- `05_LEGAL_GDPR/subprocessors.md`
- `05_LEGAL_GDPR/ropa_template.md`
- `01_STRATEGIA/pricing.md`
- `pricing.md`
