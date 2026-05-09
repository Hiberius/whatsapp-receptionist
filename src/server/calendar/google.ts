import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import {
  parseGoogleCalendarEventResponse,
  parseGoogleFreeBusyResponse,
  parseGoogleTokenResponse,
  type GoogleCalendarEventResponse,
  type GoogleFreeBusyResponse,
  type GoogleOAuthTokenResponse,
} from '@/lib/external-schemas/google';
import { readCredentialSecret } from '@/server/integrations/credential-encryption';

export type CalendarBusyInterval = {
  start: Date;
  end: Date;
  source: 'google_calendar' | 'local_appointment';
};

export type GoogleCalendarIntegration = {
  id: string;
  tenantId: string;
  externalAccountId: string | null;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
};

export type GoogleCalendarEventInput = {
  appointmentId: string;
  tenantId: string;
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  timezone: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
};

export type GoogleCalendarEventResult = {
  eventId: string;
  htmlLink: string | null;
  raw: unknown;
};

type Fetcher = typeof fetch;

type GoogleCalendarProviderOptions = {
  fetcher?: Fetcher;
  apiBaseUrl?: string;
  tokenUrl?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  onTokenRefresh?: (input: {
    integration: GoogleCalendarIntegration;
    accessToken: string;
    expiresAt: number | null;
    scope: string | null;
    tokenType: string | null;
  }) => Promise<void>;
};

// I tipi `GoogleOAuthTokenResponse`, `GoogleFreeBusyResponse`,
// `GoogleCalendarEventResponse` sono definiti in
// `@/lib/external-schemas/google` e validati con Zod a runtime.

export class GoogleCalendarProvider {
  private readonly fetcher: Fetcher;
  private readonly apiBaseUrl: string;
  private readonly tokenUrl: string;
  private readonly oauthClientId: string;
  private readonly oauthClientSecret: string;
  private readonly onTokenRefresh: GoogleCalendarProviderOptions['onTokenRefresh'];

  constructor(options: GoogleCalendarProviderOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.apiBaseUrl = options.apiBaseUrl ?? 'https://www.googleapis.com/calendar/v3';
    this.tokenUrl = options.tokenUrl ?? env.GOOGLE_OAUTH_TOKEN_URL;
    this.oauthClientId = options.oauthClientId ?? env.GOOGLE_OAUTH_CLIENT_ID;
    this.oauthClientSecret = options.oauthClientSecret ?? env.GOOGLE_OAUTH_CLIENT_SECRET;
    this.onTokenRefresh = options.onTokenRefresh;
  }

  async listBusy(input: {
    integration: GoogleCalendarIntegration;
    from: Date;
    to: Date;
    timezone: string;
  }): Promise<CalendarBusyInterval[]> {
    const calendarId = calendarIdForIntegration(input.integration);
    const accessToken = await this.getAccessToken(input.integration);
    const response = await this.fetcher(`${this.apiBaseUrl}/freeBusy`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: input.from.toISOString(),
        timeMax: input.to.toISOString(),
        timeZone: input.timezone,
        items: [{ id: calendarId }],
      }),
    });
    const rawBody = await readJson(response);
    const body: GoogleFreeBusyResponse = parseGoogleFreeBusyResponse(rawBody);

    if (!response.ok) {
      throw googleCalendarError('Google Calendar freeBusy failed', response, rawBody);
    }

    const calendar = body.calendars?.[calendarId];
    const firstError = calendar?.errors?.[0];

    if (firstError) {
      throw new AppError(
        'upstream_error',
        `Google Calendar freeBusy returned ${firstError.reason ?? 'error'}`,
        { cause: firstError, expose: false },
      );
    }

    return (calendar?.busy ?? [])
      .map((interval) => ({
        start: parseGoogleDate(interval.start),
        end: parseGoogleDate(interval.end),
        source: 'google_calendar' as const,
      }))
      .filter((interval) => interval.start < interval.end);
  }

  async createEvent(
    input: GoogleCalendarEventInput & {
      integration: GoogleCalendarIntegration;
    },
  ): Promise<GoogleCalendarEventResult> {
    const calendarId = input.calendarId ?? calendarIdForIntegration(input.integration);
    const accessToken = await this.getAccessToken(input.integration);
    const sendUpdates = sendUpdatesForIntegration(input.integration);
    const url = new URL(`${this.apiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('sendUpdates', sendUpdates);

    const response = await this.fetcher(url.toString(), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ...googleCalendarEventBody(input),
      }),
    });
    const rawBody = await readJson(response);
    const body: GoogleCalendarEventResponse = parseGoogleCalendarEventResponse(rawBody);

    if (!response.ok) {
      throw googleCalendarError('Google Calendar event insert failed', response, rawBody);
    }

    if (!body.id) {
      throw new AppError('upstream_error', 'Google Calendar event insert returned no event id', {
        cause: rawBody,
        expose: false,
      });
    }

    return {
      eventId: body.id,
      htmlLink: body.htmlLink ?? null,
      raw: rawBody,
    };
  }

  async updateEvent(
    input: GoogleCalendarEventInput & {
      integration: GoogleCalendarIntegration;
      eventId: string;
    },
  ): Promise<GoogleCalendarEventResult> {
    const calendarId = input.calendarId ?? calendarIdForIntegration(input.integration);
    const accessToken = await this.getAccessToken(input.integration);
    const sendUpdates = sendUpdatesForIntegration(input.integration);
    const url = new URL(
      `${this.apiBaseUrl}/calendars/${encodeURIComponent(
        calendarId,
      )}/events/${encodeURIComponent(input.eventId)}`,
    );
    url.searchParams.set('sendUpdates', sendUpdates);

    const response = await this.fetcher(url.toString(), {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(googleCalendarEventBody(input)),
    });
    const rawBody = await readJson(response);
    const body: GoogleCalendarEventResponse = parseGoogleCalendarEventResponse(rawBody);

    if (!response.ok) {
      throw googleCalendarError('Google Calendar event update failed', response, rawBody);
    }

    if (!body.id) {
      throw new AppError('upstream_error', 'Google Calendar event update returned no event id', {
        cause: rawBody,
        expose: false,
      });
    }

    return {
      eventId: body.id,
      htmlLink: body.htmlLink ?? null,
      raw: rawBody,
    };
  }

  async cancelEvent(input: {
    integration: GoogleCalendarIntegration;
    eventId: string;
    calendarId?: string;
  }): Promise<{ cancelled: true }> {
    const calendarId = input.calendarId ?? calendarIdForIntegration(input.integration);
    const accessToken = await this.getAccessToken(input.integration);
    const sendUpdates = sendUpdatesForIntegration(input.integration);
    const url = new URL(
      `${this.apiBaseUrl}/calendars/${encodeURIComponent(
        calendarId,
      )}/events/${encodeURIComponent(input.eventId)}`,
    );
    url.searchParams.set('sendUpdates', sendUpdates);

    const response = await this.fetcher(url.toString(), {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if ([200, 204, 404, 410].includes(response.status)) {
      return { cancelled: true };
    }

    const body = await readJson(response);

    throw googleCalendarError('Google Calendar event delete failed', response, body);
  }

  private async getAccessToken(integration: GoogleCalendarIntegration): Promise<string> {
    const accessToken = readCredentialSecret(integration.credentials, 'access_token');
    const expiresAt = numberFromRecord(integration.credentials, 'expires_at');
    const expiresAtMs = expiresAt ? expiresAt * (expiresAt > 10_000_000_000 ? 1 : 1000) : null;

    if (accessToken && (!expiresAtMs || expiresAtMs > Date.now() + 60_000)) {
      return accessToken;
    }

    const refreshToken = readCredentialSecret(integration.credentials, 'refresh_token');

    if (!refreshToken) {
      throw new AppError(
        'upstream_error',
        'Google Calendar credentials are missing access_token or refresh_token',
        { expose: false },
      );
    }

    if (!this.oauthClientId || !this.oauthClientSecret) {
      throw new AppError('internal', 'Google OAuth client credentials are not configured', {
        expose: false,
      });
    }

    const response = await this.fetcher(this.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.oauthClientId,
        client_secret: this.oauthClientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    const rawBody = await readJson(response);
    const body: GoogleOAuthTokenResponse = parseGoogleTokenResponse(rawBody);

    if (!response.ok || !body.access_token) {
      throw googleCalendarError('Google OAuth token refresh failed', response, rawBody);
    }

    await this.onTokenRefresh?.({
      integration,
      accessToken: body.access_token,
      expiresAt: body.expires_in ? Math.floor((Date.now() + body.expires_in * 1000) / 1000) : null,
      scope: null,
      tokenType: body.token_type ?? null,
    });

    return body.access_token;
  }
}

function googleCalendarEventBody(input: GoogleCalendarEventInput): Record<string, unknown> {
  return {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: {
      dateTime: input.start.toISOString(),
      timeZone: input.timezone,
    },
    end: {
      dateTime: input.end.toISOString(),
      timeZone: input.timezone,
    },
    attendees: attendeeList(input.customerEmail),
    transparency: 'opaque',
    reminders: {
      useDefault: false,
    },
    extendedProperties: {
      private: {
        source: 'ambrogio.ai',
        tenantId: input.tenantId,
        appointmentId: input.appointmentId,
        customerPhone: input.customerPhone ?? '',
      },
    },
  };
}

function calendarIdForIntegration(integration: GoogleCalendarIntegration): string {
  return (
    stringFromRecord(integration.config, 'calendar_id') ??
    stringFromRecord(integration.config, 'calendarId') ??
    integration.externalAccountId ??
    'primary'
  );
}

function sendUpdatesForIntegration(
  integration: GoogleCalendarIntegration,
): 'all' | 'externalOnly' | 'none' {
  const value =
    stringFromRecord(integration.config, 'send_updates') ??
    stringFromRecord(integration.config, 'sendUpdates');

  if (value === 'all' || value === 'externalOnly' || value === 'none') {
    return value;
  }

  return 'none';
}

function attendeeList(
  customerEmail?: string | null,
): Array<{ email: string; displayName?: string }> | undefined {
  const email = customerEmail?.trim();

  return email ? [{ email }] : undefined;
}

function parseGoogleDate(value: string | undefined): Date {
  if (!value) {
    throw new AppError('upstream_error', 'Google Calendar returned an empty date');
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError('upstream_error', 'Google Calendar returned invalid date', {
      cause: value,
      expose: false,
    });
  }

  return date;
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

function googleCalendarError(message: string, response: Response, body: unknown): AppError {
  return new AppError('upstream_error', message, {
    cause: {
      status: response.status,
      body,
    },
    expose: false,
  });
}

function stringFromRecord(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberFromRecord(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
