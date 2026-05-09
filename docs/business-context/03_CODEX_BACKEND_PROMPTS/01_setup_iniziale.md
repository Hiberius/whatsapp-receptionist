# PROMPT 01 - SETUP INIZIALE REPOSITORY

Usa questo prompt all'inizio del progetto, appena hai finito di creare gli account (GitHub, Vercel, Supabase, etc).

---

## PROMPT OPERATIVO CODEX

Ho letto il file di contesto progetto (00_context_project.md). Ora iniziamo il setup del repository. Fai tutti i seguenti task in ordine, fermandoti dopo ogni step per darmi feedback su cosa hai fatto prima di procedere.

STEP 1 - Inizializza progetto Next.js 15

- Crea nuovo progetto Next.js con: npx create-next-app@latest ambrogio-ai --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint
- Aggiorna a Next.js 15 se non e' gia' l'ultima versione
- Inizializza git repository
- Crea primo commit "Initial project setup"

STEP 2 - Installa dipendenze core

Installa queste dipendenze esatte:
- @supabase/supabase-js (ultima versione)
- @supabase/ssr (per Next.js App Router)
- @anthropic-ai/sdk (ultima versione)
- @elevenlabs/elevenlabs-js (vocali WhatsApp: speech-to-text + text-to-speech)
- zod (validazione)
- react-hook-form + @hookform/resolvers
- @upstash/redis + @upstash/ratelimit
- @trigger.dev/sdk (background jobs)
- stripe (latest)
- pino (logging)
- @sentry/nextjs (error monitoring)
- posthog-js + posthog-node
- nanoid (IDs)
- date-fns (date manipulation)
- sonner (toast notifications)

Dipendenze dev:
- @types/node
- vitest + @vitejs/plugin-react
- @playwright/test
- prettier + prettier-plugin-tailwindcss
- gitleaks (pre-commit)

STEP 3 - Configura shadcn/ui

Esegui:
- npx shadcn@latest init con: New York style, Neutral base color, CSS variables yes
- Installa componenti base: button, card, dialog, input, label, form, select, textarea, toast, dropdown-menu, avatar, badge, table

STEP 4 - File di configurazione

Crea i seguenti file con best practices:

1. tsconfig.json con strict mode attivato e tutti i controlli severi:
   - strict: true
   - noUncheckedIndexedAccess: true
   - noImplicitOverride: true
   - paths per @/components, @/lib, @/hooks, @/types

2. .gitignore completo (node_modules, .env*, .next, dist, build, coverage, .vercel, *.log)

3. .prettierrc con: semi: true, singleQuote: true, trailingComma: all, tabWidth: 2

4. src/lib/env.ts - parsing environment variables con Zod:
   ```typescript
   import { z } from 'zod'
   
   const envSchema = z.object({
     NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
     NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
     SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
     ANTHROPIC_API_KEY: z.string().min(1),
     ELEVENLABS_API_KEY: z.string().min(1),
     ELEVENLABS_STT_MODEL: z.string().default('scribe_v2'),
     ELEVENLABS_TTS_MODEL: z.string().default('eleven_flash_v2_5'),
     ELEVENLABS_DEFAULT_VOICE_ID: z.string().min(1),
     STRIPE_SECRET_KEY: z.string().min(1),
     STRIPE_WEBHOOK_SECRET: z.string().min(1),
     UPSTASH_REDIS_REST_URL: z.string().url(),
     UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
     WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
     // aggiungi altre chiavi
   })
   
   export const env = envSchema.parse(process.env)
   ```

5. .env.example con tutte le chiavi ma valori vuoti o placeholder

6. src/lib/supabase/server.ts - client server-side con cookie handling Next.js 15
7. src/lib/supabase/client.ts - client browser-side
8. src/lib/supabase/middleware.ts - middleware auth per App Router

STEP 5 - Pre-commit hook per sicurezza

- Installa husky
- Configura pre-commit hook che esegue:
  - gitleaks detect --staged (per secrets)
  - prettier --check su file modificati
  - tsc --noEmit (type check)
- Se uno fallisce, blocca il commit

STEP 6 - README.md del repo

Crea README.md con:
- Descrizione progetto (breve)
- Stack tecnico
- Come fare setup locale (node version, npm install, cp .env.example .env.local, etc)
- Come fare deploy su Vercel
- NOTA: questo repo e' privato e proprietario. NON condividere.

STEP 7 - GitHub repository

- Crea repo privato su GitHub con nome "ambrogio-ai"
- Push iniziale
- Attiva branch protection su "main":
  - Require pull request reviews (almeno 1)
  - Require status checks to pass
  - No force push
  - No deletions

STEP 8 - Vercel deployment

- Collega il repo a Vercel
- Configura dominio custom (ambrogio.ai)
- Aggiungi tutte le env variables su Vercel (production + preview + development separate)
- Deploy iniziale deve mostrare solo una landing "Coming soon"

STEP 9 - Security headers Next.js

Crea next.config.ts con security headers:
- Strict-Transport-Security con preload
- X-Content-Type-Options nosniff
- X-Frame-Options DENY
- Content-Security-Policy strict
- Referrer-Policy strict-origin-when-cross-origin
- Permissions-Policy minimale

STEP 10 - Test finale setup

Esegui:
- npm run build (deve passare)
- npm run dev (deve partire senza errori)
- Verifica che deploy Vercel funzioni
- Verifica che git push passi i pre-commit hook

Dopo ogni step fammi un breve report di cosa hai fatto, eventuali errori, e cosa dovrei verificare manualmente prima di procedere.

IMPORTANTE: se qualcosa non funziona, NON inventare workaround. Fermati, spiega il problema, suggerisci 2-3 opzioni, e chiedi come procedere.
