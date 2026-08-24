# Dependency audit — decisioni esplicite

Questo documento registra le vulnerabilità note che **non** vengono corrette, con
la ragione. Una vulnerabilità ignorata senza motivo scritto diventa, dopo poche
settimane, una vulnerabilità dimenticata.

Il gate di CI è `npm audit --omit=dev --audit-level=high`: **zero vulnerabilità
nelle dipendenze di produzione**, senza eccezioni.

## Stato

| Ambito | Stato |
|---|---|
| Dipendenze di produzione | 0 vulnerabilità |
| Dipendenze di sviluppo | 2 avvisi alti aperti (sotto) |

Ultima verifica: `npm audit --omit=dev` → 0 vulnerabilità; `npm audit` → 2
vulnerabilità alte, entrambe solo di sviluppo.

## Accettate

### `brace-expansion` ≤ 1.1.17 e 4.0.0–5.0.8 — DoS per espansione illimitata

- **Dove:** esclusivamente di sviluppo. `1.1.16` dentro l'albero di ESLint
  (`@eslint/config-array`, `@eslint/eslintrc`, `eslint-plugin-*`, via
  `minimatch@3`), `5.0.8` via `@typescript-eslint/parser` (`minimatch@10`).
- **Stato delle versioni corrette:** l'avviso è stato esteso e ora copre anche
  la `5.0.8`, che una versione precedente di questo documento indicava come
  l'unica release corretta — quell'affermazione non è più vera. Al momento
  esistono `1.1.18` sulla linea 1.x e `5.0.9` sulla 5.x.
- **Perché non è corretta qui:** un override forzato su questo pacchetto ha già
  rotto ESLint in passato (`TypeError: expand is not a function`: il `minimatch`
  incluso in ESLint si aspetta il default CJS della linea precedente). Le
  versioni nuove sono compatibili sulla carta, ma vanno verificate eseguendo il
  lint, non assunte. Finché quella verifica non è fatta, non si tocca.
- **Perché è accettabile nel frattempo:** l'input di quel `brace-expansion` sono
  i pattern glob della nostra configurazione ESLint, scritti da noi e
  versionati. Non è raggiungibile da input esterno né presente nel bundle di
  produzione.
- **Quando riaprirla:** al prossimo intervento autorizzato sulle dipendenze di
  sviluppo. Il passo è: alzare a `1.1.18` / `5.0.9`, eseguire `npm run lint`, e
  tenere l'override solo se il lint resta eseguibile.

### `js-yaml` 4.0.0–4.3.0 — consumo quadratico di CPU su `!!omap`

- **Dove:** solo di sviluppo, via `@eslint/eslintrc`.
- **Perché non è corretta:** l'override attivo (`^4.3.0`) è stato aggiunto per
  un avviso precedente e oggi risolve proprio a una versione coperta dal nuovo
  avviso. La `4.3.1` è pubblicata e sarebbe un bump di patch dentro l'override
  esistente, ma esula dalla delega di questo passaggio, limitata alla sola
  correzione dell'avviso di produzione su `nanoid`.
- **Quando riaprirla:** al prossimo intervento autorizzato sulle dipendenze di
  sviluppo, alzando l'override a `^4.3.1`.

## Corrette

### `nanoid` < 3.3.18 — loop infinito con generatori custom e `size` zero

- **Dove:** dipendenza di **produzione**, via `next` → `postcss` → `nanoid`.
  Era l'unico avviso che faceva fallire il gate di CI sulle dipendenze di
  produzione.
- **Come è stata corretta:** aggiunto `"nanoid": "^3.3.18"` agli `overrides` di
  `package.json`. `postcss` dichiara `^3.3.17`, quindi la `3.3.18` rientra nel
  suo range: nessun bump major, nessun cambio di `postcss`. Il lockfile cambia
  di una sola voce.
- **Verifica:** `npm ci && npm audit --omit=dev` → 0 vulnerabilità.

## Override attivi

Definiti in `package.json` → `overrides`. Ognuno esiste per portare una
dipendenza transitiva a una versione corretta che il pacchetto padre non ha
ancora adottato:

| Pacchetto | Motivo |
|---|---|
| `postcss` | Path traversal e lettura arbitraria di file via `sourceMappingURL` |
| `sharp` | CVE ereditate da libvips (CVE-2026-33327/33328/35590/35591) |
| `ws` | Divulgazione di memoria non inizializzata + DoS per esaurimento memoria |
| `js-yaml` | DoS a complessità quadratica sulle merge key |
| `nanoid` | Loop infinito con generatori custom e `size` zero (avviso di produzione) |
| `vite` | Bypass di `server.fs.deny` su path alternativi Windows |

Gli override vanno rimossi quando il pacchetto padre aggiorna la propria
dipendenza: un override dimenticato blocca gli aggiornamenti futuri.
