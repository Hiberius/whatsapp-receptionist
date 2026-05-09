# PROMPT 09 - ADMIN PANEL (SUPER-ROOT)

Dashboard riservato solo a te e al massimo 1-2 persone fidate. Gestisce tutti i tenant, monitora salute sistema, gestisce escalation e supporto.

## PROMPT OPERATIVO CODEX

Costruisci un admin panel separato dal dashboard cliente. Accessibile solo a utenti con role='super_admin' (definiti manualmente in DB, mai via signup pubblico).

STEP 1 - Protezione admin

- Route /admin/* protetta da middleware aggiuntivo che verifica role='super_admin'
- 2FA obbligatoria SEMPRE (nessuna eccezione)
- IP allowlist opzionale (solo IP whitelisted possono accedere, configurabile in env)
- Session timeout piu' aggressivo (2 ore invece di 7 giorni)
- Ogni azione admin loggata in audit_log con flag is_admin_action=true
- Re-auth password obbligatoria per azioni distruttive

STEP 2 - Overview globale

/admin/dashboard:
- MRR totale + trend ultimi 12 mesi
- Clienti attivi totali / trial / churned
- Messaggi processati oggi / mese
- Costi AI aggregati (Anthropic API spend)
- Top 10 clienti per utilizzo
- Alert attivi (sistema, pagamenti falliti, escalation pending)

STEP 3 - Tenant management

/admin/tenants:
- Tabella tutti i tenant con filtri (plan, status, country, business_type)
- Search full-text
- Per ogni tenant: impersonate, sospendi, cancella, forza migrazione piano
- Detail view: utilizzo mensile, storico billing, conversazioni count, last activity
- Export CSV filtrato

STEP 4 - Conversazioni globale view

/admin/conversations:
- Vista cross-tenant (solo per debug/supporto, con accesso giustificato e loggato)
- Richiedi motivazione testuale prima di aprire conversazione specifica
- Tutto loggato in audit (data, ragione, duration)

STEP 5 - Cost monitoring

/admin/costs:
- Spend Anthropic API per giorno / mese
- Break-down per tenant (quali clienti costano di piu')
- Alert se cliente ha costi >40% del suo MRR (cliente non profittevole)
- Spend WhatsApp API per tenant
- Totale costs vs revenue: margin dashboard

STEP 6 - Health monitoring

/admin/health:
- Status check: DB, Redis, Supabase, Vercel, Anthropic, 360dialog, Stripe
- Ultimi errori Sentry (top 20)
- Webhook failures ultimi 24h
- Rate limit hits
- Queue size Trigger.dev

STEP 7 - Support tools

/admin/support:
- Ticket system semplice (issue, tenant, status, note)
- Quick actions: reset password cliente, reinvia email verifica, estendi trial
- Knowledge base interna: pattern di problemi comuni + soluzioni
- Export log conversazione per cliente (per debug approfondito)

STEP 8 - Prompt management

/admin/ai-prompts:
- Editor WYSIWYG per system prompts
- Versioning (storico modifiche con autore e timestamp)
- A/B test launcher: assegna % tenants su prompt variant
- Metrics per prompt version: accuracy, escalation rate, customer satisfaction

STEP 9 - Notification system

Alert configurabili:
- Email + Slack (se webhook configurato) su eventi critici:
  - Nuovo cliente paga (celebrate!)
  - Cliente cancella (investiga)
  - Error rate > 1%
  - DB connection issue
  - Payment fallito
  - Tenant supera 80% quota

STEP 10 - Audit log viewer

/admin/audit:
- Vista filtrata audit_log (per tenant, user, action, date range)
- Search full-text
- Export per compliance (GDPR, richieste Garante)
- Retention 2 anni

Test:
- Login super_admin funziona
- Altri role non accedono a /admin/*
- Ogni azione admin loggata
- Impersonation non permette DELETE su tabelle critiche
