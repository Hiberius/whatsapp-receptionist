import { describe, expect, it } from 'vitest';

import type { AuthSession } from '@/lib/auth/session';
import {
  TenantSettingsService,
  type BusinessHourSettings,
  type TenantConfigSettings,
  type TenantProfile,
  type TenantServiceSettings,
  type TenantSettingsRepository,
  type TenantSettingsSnapshot,
} from '@/server/settings/tenant-settings';

describe('TenantSettingsService', () => {
  it('allows members to read the tenant settings snapshot', async () => {
    const repository = new FakeTenantSettingsRepository();
    const service = new TenantSettingsService(repository);

    await expect(
      service.getSnapshot({
        session: memberSession(),
      }),
    ).resolves.toMatchObject({
      tenant: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Studio Ambrogio',
      },
      config: {
        assistantName: 'Ambrogio',
        autoReplyEnabled: false,
      },
      services: [
        {
          name: 'Prima visita',
          active: true,
        },
      ],
    });
  });

  it('updates tenant/config settings for admins and records audit metadata', async () => {
    const repository = new FakeTenantSettingsRepository();
    const service = new TenantSettingsService(repository);

    const updated = await service.updateSettings({
      session: adminSession(),
      patch: {
        name: ' Studio Beta ',
        timezone: 'Europe/Rome',
        businessType: ' Dentista ',
        studioName: ' Studio Beta Milano ',
        assistantName: ' Ambrogio ',
        email: 'INFO@EXAMPLE.IT',
        autoReplyEnabled: true,
        voiceRepliesEnabled: true,
        bookingMinLeadMinutes: 60,
        elevenlabsVoiceId: ' voice_123 ',
        humanEscalationEmail: 'HELP@EXAMPLE.IT',
      },
      ipAddress: '203.0.113.10',
      userAgent: 'Vitest',
    });

    expect(updated.tenant).toMatchObject({
      name: 'Studio Beta',
      timezone: 'Europe/Rome',
      businessType: 'Dentista',
    });
    expect(updated.config).toMatchObject({
      studioName: 'Studio Beta Milano',
      email: 'info@example.it',
      autoReplyEnabled: true,
      voiceRepliesEnabled: true,
      bookingMinLeadMinutes: 60,
      elevenlabsVoiceId: 'voice_123',
      humanEscalationEmail: 'help@example.it',
    });
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'settings.tenant.updated',
        resourceType: 'tenant_settings',
        resourceId: '00000000-0000-4000-8000-000000000001',
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
        metadata: {
          tenantFields: ['name', 'timezone', 'businessType'],
          configFields: [
            'studioName',
            'assistantName',
            'email',
            'autoReplyEnabled',
            'voiceRepliesEnabled',
            'bookingMinLeadMinutes',
            'elevenlabsVoiceId',
            'humanEscalationEmail',
          ],
        },
      }),
    ]);
  });

  it('blocks members from mutating settings', async () => {
    const service = new TenantSettingsService(new FakeTenantSettingsRepository());

    await expect(
      service.createService({
        session: memberSession(),
        service: {
          name: 'Igiene',
          durationMinutes: 30,
        },
      }),
    ).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('creates and updates services with tenant-scoped audit logs', async () => {
    const repository = new FakeTenantSettingsRepository();
    const service = new TenantSettingsService(repository);

    const created = await service.createService({
      session: adminSession(),
      service: {
        name: ' Igiene dentale ',
        description: ' Pulizia professionale ',
        durationMinutes: 45,
        priceCents: 8000,
      },
    });
    const updated = await service.updateService({
      session: adminSession(),
      serviceId: created.id,
      patch: {
        durationMinutes: 50,
        active: false,
      },
    });

    expect(created).toMatchObject({
      name: 'Igiene dentale',
      description: 'Pulizia professionale',
      durationMinutes: 45,
      priceCents: 8000,
      active: true,
    });
    expect(updated).toMatchObject({
      id: created.id,
      durationMinutes: 50,
      active: false,
    });
    expect(repository.auditLogs.map((log) => log.action)).toEqual([
      'settings.service.created',
      'settings.service.updated',
    ]);
  });

  it('replaces business hours after sorting and overlap validation', async () => {
    const repository = new FakeTenantSettingsRepository();
    const service = new TenantSettingsService(repository);

    await expect(
      service.replaceBusinessHours({
        session: adminSession(),
        hours: [
          {
            weekday: 1,
            opensAt: '11:00',
            closesAt: '13:00',
          },
          {
            weekday: 1,
            opensAt: '09:00',
            closesAt: '10:30',
          },
          {
            weekday: 3,
            opensAt: '14:00',
            closesAt: '18:00',
            active: false,
          },
        ],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        weekday: 1,
        opensAt: '09:00',
        closesAt: '10:30',
        active: true,
      }),
      expect.objectContaining({
        weekday: 1,
        opensAt: '11:00',
        closesAt: '13:00',
        active: true,
      }),
      expect.objectContaining({
        weekday: 3,
        opensAt: '14:00',
        closesAt: '18:00',
        active: false,
      }),
    ]);

    await expect(
      service.replaceBusinessHours({
        session: adminSession(),
        hours: [
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
      }),
    ).rejects.toMatchObject({
      code: 'bad_request',
    });
  });
});

class FakeTenantSettingsRepository implements TenantSettingsRepository {
  snapshot: TenantSettingsSnapshot | null = defaultSnapshot();
  readonly auditLogs: Array<{
    tenantId: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Record<string, unknown>;
  }> = [];

  async getSnapshot(): Promise<TenantSettingsSnapshot | null> {
    return this.snapshot ? cloneSnapshot(this.snapshot) : null;
  }

  async updateTenantProfile(input: {
    tenantId: string;
    patch: Partial<{
      name: string;
      timezone: string;
      businessType: string | null;
    }>;
  }): Promise<void> {
    assertSnapshot(this.snapshot);
    this.snapshot.tenant = {
      ...this.snapshot.tenant,
      ...input.patch,
    };
  }

  async upsertTenantConfig(
    input: Parameters<TenantSettingsRepository['upsertTenantConfig']>[0],
  ): Promise<void> {
    assertSnapshot(this.snapshot);
    this.snapshot.config = {
      ...this.snapshot.config,
      studioName: input.studioName,
      assistantName: input.assistantName,
      city: input.city,
      address: input.address,
      phone: input.phone,
      email: input.email,
      defaultLocale: input.defaultLocale,
      aiDisclosureEnabled: input.aiDisclosureEnabled,
      autoReplyEnabled: input.autoReplyEnabled,
      voiceMessagesEnabled: input.voiceMessagesEnabled,
      voiceRepliesEnabled: input.voiceRepliesEnabled,
      bookingMinLeadMinutes: input.bookingMinLeadMinutes,
      bookingSlotStepMinutes: input.bookingSlotStepMinutes,
      bookingBufferMinutes: input.bookingBufferMinutes,
      bookingMaxDaysAhead: input.bookingMaxDaysAhead,
      elevenlabsVoiceId: input.elevenlabsVoiceId,
      elevenlabsSttModel: input.elevenlabsSttModel,
      elevenlabsTtsModel: input.elevenlabsTtsModel,
      humanEscalationEmail: input.humanEscalationEmail,
      updatedAt: '2026-04-26T12:00:00.000Z',
    };
  }

  async listServices(): Promise<TenantServiceSettings[]> {
    assertSnapshot(this.snapshot);
    return this.snapshot.services.map((service) => ({ ...service }));
  }

  async createService(input: {
    tenantId: string;
    service: Parameters<TenantSettingsRepository['createService']>[0]['service'];
  }): Promise<TenantServiceSettings> {
    assertSnapshot(this.snapshot);
    const service = serviceRecord({
      id: `00000000-0000-4000-8000-00000000000${this.snapshot.services.length + 2}`,
      ...input.service,
    });
    this.snapshot.services.push(service);

    return { ...service };
  }

  async updateService(input: {
    tenantId: string;
    serviceId: string;
    patch: Parameters<TenantSettingsRepository['updateService']>[0]['patch'];
  }): Promise<TenantServiceSettings | null> {
    assertSnapshot(this.snapshot);
    const index = this.snapshot.services.findIndex((service) => service.id === input.serviceId);

    if (index === -1) {
      return null;
    }

    const current = this.snapshot.services[index];

    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      ...input.patch,
      updatedAt: '2026-04-26T12:00:00.000Z',
    };
    this.snapshot.services[index] = updated;

    return { ...updated };
  }

  async replaceBusinessHours(input: {
    tenantId: string;
    hours: Parameters<TenantSettingsRepository['replaceBusinessHours']>[0]['hours'];
  }): Promise<BusinessHourSettings[]> {
    assertSnapshot(this.snapshot);
    this.snapshot.businessHours = input.hours.map((hour, index) =>
      businessHourRecord({
        id: `00000000-0000-4000-8000-00000000001${index}`,
        weekday: hour.weekday,
        opensAt: hour.opensAt.slice(0, 5),
        closesAt: hour.closesAt.slice(0, 5),
        active: hour.active,
      }),
    );

    return this.snapshot.businessHours.map((hour) => ({ ...hour }));
  }

  async recordAuditLog(
    input: Parameters<TenantSettingsRepository['recordAuditLog']>[0],
  ): Promise<void> {
    this.auditLogs.push(input);
  }
}

function adminSession(): AuthSession {
  return {
    userId: '00000000-0000-4000-8000-000000000099',
    tenantId: '00000000-0000-4000-8000-000000000001',
    role: 'admin',
  };
}

function memberSession(): AuthSession {
  return {
    ...adminSession(),
    role: 'member',
  };
}

function defaultSnapshot(): TenantSettingsSnapshot {
  return {
    tenant: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Studio Ambrogio',
      slug: 'studio-ambrogio',
      plan: 'trial',
      status: 'active',
      timezone: 'Europe/Rome',
      businessType: 'dentist',
    },
    config: configRecord(),
    services: [
      serviceRecord({
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Prima visita',
      }),
    ],
    businessHours: [
      businessHourRecord({
        id: '00000000-0000-4000-8000-000000000010',
        weekday: 1,
        opensAt: '09:00',
        closesAt: '13:00',
      }),
    ],
  };
}

function configRecord(overrides: Partial<TenantConfigSettings> = {}): TenantConfigSettings {
  return {
    id: '00000000-0000-4000-8000-000000000020',
    studioName: 'Studio Ambrogio',
    assistantName: 'Ambrogio',
    city: 'Milano',
    address: 'Via Roma 1',
    phone: '+3902123456',
    email: 'studio@example.it',
    defaultLocale: 'it-IT',
    aiDisclosureEnabled: true,
    autoReplyEnabled: false,
    voiceMessagesEnabled: true,
    voiceRepliesEnabled: false,
    bookingMinLeadMinutes: 120,
    bookingSlotStepMinutes: 15,
    bookingBufferMinutes: 0,
    bookingMaxDaysAhead: 30,
    elevenlabsVoiceId: null,
    elevenlabsSttModel: 'scribe_v2',
    elevenlabsTtsModel: 'eleven_flash_v2_5',
    humanEscalationEmail: null,
    createdAt: '2026-04-26T08:00:00.000Z',
    updatedAt: '2026-04-26T08:00:00.000Z',
    ...overrides,
  };
}

function serviceRecord(overrides: Partial<TenantServiceSettings> = {}): TenantServiceSettings {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Prima visita',
    description: null,
    durationMinutes: 30,
    priceCents: null,
    active: true,
    createdAt: '2026-04-26T08:00:00.000Z',
    updatedAt: '2026-04-26T08:00:00.000Z',
    ...overrides,
  };
}

function businessHourRecord(overrides: Partial<BusinessHourSettings> = {}): BusinessHourSettings {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    weekday: 1,
    opensAt: '09:00',
    closesAt: '13:00',
    active: true,
    createdAt: '2026-04-26T08:00:00.000Z',
    updatedAt: '2026-04-26T08:00:00.000Z',
    ...overrides,
  };
}

function cloneSnapshot(snapshot: TenantSettingsSnapshot): TenantSettingsSnapshot {
  return {
    tenant: { ...snapshot.tenant },
    config: { ...snapshot.config },
    services: snapshot.services.map((service) => ({ ...service })),
    businessHours: snapshot.businessHours.map((hour) => ({ ...hour })),
  };
}

function assertSnapshot(
  snapshot: TenantSettingsSnapshot | null,
): asserts snapshot is TenantSettingsSnapshot {
  if (!snapshot) {
    throw new Error('Expected fake snapshot to exist');
  }
}
