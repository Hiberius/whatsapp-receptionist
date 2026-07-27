import { beforeEach, describe, expect, it } from 'vitest';

import {
  createWhatsAppProvisioningService,
  type WhatsAppProvisioningRepository,
} from '@/server/whatsapp/provisioning';

const ENCRYPTION_KEY = 'test-secret-with-at-least-32-characters';

interface Row {
  id: string;
  tenant_id: string;
  external_account_id: string | null;
  external_display_id: string | null;
  status: string;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  created_at: string;
}

/**
 * Repository in memoria che replica la semantica delle query reali:
 * `findByTenant` filtra per tenant, `findByPhoneNumberId` no (è il controllo
 * di proprietà, deliberatamente cross-tenant).
 */
function createFakeRepository(seed: Row[] = []) {
  const rows: Row[] = [...seed];
  let sequence = seed.length;

  const repository: WhatsAppProvisioningRepository = {
    async findByTenant(tenantId) {
      return rows.find((row) => row.tenant_id === tenantId) ?? null;
    },
    async findByPhoneNumberId(phoneNumberId) {
      return rows.find((row) => row.external_account_id === phoneNumberId) ?? null;
    },
    async upsert(input) {
      const existing = input.existingId
        ? rows.find((row) => row.id === input.existingId)
        : undefined;

      if (existing) {
        existing.external_account_id = input.phoneNumberId;
        existing.external_display_id = input.displayPhoneNumber || null;
        existing.status = 'active';
        existing.credentials = input.credentials;
        return existing;
      }

      sequence += 1;
      const created: Row = {
        id: `integration_${sequence}`,
        tenant_id: input.tenantId,
        external_account_id: input.phoneNumberId,
        external_display_id: input.displayPhoneNumber || null,
        status: 'active',
        credentials: input.credentials,
        config: { phone_number_id: input.phoneNumberId },
        created_at: '2026-07-27T08:00:00.000Z',
      };
      rows.push(created);
      return created;
    },
    async revoke(input) {
      const row = rows.find((r) => r.id === input.integrationId && r.tenant_id === input.tenantId);
      if (row) row.status = 'revoked';
    },
  };

  return { repository, rows };
}

function activeRow(overrides: Partial<Row>): Row {
  return {
    id: 'integration_seed',
    tenant_id: 'tenant_a',
    external_account_id: 'phone_123',
    external_display_id: '+39 02 1234567',
    status: 'active',
    credentials: {},
    config: {},
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('WhatsAppProvisioningService', () => {
  beforeEach(() => {
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;
  });

  it('collega un numero e rende il tenant risolvibile dal webhook', async () => {
    const { repository, rows } = createFakeRepository();
    const service = createWhatsAppProvisioningService(repository);

    const status = await service.connect({
      tenantId: 'tenant_a',
      phoneNumberId: 'phone_123',
      displayPhoneNumber: '+39 02 1234567',
      apiKey: 'super_secret_api_key',
    });

    expect(status.connected).toBe(true);
    expect(status.phoneNumberId).toBe('phone_123');
    // È la colonna interrogata da `resolveTenantByPhoneNumberId`.
    expect(rows[0]?.external_account_id).toBe('phone_123');
    expect(rows[0]?.status).toBe('active');
  });

  it('non restituisce mai la API key e la salva cifrata', async () => {
    const { repository, rows } = createFakeRepository();
    const service = createWhatsAppProvisioningService(repository);

    const status = await service.connect({
      tenantId: 'tenant_a',
      phoneNumberId: 'phone_123',
      displayPhoneNumber: '',
      apiKey: 'super_secret_api_key',
    });

    expect(status.hasApiKey).toBe(true);
    expect(JSON.stringify(status)).not.toContain('super_secret_api_key');
    expect(JSON.stringify(rows[0]?.credentials)).not.toContain('super_secret_api_key');
  });

  it('impedisce a un tenant di rivendicare il numero di un altro tenant', async () => {
    // Senza questo controllo il tenant B intercetterebbe le conversazioni in
    // arrivo del tenant A: `resolveTenantByPhoneNumberId` associa i messaggi
    // al primo record attivo che corrisponde al phone_number_id.
    const { repository } = createFakeRepository([activeRow({ tenant_id: 'tenant_a' })]);
    const service = createWhatsAppProvisioningService(repository);

    await expect(
      service.connect({
        tenantId: 'tenant_b',
        phoneNumberId: 'phone_123',
        displayPhoneNumber: '',
        apiKey: 'attacker_api_key',
      }),
    ).rejects.toThrow('già collegato a un altro account');
  });

  it('non rivela quale account detiene il numero conteso', async () => {
    const { repository } = createFakeRepository([activeRow({ tenant_id: 'tenant_a' })]);
    const service = createWhatsAppProvisioningService(repository);

    const error = await service
      .connect({
        tenantId: 'tenant_b',
        phoneNumberId: 'phone_123',
        displayPhoneNumber: '',
        apiKey: 'attacker_api_key',
      })
      .catch((caught: Error) => caught);

    expect((error as Error).message).not.toContain('tenant_a');
  });

  it('consente di riassegnare un numero il cui collegamento è stato revocato', async () => {
    const { repository } = createFakeRepository([
      activeRow({ tenant_id: 'tenant_a', status: 'revoked' }),
    ]);
    const service = createWhatsAppProvisioningService(repository);

    const status = await service.connect({
      tenantId: 'tenant_b',
      phoneNumberId: 'phone_123',
      displayPhoneNumber: '',
      apiKey: 'new_tenant_api_key',
    });

    expect(status.connected).toBe(true);
  });

  it('permette allo stesso tenant di aggiornare il proprio numero', async () => {
    const { repository, rows } = createFakeRepository([activeRow({ tenant_id: 'tenant_a' })]);
    const service = createWhatsAppProvisioningService(repository);

    await service.connect({
      tenantId: 'tenant_a',
      phoneNumberId: 'phone_123',
      displayPhoneNumber: '+39 02 9999999',
      apiKey: 'rotated_api_key',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.external_display_id).toBe('+39 02 9999999');
  });

  it('riporta lo stato scollegato quando il tenant non ha integrazioni', async () => {
    const { repository } = createFakeRepository();
    const service = createWhatsAppProvisioningService(repository);

    const status = await service.getStatus('tenant_senza_integrazione');

    expect(status.connected).toBe(false);
    expect(status.hasApiKey).toBe(false);
  });

  it('revoca il collegamento senza cancellare la riga, preservando lo storico', async () => {
    const { repository, rows } = createFakeRepository([activeRow({ tenant_id: 'tenant_a' })]);
    const service = createWhatsAppProvisioningService(repository);

    const status = await service.disconnect('tenant_a');

    expect(status.connected).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('revoked');
  });

  it('rifiuta una API key vuota', async () => {
    const { repository } = createFakeRepository();
    const service = createWhatsAppProvisioningService(repository);

    await expect(
      service.connect({
        tenantId: 'tenant_a',
        phoneNumberId: 'phone_123',
        displayPhoneNumber: '',
        apiKey: '   ',
      }),
    ).rejects.toThrow('apiKey is required');
  });
});
