# Code Review Report - 2026-04-24

## Summary

- Reviewer: Codex
- Scope: project kit, backend specs, infrastructure prompts
- Current state: no production backend code existed before this pass
- Verdict: REQUEST CHANGES on specs before feature coding

## Blocker Issues Fixed By Codex

### 1. Invalid Anthropic model IDs

- Location: `07_INFRASTRUCTURE/env_variables_template.md`, `03_CODEX_BACKEND_PROMPTS/05_ai_engine_anthropic.md`
- Issue: specs referenced non-official model IDs.
- Superseded fix on 2026-04-25: concrete Anthropic model defaults were removed from the repo; configure Anthropic model IDs via env and verify them against official docs before deploy.

### 2. Unconfirmed 360dialog HMAC assumption

- Location: `03_CODEX_BACKEND_PROMPTS/04_whatsapp_integration.md`
- Issue: prompt assumed a `WHATSAPP_WEBHOOK_SECRET` HMAC flow that is not clearly documented for 360dialog.
- Fix: specified a concrete MVP webhook security model using a custom secret header configured in 360dialog plus replay/idempotency controls.
- 2026-04-25 verification: current 360dialog docs expose webhook configuration/destinations with custom `headers`; the project now standardizes on `WHATSAPP_WEBHOOK_HEADER_NAME` + `WHATSAPP_WEBHOOK_HEADER_SECRET`.

## Major Issues Fixed By Codex

### 3. Trial policy contradiction

- Location: pricing, billing, landing/onboarding prompts
- Issue: some docs said trial with card, others said no card.
- Fix: standardized MVP on a 14-day trial without card.

### 4. Incomplete MVP schema

- Location: `03_CODEX_BACKEND_PROMPTS/02_database_schema.md`
- Issue: downstream prompts referenced entities missing from initial schema.
- Fix: added operational entities to the schema prompt and created a first Supabase migration.
