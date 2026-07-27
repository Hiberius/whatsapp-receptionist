import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { encryptSecret } from '@/server/integrations/credential-encryption';
import {
  TenantWhatsAppCredentialsResolver,
  TenantWhatsAppMessageSenderResolver,
  type WhatsAppCredentialsStore,
} from '@/server/whatsapp/client';
import { WhatsAppOutboxWorker } from '@/server/whatsapp/outbox';
import type {
  ClaimedWhatsAppOutboxJob,
  WhatsAppOutboxRepository,
} from '@/server/whatsapp/outbox-repository';

const ENCRYPTION_KEY = 'test-secret-with-at-least-32-characters';
const API_URL = 'https://waba-v2.360dialog.io';
const now = new Date('2026-04-25T08:00:00.000Z');

describe('credenziali WhatsApp per tenant', () => {
  beforeEach(() => {
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = ENCRYPTION_KEY;
  });

  it('invia il job di ogni tenant con la chiave di quel tenant', async () => {
    const store = new FakeCredentialsStore({
      tenant_a: 'key_tenant_a',
      tenant_b: 'key_tenant_b',
    });
    const provider = new RecordingWhatsAppProvider();
    const repository = new FakeOutboxRepository([
      outboxJob({ id: 'job_a', tenantId: 'tenant_a', recipientIdentifier: '393330000001' }),
      outboxJob({ id: 'job_b', tenantId: 'tenant_b', recipientIdentifier: '393330000002' }),
    ]);
    const worker = new WhatsAppOutboxWorker(repository, senderResolver(store, provider));

    const result = await worker.processReadyJobs({ now });

    expect(result.sentJobs).toBe(2);
    expect(provider.requests).toEqual([
      { apiKey: 'key_tenant_a', to: '393330000001' },
      { apiKey: 'key_tenant_b', to: '393330000002' },
    ]);
    expect(store.tenantIds).toEqual(['tenant_a', 'tenant_b']);
  });

  it('non decifra di nuovo la credenziale per i job successivi dello stesso tenant', async () => {
    const store = new FakeCredentialsStore({ tenant_a: 'key_tenant_a' });
    const provider = new RecordingWhatsAppProvider();
    const repository = new FakeOutboxRepository([
      outboxJob({ id: 'job_1', tenantId: 'tenant_a' }),
      outboxJob({ id: 'job_2', tenantId: 'tenant_a' }),
      outboxJob({ id: 'job_3', tenantId: 'tenant_a' }),
    ]);
    const worker = new WhatsAppOutboxWorker(repository, senderResolver(store, provider));

    const result = await worker.processReadyJobs({ now });

    expect(result.sentJobs).toBe(3);
    expect(provider.requests.map((request) => request.apiKey)).toEqual([
      'key_tenant_a',
      'key_tenant_a',
      'key_tenant_a',
    ]);
    expect(store.tenantIds).toEqual(['tenant_a']);
  });

  it('rilegge la credenziale quando la voce in cache è scaduta', async () => {
    const store = new FakeCredentialsStore({ tenant_a: 'key_tenant_a' });
    let clock = 1_000;
    const resolver = new TenantWhatsAppCredentialsResolver(store, {
      ttlMs: 60_000,
      now: () => clock,
    });

    await resolver.resolve('tenant_a');
    clock += 59_000;
    await resolver.resolve('tenant_a');

    expect(store.tenantIds).toEqual(['tenant_a']);

    clock += 2_000;
    await resolver.resolve('tenant_a');

    expect(store.tenantIds).toEqual(['tenant_a', 'tenant_a']);
  });

  it('ricade sulla chiave globale con un warning quando il tenant non ha integrazione', async () => {
    const store = new FakeCredentialsStore({});
    const warnings: Array<{ context: Record<string, unknown>; message: string }> = [];
    const resolver = new TenantWhatsAppCredentialsResolver(store, {
      globalApiKey: 'legacy_global_key',
      logger: {
        warn: (context, message) => {
          warnings.push({ context, message });
        },
      },
    });

    const credentials = await resolver.resolve('tenant_senza_integrazione');

    expect(credentials).toEqual({ apiKey: 'legacy_global_key', source: 'global' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.context).toMatchObject({
      tenantId: 'tenant_senza_integrazione',
      hasIntegration: false,
    });
  });

  it('non ricade sulla chiave globale quando il tenant ha una propria credenziale', async () => {
    const store = new FakeCredentialsStore({ tenant_a: 'key_tenant_a' });
    const warnings: string[] = [];
    const resolver = new TenantWhatsAppCredentialsResolver(store, {
      globalApiKey: 'legacy_global_key',
      logger: {
        warn: (_context, message) => {
          warnings.push(message);
        },
      },
    });

    expect(await resolver.resolve('tenant_a')).toEqual({
      apiKey: 'key_tenant_a',
      source: 'tenant',
    });
    expect(warnings).toEqual([]);
  });

  it('fallisce quando non esiste né la credenziale del tenant né quella globale', async () => {
    const resolver = new TenantWhatsAppCredentialsResolver(new FakeCredentialsStore({}), {
      globalApiKey: '',
    });

    await expect(resolver.resolve('tenant_a')).rejects.toBeInstanceOf(AppError);
  });

  it('scarta la credenziale in cache quando il provider la rifiuta', async () => {
    const store = new FakeCredentialsStore({ tenant_a: 'key_tenant_a' });
    const resolver = new TenantWhatsAppCredentialsResolver(store);
    const senders = new TenantWhatsAppMessageSenderResolver(resolver, {
      apiUrl: API_URL,
      fetcher: async () => Response.json({ error: { message: 'Invalid key' } }, { status: 401 }),
    });

    const sender = await senders.resolveSender('tenant_a');

    await expect(sender.sendText({ to: '393330000001', body: 'Ciao' })).rejects.toBeInstanceOf(
      AppError,
    );

    await resolver.resolve('tenant_a');

    expect(store.tenantIds).toEqual(['tenant_a', 'tenant_a']);
  });
});

function senderResolver(
  store: WhatsAppCredentialsStore,
  provider: RecordingWhatsAppProvider,
): TenantWhatsAppMessageSenderResolver {
  return new TenantWhatsAppMessageSenderResolver(new TenantWhatsAppCredentialsResolver(store), {
    apiUrl: API_URL,
    fetcher: provider.fetcher,
  });
}

function outboxJob(overrides: Partial<ClaimedWhatsAppOutboxJob> = {}): ClaimedWhatsAppOutboxJob {
  return {
    id: 'job_1',
    tenantId: 'tenant_a',
    messageId: 'message_1',
    recipientIdentifier: '393331112233',
    customerServiceWindowExpiresAt: new Date('2026-04-25T08:30:00.000Z'),
    payload: {
      type: 'text',
      text: { body: 'Ciao, sono Ambrogio', previewUrl: false },
      metadata: {},
    },
    attemptCount: 1,
    maxAttempts: 5,
    ...overrides,
  };
}

/** Registra i tenantId richiesti: senza filtro per tenant il test fallisce. */
class FakeCredentialsStore implements WhatsAppCredentialsStore {
  readonly tenantIds: string[] = [];

  constructor(private readonly apiKeysByTenant: Record<string, string>) {}

  async findActiveCredentials(tenantId: string): Promise<Record<string, unknown> | null> {
    this.tenantIds.push(tenantId);

    const apiKey = this.apiKeysByTenant[tenantId];

    return apiKey ? { api_key_encrypted: encryptSecret(apiKey) } : null;
  }
}

/** Registra la chiave inviata al provider per ogni richiesta HTTP. */
class RecordingWhatsAppProvider {
  readonly requests: Array<{ apiKey: string | null; to: unknown }> = [];

  readonly fetcher = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body: unknown = JSON.parse(String(init?.body ?? '{}'));

    this.requests.push({
      apiKey: new Headers(init?.headers).get('D360-API-KEY'),
      to: typeof body === 'object' && body !== null && 'to' in body ? body.to : null,
    });

    return Response.json({ messages: [{ id: `wamid.${this.requests.length}` }] }, { status: 201 });
  };
}

class FakeOutboxRepository implements WhatsAppOutboxRepository {
  readonly sentJobs: Array<{ jobId: string }> = [];
  readonly retriedJobs: Array<{ jobId: string; error: { code: string; message: string } }> = [];
  readonly deadLetters: Array<{ jobId: string; error: { code: string; message: string } }> = [];

  constructor(private readonly jobs: ClaimedWhatsAppOutboxJob[]) {}

  async claimReadyJobs(): Promise<ClaimedWhatsAppOutboxJob[]> {
    return this.jobs;
  }

  async markJobSent(input: { jobId: string }): Promise<void> {
    this.sentJobs.push({ jobId: input.jobId });
  }

  async scheduleJobRetry(input: {
    jobId: string;
    error: { code: string; message: string };
  }): Promise<void> {
    this.retriedJobs.push({ jobId: input.jobId, error: input.error });
  }

  async markJobDeadLetter(input: {
    jobId: string;
    error: { code: string; message: string };
  }): Promise<void> {
    this.deadLetters.push({ jobId: input.jobId, error: input.error });
  }
}
