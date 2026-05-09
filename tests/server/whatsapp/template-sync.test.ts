import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import {
  Dialog360WhatsAppTemplateClient,
  WhatsAppTemplateSyncService,
  extractTemplateItems,
  normalizeTemplate,
  type SyncedWhatsAppTemplate,
  type WhatsAppTemplateListClient,
  type WhatsAppTemplateSyncRepository,
} from '@/server/whatsapp/template-sync';

const now = new Date('2026-04-25T10:00:00.000Z');

describe('Dialog360WhatsAppTemplateClient', () => {
  it('fetches templates from the 360dialog template endpoint', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const client = new Dialog360WhatsAppTemplateClient({
      apiUrl: 'https://waba-v2.360dialog.io',
      apiKey: 'test_api_key',
      fetcher: async (url, init) => {
        requests.push({ url: url.toString(), init: init ?? {} });

        return Response.json({ data: [] });
      },
    });

    await expect(client.listTemplates()).resolves.toEqual({ data: [] });
    expect(requests[0]?.url).toBe(
      'https://waba-v2.360dialog.io/v1/configs/templates?limit=1000&sort=name',
    );
    expect(requests[0]?.init.headers).toMatchObject({
      'D360-API-KEY': 'test_api_key',
    });
  });

  it('raises upstream errors when template fetch fails', async () => {
    const client = new Dialog360WhatsAppTemplateClient({
      apiUrl: 'https://waba-v2.360dialog.io',
      apiKey: 'test_api_key',
      fetcher: async () => Response.json({ error: { message: 'Down' } }, { status: 503 }),
    });

    await expect(client.listTemplates()).rejects.toBeInstanceOf(AppError);
  });
});

describe('WhatsAppTemplateSyncService', () => {
  it('normalizes and upserts provider templates for a tenant', async () => {
    const client = new FakeTemplateListClient({
      data: [
        {
          id: '123',
          name: 'appointment_reminder_24h',
          language: 'it',
          category: 'UTILITY',
          status: 'APPROVED',
          quality_rating: 'GREEN',
          components: [{ type: 'BODY', text: 'Ciao {{1}}' }],
        },
        {
          id: '124',
          name: 'promo',
          language_code: 'it',
          category: 'MARKETING',
          status: 'PAUSED',
        },
        {
          id: '125',
          name: 'invalid_category',
          language: 'it',
          category: 'UNKNOWN',
          status: 'APPROVED',
        },
      ],
    });
    const repository = new FakeTemplateSyncRepository();
    const service = new WhatsAppTemplateSyncService(client, repository);

    const result = await service.syncTenantTemplates({
      tenantId: 'tenant_1',
      now,
    });

    expect(result).toEqual({
      fetchedTemplates: 3,
      syncedTemplates: 2,
      skippedTemplates: 1,
    });
    expect(repository.upserts[0]).toMatchObject({
      tenantId: 'tenant_1',
      syncedAt: now,
      templates: [
        {
          externalId: '123',
          name: 'appointment_reminder_24h',
          languageCode: 'it',
          category: 'utility',
          status: 'approved',
          qualityRating: 'GREEN',
          components: [{ type: 'BODY', text: 'Ciao {{1}}' }],
        },
        {
          externalId: '124',
          name: 'promo',
          languageCode: 'it',
          category: 'marketing',
          status: 'paused',
        },
      ],
    });
  });
});

describe('template normalization helpers', () => {
  it('extracts arrays from common provider response shapes', () => {
    expect(extractTemplateItems([{ name: 'direct' }])).toEqual([{ name: 'direct' }]);
    expect(extractTemplateItems({ business_templates: [{ name: 'nested' }] })).toEqual([
      { name: 'nested' },
    ]);
    expect(extractTemplateItems({ data: 'not-array' })).toEqual([]);
  });

  it('maps active provider statuses to approved registry status', () => {
    expect(
      normalizeTemplate({
        name: 'appointment_confirmation',
        language: 'it',
        category: 'UTILITY',
        status: 'Active - High Quality',
      }),
    ).toMatchObject({
      status: 'approved',
      category: 'utility',
    });
  });
});

class FakeTemplateListClient implements WhatsAppTemplateListClient {
  constructor(private readonly response: unknown) {}

  async listTemplates(): Promise<unknown> {
    return this.response;
  }
}

class FakeTemplateSyncRepository implements WhatsAppTemplateSyncRepository {
  readonly upserts: Array<{
    tenantId: string;
    templates: SyncedWhatsAppTemplate[];
    syncedAt: Date;
  }> = [];

  async upsertTemplates(input: {
    tenantId: string;
    templates: SyncedWhatsAppTemplate[];
    syncedAt: Date;
  }): Promise<void> {
    this.upserts.push(input);
  }
}
