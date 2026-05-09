# Contributing to whatsapp-receptionist

First off — thank you for taking the time to contribute. This project is open
source under the MIT License, and contributions of any kind (code, docs, bug
reports, ideas) are welcome.

> Please read and abide by our [Code of Conduct](./CODE_OF_CONDUCT.md) before
> participating. We expect contributors to be respectful and inclusive.

## Table of contents

- [Quick links](#quick-links)
- [Ways to contribute](#ways-to-contribute)
- [Local setup](#local-setup)
- [Branch naming convention](#branch-naming-convention)
- [Commit messages — Conventional Commits](#commit-messages--conventional-commits)
- [Pull request process](#pull-request-process)
- [Testing requirements](#testing-requirements)
- [Using Claude Code to contribute](#using-claude-code-to-contribute)
- [Reporting issues](#reporting-issues)
- [Recognition](#recognition)

## Quick links

- [Architecture overview](./docs/ARCHITECTURE.md)
- [Deployment guide](./docs/DEPLOYMENT.md)
- [Database schema and RLS](./docs/DATABASE.md)
- [API contract](./docs/api-contract.md) ([quick reference](./docs/api-quick-reference.md))
- [Roadmap](./docs/ROADMAP.md)
- [FAQ](./docs/FAQ.md)
- [Security policy](./SECURITY.md)

## Ways to contribute

| Type            | What to do                                                            |
| --------------- | --------------------------------------------------------------------- |
| Bug report      | Open a [bug issue](./.github/ISSUE_TEMPLATE/bug_report.yml)           |
| Feature request | Open a [feature issue](./.github/ISSUE_TEMPLATE/feature_request.yml)  |
| Question        | Open a [question issue](./.github/ISSUE_TEMPLATE/question.yml)        |
| Documentation   | PR directly against `main` with the `docs:` prefix                    |
| Code            | Fork → branch → tests → PR. See workflow below                        |
| Security issue  | **Do not** open a public issue. Read [SECURITY.md](./SECURITY.md)     |

## Local setup

Prerequisites:

- Node.js `>=22 <23` (see `package.json#engines`)
- npm 10+ (or pnpm/bun if you adapt the scripts yourself)
- A free Supabase project (EU region recommended)
- A free Upstash Redis database
- An Anthropic API key (or OpenAI as fallback)
- Optional: Stripe test keys, ElevenLabs key, Meta WhatsApp Business sandbox

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/whatsapp-receptionist.git
cd whatsapp-receptionist

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Fill in your keys — see docs/DEPLOYMENT.md for what each var means

# 4. Apply database migrations
npx supabase db push

# 5. Start the dev server
npm run dev
# → http://localhost:3000
```

Verify your setup with the quality gate:

```bash
npm run verify
# typecheck + lint + test + db:lint
```

If `verify` is green you are ready to start coding.

## Branch naming convention

Always branch from `main`. Use one of these prefixes:

| Prefix      | Use for                                          | Example                                  |
| ----------- | ------------------------------------------------ | ---------------------------------------- |
| `feat/`     | new user-facing capability                       | `feat/calendar-cancel-flow`              |
| `fix/`      | bug fix                                          | `fix/whatsapp-webhook-timing-attack`     |
| `docs/`     | documentation only                               | `docs/architecture-mermaid-update`       |
| `chore/`    | tooling, dependencies, config                    | `chore/bump-next-15.5`                   |
| `refactor/` | internal change, no user-visible behaviour       | `refactor/extract-booking-extractor`     |
| `test/`     | tests only                                       | `test/voice-pipeline-fallback`           |
| `perf/`     | performance optimisation                         | `perf/intent-router-cache`               |
| `ci/`       | CI / GitHub Actions / hooks                      | `ci/add-coverage-gate`                   |

Use `kebab-case`. Keep branches short-lived; rebase on `main` regularly.

## Commit messages — Conventional Commits

We follow [Conventional Commits 1.0](https://www.conventionalcommits.org/).

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer with BREAKING CHANGE / Closes #123>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, `revert`.

Examples:

```text
feat(calendar): add same-day reschedule flow
fix(webhook): use timing-safe compare for whatsapp signature
docs(readme): clarify WhatsApp Business approval timeline
refactor(ai): split intent router into router + extractor
test(billing): cover stripe checkout success path
chore(deps): bump @anthropic-ai/sdk to 0.67.0
```

Breaking changes go in the footer:

```text
feat(api): rename /tenant/export to /gdpr/export

BREAKING CHANGE: clients must update the export endpoint URL.
```

## Pull request process

1. **Open a PR early** — even as draft. Faster feedback loops.
2. **Title** uses Conventional Commit format (`feat(scope): summary`).
3. **Fill the [PR template](./.github/PULL_REQUEST_TEMPLATE.md)** — type of
   change, tests added, screenshots if UI, linked issues.
4. **Tests must be green.** CI will block the merge otherwise. Run
   `npm run verify` locally before pushing.
5. **One reviewer minimum.** Maintainer (`@Hiberius`) reviews everything in
   the early phase; community reviewers welcome on docs / tests / refactors.
6. **Keep PRs focused.** A 200-line PR gets merged faster than a 2,000-line
   PR. Split unrelated changes.
7. **Rebase, don't merge** when updating with `main`. Linear history.
8. **Squash on merge** is the default. The squashed commit message becomes
   the PR title, so make it good.

PRs that change public behaviour also need:

- Tests covering the new path (target ≥80% coverage on the touched files)
- Updated docs (`docs/api-contract.md`, `docs/DATABASE.md`, etc.)
- A note in the PR description explaining migration impact (if any)

## Testing requirements

- Unit + integration tests live in `tests/`. Vitest config: `vitest.config.ts`.
- Run all tests: `npm run test`
- Coverage report: `npm run test:coverage`
- The `verify` script also runs `db:lint` to ensure RLS is enabled on every
  new table you add (`scripts/check-rls-migration.mjs`).

If you add a new database migration, you **must** also add the matching RLS
policies — `db:lint` will fail otherwise.

For frontend changes that affect visible UI, attach before/after screenshots
in the PR. Mobile (375px) and desktop (1440px) at minimum.

## Using Claude Code to contribute

This codebase was bootstrapped with Anthropic's Claude Code and remains
optimised for AI-assisted contribution. Here is the suggested workflow.

### Setting up the context file

The repo expects a project-level `CLAUDE.md` (already committed at
`/CLAUDE.md`) that points the assistant at the right docs. When you clone
locally and open Claude Code in the repo root, it will read:

- `CLAUDE.md` — project instructions
- `AGENTS.md` — how to use sub-agents in this codebase
- `docs/ARCHITECTURE.md` — system overview
- `docs/api-contract.md` — endpoint shapes

You don't need to do anything special. Just open Claude Code in the repo and
start the session.

### Suggested workflow

```text
1. /plan     → describe the change, get a step-by-step plan
2. /tdd      → write failing tests first
3. implement → minimal code to make tests pass
4. /verify   → run the quality gate
5. /code-review → ask Claude to review its own diff
6. open PR
```

### Useful slash commands in this repo

| Command          | Purpose                                                       |
| ---------------- | ------------------------------------------------------------- |
| `/learn`         | Extract reusable patterns from your last working session      |
| `/plan`          | Break down a feature into ordered, testable steps             |
| `/tdd`           | Enforce the red-green-refactor loop                           |
| `/code-review`   | Run a self-review on uncommitted changes                      |
| `/security-review` | Targeted check for OWASP / GDPR concerns                    |
| `/verify`        | Run typecheck + lint + test + db:lint                         |

> Tip: use the `planner` agent for changes touching ≥3 files, and the
> `tdd-guide` agent for bug fixes. See `AGENTS.md` for the full list.

### Disclosing AI assistance

You are welcome to use Claude Code (or any other AI tool) when contributing.
You don't need to disclose it explicitly in the PR — what matters is that the
code is correct, tested, and that you understand it well enough to defend the
review.

## Reporting issues

Use the right template:

- [Bug report](./.github/ISSUE_TEMPLATE/bug_report.yml) — something is broken
- [Feature request](./.github/ISSUE_TEMPLATE/feature_request.yml) — something is missing
- [Question](./.github/ISSUE_TEMPLATE/question.yml) — you need help

Search existing issues first. Duplicates will be closed and linked.

For security vulnerabilities, do **not** open a public issue. Follow the
process in [SECURITY.md](./SECURITY.md).

## Recognition

Every merged contributor is listed in `CONTRIBUTORS.md` (auto-generated from
git history at each release). You can also add yourself manually in your
first PR if you want a specific name/handle/link.

Notable ongoing contributors get listed in the README and may be granted
review rights on the repository.

Thank you for being part of this. — Christian Calabrò ([@Hiberius](https://github.com/Hiberius))
