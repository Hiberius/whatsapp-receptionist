# Mega Code Review - Backend Foundation

Fatto da Codex il 24 aprile 2026.

## Scope

Review di backend, schema Supabase, webhook WhatsApp, error handling, rate limiting, logging, test e supply-chain audit.

## Finding corretti

### P1 - RLS leggeva solo claim top-level

Il DB usava `auth.jwt() ->> 'tenant_id'` e `auth.jwt() ->> 'role'`. Supabase espone spesso questi dati dentro `app_metadata`, mentre il backend gia' leggeva `data.user.app_metadata`. Risultato possibile: RLS nega tutto anche a utenti validi.

Fix:

- `current_tenant_id()` legge sia top-level sia `app_metadata.tenant_id`.
- `current_tenant_role()` legge sia top-level sia `app_metadata.role`.
- Validazione UUID per evitare cast error in policy.
- `scripts/check-rls-migration.mjs` verifica questi snippet.

### P1 - RPC `increment_usage_metrics` troppo esposta

La funzione era `security definer` e poteva risultare eseguibile da ruoli non voluti via RPC. Per funzioni che aggiornano usage/billing e girano con privilegi elevati serve revoca esplicita.

Fix:

- `revoke execute ... from public, anon, authenticated`.
- `grant execute ... to service_role`.
- Lint migration controlla revoca e grant.

### P1 - Webhook retry poteva perdere eventi falliti

Se il webhook veniva registrato in `webhook_events`, poi falliva durante insert messaggio/metriche, il servizio poteva rispondere 200 al provider e lasciare l'evento `failed`, senza retry reale.

Fix:

- `processPayload()` ora torna 502 se ci sono errori transitori di processing.
- Gli eventi `failed` vengono riaperti al retry.
- Gli eventi `received` stale vengono ripresi dopo 60 secondi.
- Tenant non risolto resta non-retryable: viene registrato e il provider riceve 200 per evitare loop inutili.

### P2 - Rate limit in-memory non sufficiente in produzione serverless

Il limiter in-memory e' utile in locale ma non condivide stato tra istanze.

Fix:

- Se Upstash e' configurato, il webhook usa `@upstash/ratelimit` con sliding window.
- In locale/test resta fallback in-memory.

### P2 - `npm audit` segnalava PostCSS vulnerabile dentro Next

`npm audit` segnalava `postcss <8.5.10` transitivo da Next. `npm audit fix --force` proponeva un downgrade errato a Next 9.

Fix:

- Aggiunto `postcss@^8.5.10`.
- Aggiunto `overrides.postcss`.
- `npm audit --audit-level=moderate` ora passa con 0 vulnerabilita'.

### P2 - Schema integrations bloccava numeri multipli

`unique(tenant_id, provider)` avrebbe impedito piu' numeri WhatsApp per tenant, incoerente con add-on futuri.

Fix:

- Rimossa unique constraint semplice.
- Aggiunto unique index su `(provider, external_account_id)` quando `external_account_id` e' presente.
- Aggiunto singleton index su `(tenant_id, provider)` solo quando `external_account_id` e' null.

### P3 - Logging test rumoroso e redaction incompleta

I test stampavano warning strutturati e la redaction non copriva alcune chiavi comuni.

Fix:

- Logger in `silent` durante `NODE_ENV=test`, salvo `LOG_LEVEL` esplicito.
- Redaction estesa a cookie, set-cookie, api_key, access/refresh token.

## Verifiche eseguite

- `npm run verify`: passato.
- `npm run build`: passato.
- `npm audit --audit-level=moderate`: passato, 0 vulnerabilita'.
- Scansione vecchio naming: 0 occorrenze.
- Scan quick-smell su `src/tests/scripts/supabase`: nessun `TODO/FIXME`, `z.any`, `select('*')` o `throw new Error` nel runtime applicativo. Restano `console.*` solo in script CLI.

## Note residue

- L'ambiente locale usa Node 20.18.0, mentre `package.json` richiede Node `>=22 <23`. Npm mostra warning `EBADENGINE`; CI e deployment devono usare Node 22.
- Manca ancora un test integrazione Supabase reale per RLS tenant A/B. Va fatto appena c'e' Supabase locale o test project.
- Prossimo backend step consigliato: sender WhatsApp con retry/backoff, poi download media audio e ElevenLabs STT.
