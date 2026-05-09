// Fatto da Claude Code il 27 aprile 2026.
//
// Client API tipizzato browser-side per Ambrogio.ai.
//
// Copre solo le route aggiunte durante il takeover Claude Code (Stripe
// billing, usage limits, invio manuale operatore). Le route Codex
// pre-esistenti (settings, conversations GET/PATCH, knowledge-base,
// onboarding, integrations) non sono incluse: Codex le coprira' al rientro
// con il pattern frontend di sua scelta, restando proprietario della
// direzione visiva e dell'integrazione frontend.
//
// USO PREVISTO: Client Components (browser). Per RSC/Server Actions invocare
// direttamente i service in `src/server/...`.

export {
  createBillingClient,
  type BillingClient,
  type BillingPlan,
  type BillingTenantStatus,
  type BillingStatus,
  type CheckoutPlan,
  type CheckoutSessionResult,
  type BillingPortalResult,
  BillingStatusSchema,
  CheckoutSessionResultSchema,
  BillingPortalResultSchema,
} from './billing';

export {
  createUsageClient,
  type UsageClient,
  type UsageSnapshot,
  type UsageMetricSnapshot,
  type UsagePlanKey,
  UsageSnapshotSchema,
} from './usage';

export {
  createConversationsClient,
  type ConversationsClient,
  type SendOperatorMessageInput,
  type SendOperatorMessageResult,
  SendOperatorMessageInputSchema,
  SendOperatorMessageResultSchema,
} from './conversations';

export { ApiError, isApiError, type ApiErrorCode } from './types';

export { apiFetch } from './fetch';
