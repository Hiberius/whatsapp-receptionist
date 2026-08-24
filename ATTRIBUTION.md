# Attribution

**AI Scheduling Advisor** is a portfolio extension, not an original application.

Built on [whatsapp-receptionist](https://github.com/Hiberius/whatsapp-receptionist) by
**Christian Calabrò**, released under the MIT License.

The original application — WhatsApp transport, AI reply orchestration, the appointment booking
engine and its Google Calendar integration, multi-tenancy, Stripe billing, GDPR endpoints, and the
dashboard — is his work, not ours. The MIT `LICENSE` and its copyright notice are retained
unchanged.

## What is a portfolio extension

The following were added on top of that base as a portfolio extension:

| Addition | Files |
|---|---|
| Deterministic slot ranker with integer scoring and structured reasons | `src/server/appointments/slot-ranking.ts` |
| Scheduling decision ledger | `src/server/appointments/decision-ledger.ts`, `supabase/migrations/202608240001_scheduling_decisions.sql` |
| `SCHEDULING_RANKING_ENABLED` feature flag | `src/lib/env.ts`, `.env.example` |
| Ranking seam in the booking bridge (flag-gated, fail-open ledger write) | `src/server/ai/booking-bridge.ts` |
| Ranker unit, golden and determinism tests; ledger tests; bridge regression tests | `tests/server/appointments/slot-ranking.test.ts`, `tests/server/appointments/decision-ledger.test.ts`, `tests/server/ai/booking-bridge.test.ts` |

## What it does not change

The extension is additive and reversible. With `SCHEDULING_RANKING_ENABLED=false` — the default —
the booking flow behaves exactly as it did before: the first three available slots, no ranking, no
ledger write.

It applies to initial booking slot proposals only. Reschedule slot proposals are **not** ranked and
**not** recorded in the ledger; that flow is unchanged.

It does not touch the availability engine, `createAppointment()`, the Google Calendar provider, the
WhatsApp transport, or the confirmation semantics. Slots proposed in conversation are still carried
forward by identity in conversation state, and confirming option *N* still selects that exact stored
slot.
