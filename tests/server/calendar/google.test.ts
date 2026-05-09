import { describe, expect, it, vi } from 'vitest';

import { GoogleCalendarProvider, type GoogleCalendarIntegration } from '@/server/calendar/google';
import { buildGoogleCalendarCredentials } from '@/server/integrations/credential-encryption';

describe('GoogleCalendarProvider', () => {
  it('queries Google freeBusy and normalizes busy intervals', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        calendars: {
          primary: {
            busy: [
              {
                start: '2026-04-27T09:30:00.000Z',
                end: '2026-04-27T10:00:00.000Z',
              },
            ],
          },
        },
      }),
    );
    const provider = new GoogleCalendarProvider({ fetcher });

    const busy = await provider.listBusy({
      integration: integration(),
      from: new Date('2026-04-27T09:00:00.000Z'),
      to: new Date('2026-04-27T12:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://www.googleapis.com/calendar/v3/freeBusy',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer access_1',
        }),
      }),
    );
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      timeMin: '2026-04-27T09:00:00.000Z',
      timeMax: '2026-04-27T12:00:00.000Z',
      items: [{ id: 'primary' }],
    });
    expect(busy).toEqual([
      {
        start: new Date('2026-04-27T09:30:00.000Z'),
        end: new Date('2026-04-27T10:00:00.000Z'),
        source: 'google_calendar',
      },
    ]);
  });

  it('creates Google Calendar events with Ambrogio metadata', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        id: 'event_1',
        htmlLink: 'https://calendar.google.com/event?eid=event_1',
      }),
    );
    const provider = new GoogleCalendarProvider({ fetcher });

    const result = await provider.createEvent({
      integration: integration({
        config: { calendar_id: 'studio@example.com', send_updates: 'none' },
      }),
      appointmentId: 'appointment_1',
      tenantId: 'tenant_1',
      summary: 'Studio Ambrogio: Prima visita - Mario Rossi',
      description: 'Prenotazione creata da Ambrogio.ai',
      start: new Date('2026-04-27T09:00:00.000Z'),
      end: new Date('2026-04-27T09:30:00.000Z'),
      timezone: 'UTC',
      customerName: 'Mario Rossi',
      customerPhone: '393331112233',
    });

    expect(result).toMatchObject({
      eventId: 'event_1',
      htmlLink: 'https://calendar.google.com/event?eid=event_1',
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      '/calendars/studio%40example.com/events?sendUpdates=none',
    );
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      summary: 'Studio Ambrogio: Prima visita - Mario Rossi',
      transparency: 'opaque',
      extendedProperties: {
        private: {
          source: 'ambrogio.ai',
          tenantId: 'tenant_1',
          appointmentId: 'appointment_1',
          customerPhone: '393331112233',
        },
      },
    });
  });

  it('updates Google Calendar events for reschedules', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        id: 'event_1',
        htmlLink: 'https://calendar.google.com/event?eid=event_1',
      }),
    );
    const provider = new GoogleCalendarProvider({ fetcher });

    await provider.updateEvent({
      integration: integration({
        config: { calendar_id: 'studio@example.com', send_updates: 'all' },
      }),
      eventId: 'event_1',
      appointmentId: 'appointment_1',
      tenantId: 'tenant_1',
      summary: 'Studio Ambrogio: Prima visita - Mario Rossi',
      start: new Date('2026-04-27T10:00:00.000Z'),
      end: new Date('2026-04-27T10:30:00.000Z'),
      timezone: 'UTC',
      customerName: 'Mario Rossi',
    });

    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      '/calendars/studio%40example.com/events/event_1?sendUpdates=all',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'PATCH',
    });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      start: {
        dateTime: '2026-04-27T10:00:00.000Z',
      },
      end: {
        dateTime: '2026-04-27T10:30:00.000Z',
      },
    });
  });

  it('deletes Google Calendar events and treats missing events as already cancelled', async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('', { status: 404 }),
    );
    const provider = new GoogleCalendarProvider({ fetcher });

    await expect(
      provider.cancelEvent({
        integration: integration({
          config: { calendar_id: 'studio@example.com', send_updates: 'none' },
        }),
        eventId: 'event_1',
      }),
    ).resolves.toEqual({ cancelled: true });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      '/calendars/studio%40example.com/events/event_1?sendUpdates=none',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'DELETE',
    });
  });

  it('refreshes access tokens when only refresh_token is available', async () => {
    const fetcher = vi
      .fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'fresh_access' }))
      .mockResolvedValueOnce(jsonResponse({ calendars: { primary: { busy: [] } } }));
    const provider = new GoogleCalendarProvider({
      fetcher,
      oauthClientId: 'client_id',
      oauthClientSecret: 'client_secret',
    });

    await provider.listBusy({
      integration: integration({ credentials: { refresh_token: 'refresh_1' } }),
      from: new Date('2026-04-27T09:00:00.000Z'),
      to: new Date('2026-04-27T12:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(fetcher.mock.calls[0]?.[0]).toBe('https://oauth2.googleapis.com/token');
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain('refresh_token=refresh_1');
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({
      authorization: 'Bearer fresh_access',
    });
  });

  it('reads encrypted credentials and emits refreshed tokens for persistence', async () => {
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY = 'test-secret-with-at-least-32-characters';
    const refreshedTokens: unknown[] = [];
    const fetcher = vi
      .fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({}))
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'fresh_access',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ calendars: { primary: { busy: [] } } }));
    const provider = new GoogleCalendarProvider({
      fetcher,
      oauthClientId: 'client_id',
      oauthClientSecret: 'client_secret',
      onTokenRefresh: async (input) => {
        refreshedTokens.push(input);
      },
    });

    await provider.listBusy({
      integration: integration({
        credentials: buildGoogleCalendarCredentials({
          accessToken: 'expired_access',
          refreshToken: 'refresh_1',
          expiresAt: 1,
        }),
      }),
      from: new Date('2026-04-27T09:00:00.000Z'),
      to: new Date('2026-04-27T12:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain('refresh_token=refresh_1');
    expect(refreshedTokens[0]).toMatchObject({
      accessToken: 'fresh_access',
      tokenType: 'Bearer',
    });
  });
});

function integration(
  overrides: Partial<GoogleCalendarIntegration> = {},
): GoogleCalendarIntegration {
  return {
    id: 'integration_1',
    tenantId: 'tenant_1',
    externalAccountId: null,
    credentials: { access_token: 'access_1' },
    config: { calendar_id: 'primary' },
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}
