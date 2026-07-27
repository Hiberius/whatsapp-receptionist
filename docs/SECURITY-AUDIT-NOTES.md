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
| Dipendenze di sviluppo | 1 avviso accettato (sotto) |

## Accettate

### `brace-expansion` ≤ 5.0.7 — DoS per espansione illimitata

- **Dove:** esclusivamente dentro l'albero di ESLint
  (`@eslint/config-array`, `@eslint/eslintrc`, `eslint-plugin-*`).
- **Perché non è corretta:** l'unica versione corretta è la `5.0.8`, che cambia
  la forma degli export. Il `minimatch` incluso in ESLint si aspetta il default
  CJS della linea precedente e con l'override fallisce con
  `TypeError: expand is not a function`, rendendo il lint ineseguibile. Non
  esistono backport corrette sulle linee 2.x/3.x/4.x.
- **Perché è accettabile:** l'input di quel `brace-expansion` sono i pattern
  glob della nostra configurazione ESLint, scritti da noi e versionati. Non è
  raggiungibile da input esterno né presente nel bundle di produzione.
- **Quando riaprirla:** quando ESLint aggiornerà il proprio `minimatch` a una
  versione compatibile con `brace-expansion@5`. Da verificare a ogni bump major
  di ESLint.

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
| `vite` | Bypass di `server.fs.deny` su path alternativi Windows |

Gli override vanno rimossi quando il pacchetto padre aggiorna la propria
dipendenza: un override dimenticato blocca gli aggiornamenti futuri.
