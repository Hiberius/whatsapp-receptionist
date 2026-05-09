import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '@/lib/auth/session';
import {
  TenantOnboardingService,
  type OnboardingStatus,
  type OnboardingTenantProfile,
  type TenantOnboardingRepository,
} from '@/server/onboarding/tenant-onboarding';

const now = new Date('2026-04-26T12:00:00.000Z');

describe('TenantOnboardingService', () => {
  it('creates a tenant bundle and syncs owner auth claims', async () => {
    const repository = new FakeTenantOnboardingRepository();
    const service = new TenantOnboardingService(repository);

    const result = await service.complete({
      user: authenticatedUser(),
      now,
      ipAddress: '203.0.113.10',
      userAgent: 'Vitest',
      payload: {
        tenantName: ' Studio Déntale Roma ',
        billingEmail: 'BILLING@EXAMPLE.IT',
        businessType: ' dentist ',
        studioName: ' Studio Dentale Roma ',
        fullName: ' Mario Rossi ',
        services: [
          {
            name: ' Igiene ',
            durationMinutes: 45,
            priceCents: 8000,
          },
        ],
        businessHours: [
          {
            weekday: 1,
            opensAt: '09:00',
            closesAt: '13:00',
          },
        ],
      },
    });

    expect(result).toEqual({
      onboarded: true,
      role: 'owner',
      tenant: expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Studio Déntale Roma',
        trialEndsAt: '2026-05-10T12:00:00.000Z',
      }),
    });
    expect(repository.createdBundle).toMatchObject({
      userId: '00000000-0000-4000-8000-000000000099',
      userEmail: 'owner@example.it',
      fullName: 'Mario Rossi',
      tenant: {
        name: 'Studio Déntale Roma',
        billingEmail: 'billing@example.it',
        businessType: 'dentist',
        trialEndsAt: '2026-05-10T12:00:00.000Z',
      },
      config: {
        studioName: 'Studio Dentale Roma',
        assistantName: 'Ambrogio',
        autoReplyEnabled: false,
        voiceMessagesEnabled: true,
        voiceRepliesEnabled: false,
      },
      services: [
        {
          name: 'Igiene',
          durationMinutes: 45,
          priceCents: 8000,
          active: true,
        },
      ],
      businessHours: [
        {
          weekday: 1,
          opensAt: '09:00:00',
          closesAt: '13:00:00',
          active: true,
        },
      ],
      audit: {
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
      },
    });
    expect(repository.createdBundle?.tenant.slug).toMatch(/^studio-dentale-roma-[a-f0-9-]{8}$/);
    expect(repository.syncedClaims).toEqual([
      {
        userId: '00000000-0000-4000-8000-000000000099',
        appMetadata: { provider: 'email' },
        tenantId: '00000000-0000-4000-8000-000000000001',
        role: 'owner',
      },
    ]);
  });

  it('returns existing membership and repairs auth claims', async () => {
    const repository = new FakeTenantOnboardingRepository();
    repository.membership = {
      onboarded: true,
      role: 'admin',
      tenant: tenantProfile({
        id: '00000000-0000-4000-8000-000000000123',
        name: 'Studio Esistente',
      }),
    };
    const service = new TenantOnboardingService(repository);

    await expect(
      service.complete({
        user: authenticatedUser(),
        now,
        payload: {
          tenantName: 'Nuovo Studio',
        },
      }),
    ).resolves.toEqual(repository.membership);
    expect(repository.createdBundle).toBeNull();
    expect(repository.syncedClaims).toEqual([
      expect.objectContaining({
        tenantId: '00000000-0000-4000-8000-000000000123',
        role: 'admin',
      }),
    ]);
  });

  it('refuses to create a duplicate tenant when auth claims already exist', async () => {
    const service = new TenantOnboardingService(new FakeTenantOnboardingRepository());

    await expect(
      service.complete({
        user: authenticatedUser({
          appMetadata: {
            tenant_id: '00000000-0000-4000-8000-000000000555',
            role: 'owner',
          },
        }),
        now,
        payload: {
          tenantName: 'Studio Duplicato',
        },
      }),
    ).rejects.toMatchObject({
      code: 'conflict',
    });
  });

  it('validates onboarding business hour overlap', async () => {
    const service = new TenantOnboardingService(new FakeTenantOnboardingRepository());

    await expect(
      service.complete({
        user: authenticatedUser(),
        now,
        payload: {
          tenantName: 'Studio Orari',
          businessHours: [
            {
              weekday: 2,
              opensAt: '09:00',
              closesAt: '12:00',
            },
            {
              weekday: 2,
              opensAt: '11:30',
              closesAt: '13:00',
            },
          ],
        },
      }),
    ).rejects.toMatchObject({
      code: 'bad_request',
    });
  });
});

class FakeTenantOnboardingRepository implements TenantOnboardingRepository {
  membership: OnboardingStatus | null = null;
  createdBundle: Parameters<TenantOnboardingRepository['createTenant']>[0] | null = null;
  readonly syncedClaims: Array<Parameters<TenantOnboardingRepository['syncAuthUserClaims']>[0]> =
    [];

  async getMembership(): Promise<OnboardingStatus | null> {
    return this.membership;
  }

  async createTenant(
    input: Parameters<TenantOnboardingRepository['createTenant']>[0],
  ): Promise<OnboardingTenantProfile> {
    this.createdBundle = input;
    return tenantProfile({
      slug: input.tenant.slug,
      name: input.tenant.name,
      trialEndsAt: input.tenant.trialEndsAt,
    });
  }

  async syncAuthUserClaims(
    input: Parameters<TenantOnboardingRepository['syncAuthUserClaims']>[0],
  ): Promise<void> {
    this.syncedClaims.push(input);
  }
}

function authenticatedUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: '00000000-0000-4000-8000-000000000099',
    email: 'owner@example.it',
    appMetadata: {
      provider: 'email',
    },
    userMetadata: {},
    ...overrides,
  };
}

function tenantProfile(overrides: Partial<OnboardingTenantProfile> = {}): OnboardingTenantProfile {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'studio-test',
    name: 'Studio Test',
    trialEndsAt: '2026-05-10T12:00:00.000Z',
    ...overrides,
  };
}
