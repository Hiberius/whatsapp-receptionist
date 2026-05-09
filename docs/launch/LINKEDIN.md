# LinkedIn post — launch

**Why LinkedIn**: Italian SMB founders, EU SaaS investors, agency owners are here. Different audience from HN/Twitter, more conservative, more receptive to "trust + craft" angle than "hustle + ship".

**When to post**: Tuesday or Wednesday morning, 9–11 AM CET.

## Post (max 3000 char, ~600 words)

```
Tre settimane fa ho iniziato a costruire un AI receptionist per WhatsApp pensato per PMI italiane.

Oggi ho rilasciato l'intero codice come open source su GitHub. MIT licensed. Forkable per uso commerciale, senza chiedere il permesso.

Ecco perché.

🎯 IL PROBLEMA

Studi medici, centri estetici, palestre, studi professionali italiani perdono clienti ogni giorno per chiamate non risposte. Mediamente 8 chiamate fuori orario al giorno per uno studio dentistico medio. Solo 1 su 5 si converte in appuntamento il giorno dopo.

Il resto è cliente perso, deluso, o semplicemente trattenuto da un'altra preferenza.

🤖 LA SOLUZIONE

Un AI receptionist che riceve messaggi WhatsApp e vocali, capisce l'intent del cliente, prenota appuntamenti reali su Google Calendar, gestisce reminder e disdette, escala a un umano solo quando serve.

Stack tecnologico moderno: Next.js 15, Anthropic Claude, ElevenLabs per la voce, Supabase EU per il database con isolamento multi-tenant, Stripe per il billing, fatturazione elettronica SDI integrata via Fatture in Cloud.

GDPR Article 15 e 17 endpoints integrati. Hosting solo EU. PII redatto automaticamente nei log.

🌍 PERCHÉ OPEN SOURCE

Avevo costruito tutto pensando di lanciarlo come SaaS per il mercato italiano. Poi ho fatto i conti.

Il time-to-market è troppo lungo: la verifica Meta per WhatsApp Business richiede 1-3 settimane per ogni nuovo cliente. Le PMI italiane hanno cicli di vendita lunghi (60-90 giorni). Il pricing power è limitato a circa €100/mese, anche per studi che fatturano €30k/mese. I competitor closed-source hanno anni di vantaggio sulla GTM.

Le unit economics funzionano, ma l'acquisizione è brutale per una persona da sola.

Quindi ho cambiato strategia: il codice è troppo solido per restare in un cassetto. Lo apro e lo regalo alla community.

✅ COSA C'È DENTRO

→ 35 pagine frontend (landing, pricing, 4 verticali, dashboard, admin)
→ 37 API routes con Zod validation
→ 21 tabelle Supabase con Row-Level Security
→ Orchestrazione Anthropic Claude (intent, booking extraction, escalation)
→ WhatsApp Cloud API (testo + vocali)
→ Google Calendar OAuth con conflict detection
→ Stripe Subscriptions + SDI invoicing italiano
→ 369 test passing, CI completo
→ Docker self-host pronto

🇮🇹 CRAFTED IN ITALY

Documentazione bilingue (English + Italian). Codice in inglese, copy utente in italiano. Conformità SDI nativa. Conformità GDPR seria (non solo "abbiamo scritto la privacy policy").

🤝 PER CHI È UTILE

→ Sviluppatori che vogliono studiare un'architettura multi-tenant SaaS production-ready
→ Agenzie che vogliono offrire AI receptionist white-label ai loro clienti
→ Founder che vogliono partire da un boilerplate solido invece di scrivere da zero
→ Studi che vogliono self-hostare invece di pagare un SaaS

🔗 IL REPO

https://github.com/Hiberius/whatsapp-receptionist

Se costruite SaaS per il mercato europeo, vi potrebbe far risparmiare settimane di lavoro.

Se siete sviluppatori curiosi di TypeScript strict + Supabase RLS + Next.js 15 fatto bene, c'è codice da studiare.

Se siete founder italiani in difficoltà come me con la GTM, parliamo. Magari trovate un angolo che a me sfugge.

Una stella su GitHub mi dice di continuare a costruire.

Buona settimana a tutti. 🇮🇹

#opensource #saas #ai #whatsapp #italianTech #nextjs #anthropic
```

## Visual

Attach `docs/screenshots/social-preview.png` (1280×640).

## Tag strategy

Tag 2-3 persone direttamente in chat (non nel post): Italian dev community + EU SaaS investors. Es:

- Marco Cedaro (Italian frontend community)
- Andrea Saltarello (architect, has reach)
- Italian SaaS founders you know personally

Don't @-tag in the post body — looks spammy. Send a personal note via DM.

## Follow-up posts

After 1 week: post update with star count + first feedback received.
After 1 month: post case study if anyone forked it commercially.
