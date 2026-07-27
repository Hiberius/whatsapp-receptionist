// Logica della schermata "Servizi e listino": conversione euro↔centesimi,
// validazione della bozza, patch differenziale e chiamate REST.
//
// Il prezzo viaggia in centesimi interi come nel resto del codebase: i test
// coprono gli input che rompono l'aritmetica in virgola mobile.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SERVICES_ENDPOINT,
  archiveService,
  buildServicePatch,
  centsToPriceInput,
  createService,
  formatDuration,
  formatPrice,
  parseDurationMinutes,
  parsePriceToCents,
  toServiceDraft,
  updateService,
  validateServiceDraft,
  type ServiceDraft,
  type ServiceView,
} from '@/components/settings/services-model';

const SERVICE: ServiceView = {
  id: 'svc-1',
  name: 'Pulizia dentale',
  description: 'Igiene professionale',
  durationMinutes: 45,
  priceCents: 8000,
  active: true,
};

function draft(overrides: Partial<ServiceDraft> = {}): ServiceDraft {
  return {
    name: 'Pulizia dentale',
    description: 'Igiene professionale',
    durationMinutes: '45',
    price: '80,00',
    active: true,
    ...overrides,
  };
}

describe('parsePriceToCents', () => {
  it('returns null for an empty price', () => {
    expect(parsePriceToCents('')).toBeNull();
    expect(parsePriceToCents('   ')).toBeNull();
  });

  it('converts whole euros to cents', () => {
    expect(parsePriceToCents('35')).toBe(3500);
  });

  it('accepts both comma and dot as decimal separator', () => {
    expect(parsePriceToCents('35,50')).toBe(3550);
    expect(parsePriceToCents('35.50')).toBe(3550);
  });

  it('pads a single decimal digit', () => {
    expect(parsePriceToCents('35,5')).toBe(3550);
  });

  it('stays exact on values that break float arithmetic', () => {
    expect(parsePriceToCents('1,15')).toBe(115);
    expect(parsePriceToCents('8,29')).toBe(829);
  });

  it('rejects more than two decimals, negatives and free text', () => {
    expect(parsePriceToCents('35,555')).toBe('invalid');
    expect(parsePriceToCents('-5')).toBe('invalid');
    expect(parsePriceToCents('gratis')).toBe('invalid');
  });
});

describe('parseDurationMinutes', () => {
  it('accepts a duration inside the range allowed by the API', () => {
    expect(parseDurationMinutes('45')).toBe(45);
    expect(parseDurationMinutes('5')).toBe(5);
    expect(parseDurationMinutes('480')).toBe(480);
  });

  it('rejects values outside the range or not integer', () => {
    expect(parseDurationMinutes('4')).toBeNull();
    expect(parseDurationMinutes('481')).toBeNull();
    expect(parseDurationMinutes('30,5')).toBeNull();
    expect(parseDurationMinutes('')).toBeNull();
  });
});

describe('centsToPriceInput / formatPrice / formatDuration', () => {
  it('renders cents back into an editable euro value', () => {
    expect(centsToPriceInput(null)).toBe('');
    expect(centsToPriceInput(3500)).toBe('35,00');
    expect(centsToPriceInput(5)).toBe('0,05');
    expect(centsToPriceInput(3550)).toBe('35,50');
  });

  it('says explicitly when no price is set instead of showing zero', () => {
    expect(formatPrice(null)).toBe('Prezzo non indicato');
    expect(formatPrice(3500)).toContain('35,00');
  });

  it('renders durations longer than an hour in hours and minutes', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30 min');
  });
});

describe('toServiceDraft', () => {
  it('maps a saved service into editable form fields', () => {
    expect(toServiceDraft(SERVICE)).toEqual({
      name: 'Pulizia dentale',
      description: 'Igiene professionale',
      durationMinutes: '45',
      price: '80,00',
      active: true,
    });
  });

  it('turns a missing description and price into empty fields', () => {
    expect(toServiceDraft({ ...SERVICE, description: null, priceCents: null })).toMatchObject({
      description: '',
      price: '',
    });
  });
});

describe('validateServiceDraft', () => {
  it('normalizes a valid draft, trimming text and converting the price', () => {
    const validation = validateServiceDraft(draft({ name: '  Sbiancamento  ', price: '120,90' }));

    expect(validation).toEqual({
      ok: true,
      value: {
        name: 'Sbiancamento',
        description: 'Igiene professionale',
        durationMinutes: 45,
        priceCents: 12090,
        active: true,
      },
    });
  });

  it('turns an empty description into null', () => {
    const validation = validateServiceDraft(draft({ description: '   ' }));

    expect(validation.ok).toBe(true);
    expect(validation.ok ? validation.value.description : null).toBeNull();
  });

  it('requires a name', () => {
    const validation = validateServiceDraft(draft({ name: '  ' }));

    expect(validation.ok).toBe(false);

    if (validation.ok) {
      return;
    }

    expect(validation.errors.name).toBeDefined();
  });

  it('reports an out of range duration and an invalid price together', () => {
    const validation = validateServiceDraft(draft({ durationMinutes: '3', price: '12,999' }));

    expect(validation.ok).toBe(false);

    if (validation.ok) {
      return;
    }

    expect(validation.errors.durationMinutes).toBeDefined();
    expect(validation.errors.price).toBeDefined();
  });

  it('rejects a price above the maximum accepted by the API', () => {
    const validation = validateServiceDraft(draft({ price: '10001' }));

    expect(validation.ok).toBe(false);

    if (validation.ok) {
      return;
    }

    expect(validation.errors.price).toBeDefined();
  });
});

describe('buildServicePatch', () => {
  it('is empty when nothing changed', () => {
    const patch = buildServicePatch(SERVICE, {
      name: SERVICE.name,
      description: SERVICE.description,
      durationMinutes: SERVICE.durationMinutes,
      priceCents: SERVICE.priceCents,
      active: SERVICE.active,
    });

    expect(patch).toEqual({});
  });

  it('contains only the fields that actually changed', () => {
    const patch = buildServicePatch(SERVICE, {
      name: SERVICE.name,
      description: SERVICE.description,
      durationMinutes: 60,
      priceCents: SERVICE.priceCents,
      active: SERVICE.active,
    });

    expect(patch).toEqual({ durationMinutes: 60 });
  });

  it('keeps a price cleared to null', () => {
    const patch = buildServicePatch(SERVICE, {
      name: SERVICE.name,
      description: SERVICE.description,
      durationMinutes: SERVICE.durationMinutes,
      priceCents: null,
      active: false,
    });

    expect(patch).toEqual({ priceCents: null, active: false });
  });
});

describe('service requests', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs the normalized service on creation', async () => {
    mockJsonResponse({ ok: true, data: SERVICE });

    const result = await createService({
      service: {
        name: 'Pulizia dentale',
        description: null,
        durationMinutes: 45,
        priceCents: 8000,
        active: true,
      },
    });

    const call = vi.mocked(global.fetch).mock.calls[0];
    expect(call?.[0]).toBe(SERVICES_ENDPOINT);
    expect(call?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      name: 'Pulizia dentale',
      description: null,
      durationMinutes: 45,
      priceCents: 8000,
      active: true,
    });
    expect(result).toEqual({ ok: true, data: SERVICE });
  });

  it('PATCHes only the patch payload on the service url', async () => {
    mockJsonResponse({ ok: true, data: { ...SERVICE, durationMinutes: 60 } });

    await updateService({ serviceId: 'svc 1/x', patch: { durationMinutes: 60 } });

    const call = vi.mocked(global.fetch).mock.calls[0];
    expect(call?.[0]).toBe(`${SERVICES_ENDPOINT}/svc%201%2Fx`);
    expect(call?.[1]?.method).toBe('PATCH');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ durationMinutes: 60 });
  });

  it('DELETEs without a body when archiving', async () => {
    mockJsonResponse({ ok: true, data: { ...SERVICE, active: false } });

    const result = await archiveService({ serviceId: 'svc-1' });

    const call = vi.mocked(global.fetch).mock.calls[0];
    expect(call?.[0]).toBe(`${SERVICES_ENDPOINT}/svc-1`);
    expect(call?.[1]?.method).toBe('DELETE');
    expect(call?.[1]?.body).toBeUndefined();
    expect(result).toEqual({ ok: true, data: { ...SERVICE, active: false } });
  });

  it('translates a 403 into a message about permissions', async () => {
    mockJsonResponse(
      { ok: false, error: { code: 'forbidden', message: 'Admin role required' } },
      { status: 403 },
    );

    const result = await archiveService({ serviceId: 'svc-1' });

    expect(result).toEqual({
      ok: false,
      message: 'Non hai i permessi per completare questa operazione.',
    });
  });

  it('falls back to the operation message on an unmapped error', async () => {
    mockJsonResponse(
      { ok: false, error: { code: 'internal', message: 'Internal server error' } },
      { status: 500 },
    );

    const result = await createService({
      service: {
        name: 'Pulizia dentale',
        description: null,
        durationMinutes: 45,
        priceCents: null,
        active: true,
      },
    });

    expect(result).toEqual({
      ok: false,
      message: 'Non siamo riusciti a creare il servizio. Riprova tra poco.',
    });
  });
});

function mockJsonResponse(payload: unknown, init: { status?: number } = {}): void {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
      status: init.status ?? 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}
