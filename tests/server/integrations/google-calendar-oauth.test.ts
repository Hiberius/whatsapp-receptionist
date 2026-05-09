import { describe, expect, it, vi } from 'vitest';

import type { AuthSession } from '@/lib/auth/session';
import {
  GoogleCalendarOAuthService,
  type GoogleCalendarIntegrationRecord,
  type GoogleCalendarOAuthRepository,
  type UpsertGoogleCalendarIntegrationInput,
} from '@/server/integrations/google-calendar-oauth';
import { readCredentialSecret } from '@/server/integrations/credential-encryption';
import { verifyOAuthState } from '@/server/integrations/oauth-state';

const now = new Date('2026-04-25T10:00:00.000Z');
const stateSecret = 'oauth-state-secret-with-enough-entropy';
const encryptionKey = 'credential-secret-with-at-least-32-characters';

describe('GoogleCalendarOAuthService', () => {
  it('builds a signed Google authorization URL', () => {
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = encryptionKey;
    const service = serviceWith(new FakeGoogleCalendarOAuthRepository());
    const url = new URL(
      service.createAuthorizationUrl({
        session: adminSession(),
        returnTo: '/settings?tab=calendar',
        now,
      }),
    );

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client_id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/integrations/google-calendar/callback',
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('scope')).toContain('calendar.events');

    const state = verifyOAuthState({
      state: url.searchParams.get('state') ?? '',
      secret: stateSecret,
      now,
    });
    expect(state).toMatchObject({
      tenantId: 'tenant_1',
      userId: 'user_1',
      role: 'admin',
      returnTo: '/settings?tab=calendar',
    });
  });

  it('exchanges the callback code and stores encrypted credentials', async () => {
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = encryptionKey;
    const repository = new FakeGoogleCalendarOAuthRepository();
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        access_token: 'access_1',
        refresh_token: 'refresh_1',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.events',
        token_type: 'Bearer',
      }),
    );
    const service = serviceWith(repository, { fetcher });
    const authorizationUrl = new URL(
      service.createAuthorizationUrl({
        session: adminSession(),
        returnTo: '/settings',
        now,
      }),
    );

    const result = await service.handleCallback({
      session: adminSession(),
      code: 'auth_code_1',
      state: authorizationUrl.searchParams.get('state'),
      now,
    });

    expect(result).toEqual({
      returnTo: '/settings?google_calendar=connected',
      integrationId: 'integration_1',
      status: 'connected',
    });
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain('code=auth_code_1');
    expect(repository.integration?.status).toBe('active');
    expect(repository.lastUpsert?.config).toMatchObject({
      calendar_id: 'primary',
      connected_by_user_id: 'user_1',
    });
    expect(readCredentialSecret(repository.integration?.credentials ?? {}, 'access_token')).toBe(
      'access_1',
    );
    expect(readCredentialSecret(repository.integration?.credentials ?? {}, 'refresh_token')).toBe(
      'refresh_1',
    );
  });

  it('returns safe dashboard status for a connected calendar', async () => {
    const repository = new FakeGoogleCalendarOAuthRepository();
    repository.integration = {
      id: 'integration_1',
      tenantId: 'tenant_1',
      externalDisplayId: 'Google Calendar',
      status: 'active',
      credentials: {
        access_token: 'secret_access',
        refresh_token: 'secret_refresh',
      },
      config: {
        calendar_id: 'studio@example.com',
        connected_at: '2026-04-25T10:00:00.000Z',
        scopes: ['calendar.events'],
      },
      lastSyncAt: '2026-04-25T10:00:00.000Z',
      updatedAt: '2026-04-25T10:01:00.000Z',
    };
    const service = serviceWith(repository);

    await expect(
      service.getStatus({
        session: adminSession(),
        returnTo: '/settings?tab=calendar',
      }),
    ).resolves.toEqual({
      provider: 'google_calendar',
      connected: true,
      status: 'active',
      calendarId: 'studio@example.com',
      externalDisplayId: 'Google Calendar',
      connectedAt: '2026-04-25T10:00:00.000Z',
      disconnectedAt: null,
      lastSyncAt: '2026-04-25T10:00:00.000Z',
      updatedAt: '2026-04-25T10:01:00.000Z',
      scopes: ['calendar.events'],
      canManage: true,
      connectUrl: '/api/integrations/google-calendar/connect?returnTo=%2Fsettings%3Ftab%3Dcalendar',
      disconnectUrl: '/api/integrations/google-calendar/disconnect',
    });
  });

  it('returns safe dashboard status for members without exposing management', async () => {
    const repository = new FakeGoogleCalendarOAuthRepository();
    const service = serviceWith(repository);

    await expect(
      service.getStatus({
        session: {
          ...adminSession(),
          role: 'member',
        },
        returnTo: 'https://evil.example/settings',
      }),
    ).resolves.toMatchObject({
      connected: false,
      status: 'not_connected',
      calendarId: null,
      scopes: [],
      canManage: false,
      connectUrl: '/api/integrations/google-calendar/connect?returnTo=%2Fsettings',
    });
  });

  it('disconnects and revokes the stored token', async () => {
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = encryptionKey;
    const repository = new FakeGoogleCalendarOAuthRepository();
    const credentials = {
      access_token: 'access_1',
      refresh_token: 'refresh_1',
    };
    repository.integration = {
      id: 'integration_1',
      tenantId: 'tenant_1',
      externalDisplayId: 'Google Calendar',
      status: 'active',
      credentials,
      config: { calendar_id: 'primary' },
      lastSyncAt: null,
      updatedAt: null,
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({}),
    );
    const service = serviceWith(repository, { fetcher });

    await expect(service.disconnect({ session: adminSession(), now })).resolves.toEqual({
      disconnected: true,
    });

    expect(fetcher.mock.calls[0]?.[0]).toBe('https://oauth2.googleapis.com/revoke');
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toBe('token=access_1');
    expect(repository.integration.status).toBe('revoked');
    expect(repository.integration.credentials).toEqual({});
  });
});

class FakeGoogleCalendarOAuthRepository implements GoogleCalendarOAuthRepository {
  integration: GoogleCalendarIntegrationRecord | null = null;
  lastUpsert: UpsertGoogleCalendarIntegrationInput | null = null;

  async getGoogleCalendarIntegration(): Promise<GoogleCalendarIntegrationRecord | null> {
    return this.integration;
  }

  async upsertGoogleCalendarIntegration(
    input: UpsertGoogleCalendarIntegrationInput,
  ): Promise<GoogleCalendarIntegrationRecord> {
    this.lastUpsert = input;
    this.integration = {
      id: 'integration_1',
      tenantId: input.tenantId,
      externalDisplayId: 'Google Calendar',
      credentials: input.credentials,
      config: input.config,
      status: 'active',
      lastSyncAt: input.connectedAt.toISOString(),
      updatedAt: input.connectedAt.toISOString(),
    };

    return this.integration;
  }

  async markGoogleCalendarDisconnected(): Promise<void> {
    if (this.integration) {
      this.integration = {
        ...this.integration,
        credentials: {},
        status: 'revoked',
        config: {
          disconnected_at: now.toISOString(),
        },
      };
    }
  }
}

function serviceWith(
  repository: GoogleCalendarOAuthRepository,
  options: { fetcher?: typeof fetch } = {},
): GoogleCalendarOAuthService {
  return new GoogleCalendarOAuthService(repository, {
    ...(options.fetcher !== undefined ? { fetcher: options.fetcher } : {}),
    clientId: 'client_id',
    clientSecret: 'client_secret',
    redirectUri: 'http://localhost:3000/api/integrations/google-calendar/callback',
    stateSecret,
  });
}

function adminSession(): AuthSession {
  return {
    userId: 'user_1',
    tenantId: 'tenant_1',
    role: 'admin',
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}
