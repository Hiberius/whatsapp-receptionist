import { describe, expect, it } from 'vitest';

import { createWebhookIdempotencyKey } from '@/lib/whatsapp/webhook-security';

describe('createWebhookIdempotencyKey', () => {
  it('creates stable provider-scoped keys', () => {
    const first = createWebhookIdempotencyKey({
      provider: 'whatsapp_360dialog',
      externalId: 'wamid.demo',
    });
    const second = createWebhookIdempotencyKey({
      provider: 'whatsapp_360dialog',
      externalId: 'wamid.demo',
    });

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });
});
