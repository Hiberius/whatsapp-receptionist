// Fatto da Claude Code il 27 aprile 2026.
//
// Client tipizzato per /api/usage/status. Schemi allineati a
// `src/server/usage/limits.ts`.

import { z } from 'zod';

import { apiFetch } from './fetch';

const UsagePlanKeySchema = z.enum(['trial', 'starter', 'professional', 'agency']);

const UsageMetricSnapshotSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  percent: z.number().int().min(0).max(100),
  exceeded: z.boolean(),
  warning: z.boolean(),
});

const UsageBlockReasonSchema = z.enum(['conversations_exceeded', 'voice_exceeded']).nullable();

export const UsageSnapshotSchema = z.object({
  plan: UsagePlanKeySchema,
  metricMonth: z.string(),
  conversations: UsageMetricSnapshotSchema,
  voiceMessages: UsageMetricSnapshotSchema,
  messages: z.object({
    used: z.number().int().nonnegative(),
  }),
  aiCostCents: z.object({
    used: z.number().int().nonnegative(),
  }),
  autoReplyAllowed: z.boolean(),
  blockReason: UsageBlockReasonSchema,
  softWarning: z.boolean(),
});

export type UsageSnapshot = z.infer<typeof UsageSnapshotSchema>;
export type UsageMetricSnapshot = z.infer<typeof UsageMetricSnapshotSchema>;
export type UsagePlanKey = z.infer<typeof UsagePlanKeySchema>;

export type UsageClient = {
  getStatus(options?: { signal?: AbortSignal }): Promise<UsageSnapshot>;
};

export function createUsageClient(input?: { baseUrl?: string }): UsageClient {
  const baseUrl = input?.baseUrl ?? '';

  return {
    getStatus({ signal } = {}) {
      return apiFetch('/api/usage/status', {
        schema: UsageSnapshotSchema,
        baseUrl,
        ...(signal !== undefined ? { signal } : {}),
      });
    },
  };
}
