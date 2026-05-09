# CODEX - CONTEXT PROJECT (LEGGI PRIMA)

Questo e' il file di contesto principale che Codex DEVE leggere all'inizio di OGNI sessione prima di scrivere codice. Incolla questo intero file come primo messaggio quando inizi a lavorare con Codex.

---

## PROGETTO

Nome: Ambrogio.ai (modifica se hai scelto altro nome)
Descrizione: SaaS multi-tenant che fornisce AI receptionist su WhatsApp/DM per PMI italiane (dentisti, estetisti, veterinari, palestre, studi professionali). Modello di riferimento: Bookedin.ai (USA).

Founder: Christian Calabro' (Malta-based, clienti IT/MENA)

---

## STACK TECNICO DEFINITIVO

Non deviare da questo stack a meno che non ti venga detto esplicitamente:

Frontend:
- Next.js 15 con App Router
- TypeScript in strict mode
- Tailwind CSS 4
- shadcn/ui per componenti base
- Lucide Icons per icone
- React Hook Form + Zod per validazione

Backend:
- Next.js API routes + Server Actions
- Supabase (Postgres + Auth + Storage + Realtime)
- Region: EU-West (Francoforte) per GDPR
- Trigger.dev per background jobs e queue
- Upstash Redis per caching e rate limiting

AI:
- Anthropic API
- Anthropic Haiku 4.5 (model ID Anthropic configurato via env) per intent routing veloce
- Anthropic Sonnet 4.6 (model ID Anthropic configurato via env) per conversazioni complesse
- pgvector su Supabase per embeddings/RAG
- ElevenLabs per vocali WhatsApp:
  - Speech-to-Text `scribe_v2` per trascrivere note vocali dei pazienti/clienti
  - Text-to-Speech `eleven_flash_v2_5` per risposte vocali opzionali

Integrazioni:
- WhatsApp Business via 360dialog BSP (BSP certificato Meta EU)
- Instagram DM via Meta Graph API
- Google Calendar API (OAuth 2.0)
- Cal.com (self-hosted or API)
- Calendly API (fase 2)
- Stripe per subscription billing (Italia, IVA 22%)
- Resend per email transazionali (EU region)

Infrastruttura:
- Vercel Pro per hosting Next.js
- Cloudflare come CDN + WAF davanti a Vercel
- Cloudflare R2 per backup file
- PostHog per product analytics
- Sentry per error monitoring

---

## PRINCIPI DI CODICE (NON NEGOZIABILI)

1. TypeScript strict mode sempre. Mai "any" senza giustificazione.
2. Ogni funzione esportata ha JSDoc minima (parametri + return + errori).
3. Ogni API route valida input con Zod prima di processare.
4. Ogni accesso al DB passa per Row Level Security. MAI bypassare RLS con service_role nel client.
5. Server Components di default. Client Components solo quando necessario (stato, eventi, hooks).
6. Environment variables sempre via process.env.* tipizzate in un file env.ts con Zod.
7. Nessun secret hardcodato. Mai. Pre-commit hook gitleaks attivo.
8. Error handling: mai "throw new Error('something')", sempre errori tipizzati custom.
9. Logging strutturato con Pino (JSON logs) inviato a Sentry.
10. Test: Vitest per unit, Playwright per E2E critici (login, pagamento, webhook WhatsApp).

---

## MULTI-TENANCY (CRITICO)

Modello: shared database, shared schema, isolated by tenant_id + RLS.

Ogni tabella con dati tenant-specifici DEVE avere:
- Colonna tenant_id uuid NOT NULL (foreign key a tenants.id)
- Index su tenant_id
- RLS enabled
- Policy RLS che filtra WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid

JWT claim custom "tenant_id" aggiunto in supabase auth hook al login. Ogni query passa automaticamente il filtro.

Eccezioni (tabelle globali senza tenant_id):
- tenants (la tabella maestra)
- plans (piani di pricing)
- countries, cities (reference data)
- audit_log (ha tenant_id ma accessibile solo admin super-root)

---

## SICUREZZA (NON NEGOZIABILE)

1. RLS su OGNI tabella. Senza eccezioni.
2. Rate limiting per-IP e per-tenant su ogni endpoint pubblico (Upstash Ratelimit)
3. Webhook verification adeguata al provider: Stripe HMAC; WhatsApp/360dialog con header segreto custom + idempotenza/replay protection, HMAC Meta solo se disponibile nello specifico setup.
4. CSRF protection su form (Next.js built-in con Server Actions)
5. Content Security Policy strict headers
6. HSTS con preload
7. Cookie: httpOnly, secure, sameSite=strict
8. Admin panel: 2FA obbligatorio (TOTP via Supabase Auth MFA)
9. Audit log immutabile per azioni sensibili (append-only, no UPDATE/DELETE)
10. Password hashing gestito da Supabase Auth (bcrypt sotto il cofano)
11. Session timeout: 7 giorni rolling, re-auth per azioni critiche (cancellazione, billing)
12. Input sanitization: DOMPurify per qualunque HTML user-generated

---

## GDPR COMPLIANCE (CRITICO PER IL MERCATO IT)

1. Data residency: TUTTO in EU (Supabase EU region, Vercel Frankfurt, Resend EU)
2. Crittografia at-rest (default Supabase) e in-transit (HTTPS ovunque)
3. Retention policy: conversazioni cancellate automaticamente dopo 24 mesi (configurable dal cliente)
4. Diritto all'oblio: endpoint /api/gdpr/delete-me che cancella tutti i dati dell'utente finale
5. Diritto di accesso: endpoint /api/gdpr/export-data che esporta dati in JSON
6. Consensi espliciti: checkbox granulari (non precheckati), salvati con timestamp e IP
7. Cookie banner compliant (Tarte, Cookiebot, o custom con Zaraz)
8. Privacy policy linkata in footer e checkout
9. DPA template disponibile per clienti (fase Professional e Agency)
10. Log di audit GDPR: chi ha acceduto a quali dati quando

---

## CONVENZIONI NAMING

File:
- kebab-case per file: user-profile.tsx, whatsapp-webhook.ts
- PascalCase per componenti React: UserProfile.tsx OK se componente
- camelCase per funzioni e variabili
- SCREAMING_SNAKE_CASE per costanti globali

Database:
- snake_case per tabelle e colonne: conversations, message_logs
- Tabelle al plurale: tenants, users, conversations
- Colonne timestamp: created_at, updated_at, deleted_at (soft delete)
- Foreign key: {entity_name}_id (tenant_id, user_id)

API endpoints:
- RESTful: /api/conversations (GET), /api/conversations/:id (GET, PATCH, DELETE)
- Webhook: /api/webhook/whatsapp, /api/webhook/stripe
- Azioni: /api/actions/send-reminder, /api/actions/book-appointment

---

## FLUSSI CRITICI

### Flusso 1: Messaggio WhatsApp in ingresso
1. WhatsApp -> webhook /api/webhook/whatsapp
2. Verifica header segreto custom 360dialog; aggiungi firma Meta/HMAC solo se disponibile nel setup reale
3. Parse payload, identifica tenant dal numero destinatario
4. Inserisci messaggio in tabella "messages" con status=pending
5. Queue job Trigger.dev: process-incoming-message
6. Job: carica context (ultimi 20 messaggi, FAQ studio, calendario disponibilita')
7. Intent routing con Anthropic Haiku (classifica: appointment, info, emergency, other)
8. Se "appointment": chiama Anthropic Sonnet con tools (check_calendar, book_slot, send_confirmation)
9. Se "info": Anthropic Sonnet con RAG sulla knowledge base dello studio
10. Se "emergency" o "other": escalation umana, notifica titolare
11. Salva risposta in DB, invia via WhatsApp API, log audit

### Flusso 1B: Vocale WhatsApp in ingresso
1. WhatsApp -> webhook /api/webhook/whatsapp con `message.type = audio`
2. Scarica media audio via 360dialog
3. Salva audio originale in storage tenant-scoped
4. ElevenLabs Speech-to-Text (`scribe_v2`) trascrive il vocale
5. Salva transcript in `messages.transcript_text`
6. Orchestrator AI tratta il transcript come messaggio utente, ma conserva `message_type = audio`
7. Se abilitato dal tenant, genera risposta vocale con ElevenLabs TTS (`eleven_flash_v2_5`)
8. Invia risposta come nota vocale WhatsApp solo se non ci sono guardrail/emergenze/escalation

### Flusso 2: Onboarding nuovo cliente
1. Registrazione con email/password (o SSO Google)
2. Email verifica
3. Wizard: dati studio, settore, orari apertura
4. Connessione WhatsApp Business (OAuth 360dialog)
5. Connessione Google Calendar (OAuth)
6. Upload FAQ (PDF o testo)
7. Test conversazione (cliente invia WhatsApp al proprio bot per testare)
8. Attivazione trial 14 giorni
9. Reminder email day 7, day 12, day 14 per checkout Stripe

### Flusso 3: Escalation umana
1. AI rileva che non sa rispondere (confidence < 0.7) o intent = emergency
2. Invia messaggio "Un attimo, ti metto in contatto con l'ufficio" al cliente finale
3. Notifica al titolare via: email + push app (fase 2) + SMS (fase 3)
4. Titolare puo' rispondere dal dashboard, messaggio viene inviato come se fosse l'AI
5. Dopo 3 minuti senza risposta titolare, AI manda fallback "ti richiamiamo appena possibile"
6. Log escalation per analytics

---

## QUANDO IN DUBBIO

Se non e' chiaro come implementare qualcosa:
1. Chiedi, non inventare
2. Se devi fare un trade-off, scegli sicurezza > velocita' > features
3. Se devi aggiungere una dipendenza, verifica: e' mantenuta? ha piu' di 10k star GitHub? e' nel Vercel Community?
4. Per query DB: preferisci sempre Supabase client con tipi generati vs raw SQL
5. Per stato globale: useState + Context per semplice, Zustand per complesso, Redux mai

---

## COSA NON FARE MAI

- Non usare librerie WhatsApp non ufficiali (Baileys, venom, whatsapp-web.js) - solo Meta Cloud API / BSP ufficiali
- Non esporre service_role key mai al client
- Non loggare mai password, token, chiavi API nei log
- Non committare mai .env files
- Non usare alert() o confirm() browser native - sempre toast/dialog custom
- Non fare chiamate API fetch() senza timeout
- Non salvare file user-uploaded direttamente su filesystem - solo Supabase Storage con policies
- Non usare <img src=... /> - sempre Next.js Image component
- Non implementare auth custom - usa sempre Supabase Auth
- Non scrivere query RAW SQL nel codice app - usa Supabase client con types generati
