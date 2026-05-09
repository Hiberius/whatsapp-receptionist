// Fatto da Claude Code l'8 maggio 2026.
// Test del MagicLinkService.

import { describe, expect, it, vi } from 'vitest';

import { type MagicLinkSender, MagicLinkService, normalizeEmail } from '@/server/auth/magic-link';

describe('MagicLinkService', () => {
  it('calls sender with normalized email and configured redirect', async () => {
    const sender = new FakeSender();
    const service = new MagicLinkService(sender, 'https://app.ambrogio.test/auth/callback');

    const result = await service.request({
      email: '  Mario@Example.IT ',
      requestId: 'req_1',
    });

    expect(result).toEqual({ ok: true });
    expect(sender.calls).toEqual([
      {
        email: 'mario@example.it',
        redirectTo: 'https://app.ambrogio.test/auth/callback',
      },
    ]);
  });

  it('returns ok even when sender errors (anti-enumeration)', async () => {
    const sender: MagicLinkSender = {
      send: vi.fn(async () => ({ error: new Error('upstream failure') })),
    };
    const service = new MagicLinkService(sender, 'https://app.test/cb');

    const result = await service.request({ email: 'mario@example.it', requestId: 'req_2' });
    expect(result).toEqual({ ok: true });
  });

  it('returns ok and skips sender when email is invalid (anti-enumeration)', async () => {
    const sender = new FakeSender();
    const service = new MagicLinkService(sender, 'https://app.test/cb');

    const result = await service.request({ email: 'not-an-email', requestId: 'req_3' });

    expect(result).toEqual({ ok: true });
    expect(sender.calls).toHaveLength(0);
  });
});

describe('normalizeEmail', () => {
  it('lowercases, trims and validates basic shape', () => {
    expect(normalizeEmail('  Mario@Example.IT ')).toBe('mario@example.it');
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail('  ')).toBeNull();
  });
});

class FakeSender implements MagicLinkSender {
  readonly calls: Array<{ email: string; redirectTo: string }> = [];

  async send(input: { email: string; redirectTo: string }): Promise<{ error: null }> {
    this.calls.push(input);
    return { error: null };
  }
}
