// Fatto da Claude Code l'8 maggio 2026.
// Test del SignUpService.

import { describe, expect, it } from 'vitest';

import { type MagicLinkSender, MagicLinkService } from '@/server/auth/magic-link';
import {
  type PendingTenantInsertInput,
  type SignUpRepository,
  SignUpService,
} from '@/server/auth/sign-up';

describe('SignUpService', () => {
  it('happy path: creates pending tenant and dispatches magic link', async () => {
    const repository = new FakeRepo();
    const sender = new FakeMagicSender();
    const magicLink = new MagicLinkService(sender, 'https://app.test/cb');
    const service = new SignUpService(repository, magicLink);

    const result = await service.signUp({
      businessName: '  Studio Test ',
      email: '  Mario@Example.IT  ',
      vertical: 'dental',
      requestId: 'req_1',
    });

    expect(result.tenantId).toBe('tenant_001');
    expect(repository.inserts).toHaveLength(1);
    expect(repository.inserts[0]).toMatchObject({
      name: 'Studio Test',
      billingEmail: 'mario@example.it',
      businessType: 'dental',
    });
    expect(repository.inserts[0]?.slug).toMatch(/^studio-test-[a-f0-9-]{8}$/);
    expect(sender.calls).toEqual([
      {
        email: 'mario@example.it',
        redirectTo: 'https://app.test/cb',
      },
    ]);
  });

  it('rejects when business name is shorter than 2 chars', async () => {
    const service = makeService();
    await expect(
      service.signUp({
        businessName: 'A',
        email: 'mario@example.it',
        vertical: 'dental',
        requestId: 'req_2',
      }),
    ).rejects.toMatchObject({ code: 'bad_request' });
  });

  it('throws conflict when email already maps to a tenant', async () => {
    const repository = new FakeRepo();
    repository.byEmail.set('mario@example.it', { id: 'existing_tenant' });
    const service = new SignUpService(repository, makeMagicLinkService());

    await expect(
      service.signUp({
        businessName: 'Studio Doppio',
        email: 'mario@example.it',
        vertical: 'beauty',
        requestId: 'req_3',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(repository.inserts).toHaveLength(0);
  });
});

class FakeRepo implements SignUpRepository {
  readonly inserts: PendingTenantInsertInput[] = [];
  readonly byEmail = new Map<string, { id: string }>();

  async findTenantByBillingEmail(email: string): Promise<{ id: string } | null> {
    return this.byEmail.get(email) ?? null;
  }

  async insertPendingTenant(input: PendingTenantInsertInput): Promise<{ id: string }> {
    this.inserts.push(input);
    return { id: 'tenant_001' };
  }
}

class FakeMagicSender implements MagicLinkSender {
  readonly calls: Array<{ email: string; redirectTo: string }> = [];

  async send(input: { email: string; redirectTo: string }): Promise<{ error: null }> {
    this.calls.push(input);
    return { error: null };
  }
}

function makeMagicLinkService(): MagicLinkService {
  return new MagicLinkService(new FakeMagicSender(), 'https://app.test/cb');
}

function makeService(): SignUpService {
  return new SignUpService(new FakeRepo(), makeMagicLinkService());
}
