# SUB-RESPONSABILI E FORNITORI - BOZZA PUBBLICA

Preparato da Codex il 24 aprile 2026. Da pubblicare su `/subprocessors` dopo verifica e archiviazione dei DPA.

## Come leggere questa lista

Ambrogio.ai usa fornitori terzi per erogare hosting, database, AI, voice AI, pagamenti, messaggistica e sicurezza. Alcuni agiscono come sub-responsabili per conto di Ambrogio.ai; altri possono agire come titolari autonomi o secondo ruoli misti definiti dai loro termini.

## Sub-responsabili previsti

| Fornitore | Servizio | Dati trattati | Area/garanzie | Stato |
| --- | --- | --- | --- | --- |
| Supabase | Database, Auth, Storage | Account, tenant, conversazioni, messaggi, appuntamenti | Regione EU da configurare, DPA | Da verificare |
| Vercel | Hosting, edge/runtime | Richieste HTTP, log tecnici, dati applicativi necessari | Regione EU ove configurabile, DPA/SCC | Da verificare |
| Anthropic | Modelli AI Anthropic | Prompt, contesto conversazione minimizzato, risposte | Commercial terms, DPA/SCC, no training default su commercial/API | Da archiviare |
| ElevenLabs | Speech-to-text e text-to-speech | Audio vocali, testo da sintetizzare, metadati tecnici | DPA/SCC, EU data residency/zero retention per Enterprise | Da archiviare |
| 360dialog | WhatsApp Business API/BSP | Messaggi, media, metadati WhatsApp | Germania/EU dichiarata, pricing e DPA da verificare | Da verificare |
| Meta / WhatsApp | Piattaforma WhatsApp/Instagram | Messaggi, profili, metadati, template | Termini Meta/WhatsApp applicabili | Da verificare |
| Google | Google Calendar API | Eventi calendario, disponibilita', account OAuth | DPA/termini Google, scope minimi | Da verificare |
| Stripe | Pagamenti, fatture, subscription | Dati pagamento, billing, fatture | Stripe Payments Europe, DPA/ruoli specifici | Da verificare |
| Cloudflare | DNS, CDN, WAF, sicurezza | IP, log tecnici, traffico web | DPA/SCC | Da verificare |
| Sentry | Error monitoring | Errori, stack trace, log tecnici redatti | DPA/SCC, payload minimizzati | Da verificare |
| PostHog | Product analytics | Eventi prodotto, user/tenant id pseudonimi | Preferire EU Cloud o self-hosted | Da verificare |
| Resend | Email transazionali | Email, template transazionali, log consegna | DPA/SCC | Da verificare |

## Regole interne per aggiungere un fornitore

1. Verificare DPA, SCC o base trasferimento.
2. Verificare regione dati e retention.
3. Verificare se il provider usa customer data per training o miglioramento modelli.
4. Verificare subprocessor del provider se rilevante.
5. Aggiornare questa pagina con almeno 30 giorni di preavviso se il DPA Cliente lo richiede.
6. Aggiornare Privacy Policy e DPA se cambia categoria dati o finalita'.

## Note operative interne

- Fatto da Codex.
- Non pubblicare "verificato" finche' il PDF/link DPA non e' archiviato in cartella legale interna.
- Per clienti sanitari o vocali: Anthropic, ElevenLabs, storage media e Sentry sono i provider piu' sensibili.
