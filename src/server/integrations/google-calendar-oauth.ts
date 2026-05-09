import { randomUUID } from 'node:crypto';

import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import {
  parseGoogleTokenResponse,
  type GoogleOAuthTokenResponse,
} from '@/lib/external-schemas/google';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AuthSession } from '@/lib/auth/session';
import {
  buildGoogleCalendarCredentials,
  readCredentialSecret,
} from '@/server/integrations/credential-encryption';
import {
  safeRelativeReturnTo,
  signOAuthState,
  verifyOAuthState,
} from '@/server/integrations/oauth-state';

export type GoogleCalendarIntegrationRecord = {
  id: string;
  tenantId: string;
  externalDisplayId: string | null;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  status: 'active' | 'paused' | 'error' | 'revoked';
  lastSyncAt: string | null;
  updatedAt: string | null;
};

export type GoogleCalendarIntegrationStatus = {
  provider: 'google_calendar';
  connected: boolean;
  status: 'not_connected' | 'active' | 'paused' | 'error' | 'revoked';
  calendarId: string | null;
  externalDisplayId: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastSyncAt: string | null;
  updatedAt: string | null;
  scopes: string[];
  canManage: boolean;
  connectUrl: string;
  disconnectUrl: string;
};

export type UpsertGoogleCalendarIntegrationInput = {
  tenantId: string;
  userId: string;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  connectedAt: Date;
};

export type GoogleCalendarOAuthRepository = {
  getGoogleCalendarIntegration(tenantId: string): Promise<GoogleCalendarIntegrationRecord | null>;
  upsertGoogleCalendarIntegration(
    input: UpsertGoogleCalendarIntegrationInput,
  ): Promise<GoogleCalendarIntegrationRecord>;
  markGoogleCalendarDisconnected(input: {
    tenantId: string;
    integrationId: string;
    disconnectedAt: Date;
  }): Promise<void>;
};

export type GoogleCalendarOAuthServiceOptions = {
  fetcher?: typeof fetch;
  authUrl?: string;
  tokenUrl?: string;
  revokeUrl?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  stateSecret?: string;
};

// `GoogleOAuthTokenResponse` viene re-esportato da `@/lib/external-schemas/google`
// per usare lo stesso schema Zod runtime in tutto il codebase.

const calendarScopes = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

export class GoogleCalendarOAuthService {
  private readonly fetcher: typeof fetch;
  private readonly authUrl: string;
  private readonly tokenUrl: string;
  private readonly revokeUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly stateSecret: string;

  constructor(
    private readonly repository: GoogleCalendarOAuthRepository,
    options: GoogleCalendarOAuthServiceOptions = {},
  ) {
    this.fetcher = options.fetcher ?? fetch;
    this.authUrl = options.authUrl ?? env.GOOGLE_OAUTH_AUTH_URL;
    this.tokenUrl = options.tokenUrl ?? env.GOOGLE_OAUTH_TOKEN_URL;
    this.revokeUrl = options.revokeUrl ?? env.GOOGLE_OAUTH_REVOKE_URL;
    this.clientId = options.clientId ?? env.GOOGLE_OAUTH_CLIENT_ID;
    this.clientSecret = options.clientSecret ?? env.GOOGLE_OAUTH_CLIENT_SECRET;
    this.redirectUri =
      options.redirectUri ??
      (env.GOOGLE_CALENDAR_REDIRECT_URI ||
        `${env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`);
    this.stateSecret =
      options.stateSecret ?? process.env.GOOGLE_OAUTH_STATE_SECRET ?? env.GOOGLE_OAUTH_STATE_SECRET;
  }

  createAuthorizationUrl(input: {
    session: AuthSession;
    returnTo?: string | null;
    now?: Date;
  }): string {
    assertIntegrationAdmin(input.session);
    this.assertOAuthConfigured();

    const state = signOAuthState(
      {
        tenantId: input.session.tenantId,
        userId: input.session.userId,
        role: input.session.role,
        returnTo: safeRelativeReturnTo(input.returnTo),
        nonce: randomUUID(),
        issuedAt: (input.now ?? new Date()).getTime(),
      },
      this.stateSecret,
    );
    const url = new URL(this.authUrl);

    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', calendarScopes.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);

    return url.toString();
  }

  async getStatus(input: {
    session: AuthSession;
    returnTo?: string | null;
  }): Promise<GoogleCalendarIntegrationStatus> {
    const integration = await this.repository.getGoogleCalendarIntegration(input.session.tenantId);
    const returnTo = safeRelativeReturnTo(input.returnTo);
    const connectUrl = `/api/integrations/google-calendar/connect?returnTo=${encodeURIComponent(
      returnTo,
    )}`;
    const base = {
      provider: 'google_calendar' as const,
      canManage: canManageIntegrations(input.session),
      connectUrl,
      disconnectUrl: '/api/integrations/google-calendar/disconnect',
    };

    if (!integration || integration.status === 'revoked') {
      return {
        ...base,
        connected: false,
        status: integration?.status ?? 'not_connected',
        calendarId: null,
        externalDisplayId: integration?.externalDisplayId ?? null,
        connectedAt: null,
        disconnectedAt: stringOrNull(integration?.config.disconnected_at),
        lastSyncAt: integration?.lastSyncAt ?? null,
        updatedAt: integration?.updatedAt ?? null,
        scopes: [],
      };
    }

    return {
      ...base,
      connected: integration.status === 'active',
      status: integration.status,
      calendarId: stringOrDefault(integration.config.calendar_id, 'primary'),
      externalDisplayId: integration.externalDisplayId,
      connectedAt: stringOrNull(integration.config.connected_at),
      disconnectedAt: stringOrNull(integration.config.disconnected_at),
      lastSyncAt: integration.lastSyncAt,
      updatedAt: integration.updatedAt,
      scopes: stringArray(integration.config.scopes),
    };
  }

  async handleCallback(input: {
    session: AuthSession;
    code: string | null;
    state: string | null;
    error?: string | null;
    now?: Date;
  }): Promise<{ returnTo: string; integrationId: string | null; status: 'connected' }> {
    assertIntegrationAdmin(input.session);

    if (input.error) {
      throw new AppError('bad_request', `Google OAuth failed: ${input.error}`);
    }

    if (!input.code?.trim()) {
      throw new AppError('bad_request', 'Google OAuth code is missing');
    }

    if (!input.state?.trim()) {
      throw new AppError('bad_request', 'Google OAuth state is missing');
    }

    this.assertOAuthConfigured();
    const verifiedState = verifyOAuthState({
      state: input.state,
      secret: this.stateSecret,
      now: input.now ?? new Date(),
    });

    if (
      verifiedState.tenantId !== input.session.tenantId ||
      verifiedState.userId !== input.session.userId
    ) {
      throw new AppError('forbidden', 'OAuth state does not match session');
    }

    const existing = await this.repository.getGoogleCalendarIntegration(input.session.tenantId);
    const tokens = await this.exchangeCode(input.code.trim());
    const expiresAt = expiresAtFromToken(tokens, input.now ?? new Date());
    const credentials = buildGoogleCalendarCredentials({
      accessToken: requiredToken(tokens.access_token),
      ...(tokens.refresh_token !== undefined ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt,
      scope: tokens.scope ?? calendarScopes.join(' '),
      tokenType: tokens.token_type ?? 'Bearer',
      ...(existing?.credentials !== undefined ? { existing: existing.credentials } : {}),
    });
    const integration = await this.repository.upsertGoogleCalendarIntegration({
      tenantId: input.session.tenantId,
      userId: input.session.userId,
      credentials,
      connectedAt: input.now ?? new Date(),
      config: {
        ...existing?.config,
        calendar_id: stringOrDefault(existing?.config.calendar_id, 'primary'),
        connected_by_user_id: input.session.userId,
        connected_at: (input.now ?? new Date()).toISOString(),
        scopes: tokens.scope?.split(' ') ?? calendarScopes,
      },
    });

    return {
      returnTo: withStatusParam(verifiedState.returnTo, 'connected'),
      integrationId: integration.id,
      status: 'connected',
    };
  }

  async disconnect(input: {
    session: AuthSession;
    now?: Date;
  }): Promise<{ disconnected: boolean }> {
    assertIntegrationAdmin(input.session);
    const integration = await this.repository.getGoogleCalendarIntegration(input.session.tenantId);

    if (!integration || integration.status === 'revoked') {
      return { disconnected: false };
    }

    const token =
      readCredentialSecret(integration.credentials, 'access_token') ??
      readCredentialSecret(integration.credentials, 'refresh_token');

    if (token) {
      await this.revokeToken(token);
    }

    await this.repository.markGoogleCalendarDisconnected({
      tenantId: input.session.tenantId,
      integrationId: integration.id,
      disconnectedAt: input.now ?? new Date(),
    });

    return { disconnected: true };
  }

  private async exchangeCode(code: string): Promise<GoogleOAuthTokenResponse> {
    const response = await this.fetcher(this.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const rawBody = await readJson(response);
    const body: GoogleOAuthTokenResponse = parseGoogleTokenResponse(rawBody);

    if (!response.ok || !body.access_token) {
      throw new AppError('upstream_error', 'Google OAuth token exchange failed', {
        cause: {
          status: response.status,
          body: rawBody,
        },
        expose: false,
      });
    }

    return body;
  }

  private async revokeToken(token: string): Promise<void> {
    const response = await this.fetcher(this.revokeUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });

    if (!response.ok && response.status !== 400) {
      throw new AppError('upstream_error', 'Google OAuth token revoke failed', {
        cause: {
          status: response.status,
          body: await readJson(response),
        },
        expose: false,
      });
    }
  }

  private assertOAuthConfigured(): void {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new AppError('internal', 'Google OAuth client configuration is incomplete', {
        expose: false,
      });
    }

    if (!this.stateSecret.trim()) {
      throw new AppError('internal', 'Google OAuth state secret is not configured', {
        expose: false,
      });
    }
  }
}

export class SupabaseGoogleCalendarOAuthRepository implements GoogleCalendarOAuthRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getGoogleCalendarIntegration(
    tenantId: string,
  ): Promise<GoogleCalendarIntegrationRecord | null> {
    const { data, error } = await this.supabase
      .from('integrations')
      .select(
        'id, tenant_id, external_display_id, credentials, config, status, last_sync_at, updated_at',
      )
      .eq('tenant_id', tenantId)
      .eq('provider', 'google_calendar')
      .is('external_account_id', null)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read Google Calendar integration', error);
    }

    if (!data) {
      return null;
    }

    return integrationRecordFromRow(data as IntegrationRow);
  }

  async upsertGoogleCalendarIntegration(
    input: UpsertGoogleCalendarIntegrationInput,
  ): Promise<GoogleCalendarIntegrationRecord> {
    const existing = await this.getGoogleCalendarIntegration(input.tenantId);
    const mutation = {
      tenant_id: input.tenantId,
      provider: 'google_calendar',
      external_account_id: null,
      external_display_id: 'Google Calendar',
      status: 'active',
      credentials: input.credentials,
      config: input.config,
      last_sync_at: input.connectedAt.toISOString(),
      updated_at: input.connectedAt.toISOString(),
    };

    const query = existing
      ? this.supabase
          .from('integrations')
          .update(mutation)
          .eq('tenant_id', input.tenantId)
          .eq('id', existing.id)
          .eq('provider', 'google_calendar')
      : this.supabase.from('integrations').insert(mutation);
    const { data, error } = await query
      .select(
        'id, tenant_id, external_display_id, credentials, config, status, last_sync_at, updated_at',
      )
      .single();

    if (error) {
      throw toRepositoryError('Failed to upsert Google Calendar integration', error);
    }

    return integrationRecordFromRow(data as IntegrationRow);
  }

  async markGoogleCalendarDisconnected(input: {
    tenantId: string;
    integrationId: string;
    disconnectedAt: Date;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('integrations')
      .update({
        status: 'revoked',
        credentials: {},
        config: {
          disconnected_at: input.disconnectedAt.toISOString(),
        },
        updated_at: input.disconnectedAt.toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.integrationId)
      .eq('provider', 'google_calendar');

    if (error) {
      throw toRepositoryError('Failed to disconnect Google Calendar integration', error);
    }
  }
}

export function createGoogleCalendarOAuthService(): GoogleCalendarOAuthService {
  return new GoogleCalendarOAuthService(new SupabaseGoogleCalendarOAuthRepository());
}

type IntegrationRow = {
  id: string;
  tenant_id: string;
  external_display_id: string | null;
  credentials: unknown;
  config: unknown;
  status: 'active' | 'paused' | 'error' | 'revoked';
  last_sync_at: string | null;
  updated_at: string | null;
};

function canManageIntegrations(session: AuthSession): boolean {
  return session.role === 'owner' || session.role === 'admin';
}

function assertIntegrationAdmin(
  session: AuthSession,
): asserts session is AuthSession & { role: 'owner' | 'admin' } {
  if (!canManageIntegrations(session)) {
    throw new AppError('forbidden', 'Admin role required');
  }
}

function expiresAtFromToken(token: GoogleOAuthTokenResponse, now: Date): number | null {
  if (!token.expires_in || !Number.isFinite(token.expires_in)) {
    return null;
  }

  return Math.floor((now.getTime() + token.expires_in * 1000) / 1000);
}

function requiredToken(value: string | undefined): string {
  if (!value?.trim()) {
    throw new AppError('upstream_error', 'Google OAuth access token is missing', {
      expose: false,
    });
  }

  return value.trim();
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function withStatusParam(returnTo: string, status: string): string {
  const url = new URL(returnTo, 'http://ambrogio.local');
  url.searchParams.set('google_calendar', status);

  return `${url.pathname}${url.search}${url.hash}`;
}

function integrationRecordFromRow(row: IntegrationRow): GoogleCalendarIntegrationRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    externalDisplayId: row.external_display_id,
    credentials: toPlainRecord(row.credentials),
    config: toPlainRecord(row.config),
    status: row.status,
    lastSyncAt: row.last_sync_at,
    updatedAt: row.updated_at,
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    // JSON.parse ritorna `any`; lo trattiamo come `unknown` per forzare
    // narrowing nei chiamanti (Zod parse o type guards).
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return { raw: text };
  }
}

function toPlainRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toRepositoryError(message: string, cause: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause,
    expose: false,
  });
}
