/* eslint-disable no-restricted-syntax -- Test fixtures: il fake mock del booking
service viene castato a `AppointmentBookingService` solo per soddisfare la
firma del costruttore. La validazione runtime non aggiungerebbe valore in test. */
import { describe, expect, it } from 'vitest';

import {
  BookingBridgeService,
  type BookingBridgeRepository,
  type BookingServiceOption,
  type ConversationBookingState,
  type CustomerAppointmentForBridge,
} from '@/server/ai/booking-bridge';
import type {
  AppointmentBookingService,
  BookingSlot,
  CancelAppointmentInput,
  CreateAppointmentInput,
  RescheduleAppointmentInput,
} from '@/server/appointments/booking';

const occurredAt = new Date('2026-04-27T07:00:00.000Z');

describe('BookingBridgeService', () => {
  it('proposes real booking slots for a matched service', async () => {
    const repository = new FakeBookingBridgeRepository([
      {
        id: 'service_1',
        name: 'Prima visita',
        durationMinutes: 30,
        priceCents: 7000,
      },
    ]);
    const booking = new FakeAppointmentBookingService();
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Vorrei prenotare una prima visita',
    });

    expect(reply).toMatchObject({
      handled: true,
      metadata: {
        bookingBridge: {
          action: 'slots_proposed',
          serviceId: 'service_1',
        },
      },
    });
    expect(reply.replyText).toContain('Ho trovato questi slot');
    expect(reply.replyText).toContain('confermo 1');
    expect(savedSlots(repository)).toHaveLength(3);
    expect(booking.availabilityCalls[0]).toMatchObject({
      tenantId: 'tenant_1',
      serviceId: 'service_1',
      maxSlots: 3,
    });
  });

  it('uses extracted date and time preferences when proposing slots', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    const booking = new FakeAppointmentBookingService();
    booking.slots = [
      slot('2026-04-28T09:00:00.000Z', '2026-04-28T09:30:00.000Z'),
      slot('2026-04-28T14:00:00.000Z', '2026-04-28T14:30:00.000Z'),
      slot('2026-04-28T16:00:00.000Z', '2026-04-28T16:30:00.000Z'),
      slot('2026-04-28T19:00:00.000Z', '2026-04-28T19:30:00.000Z'),
    ];
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Vorrei prenotare prima visita domani pomeriggio',
    });

    expect(booking.availabilityCalls[0]).toMatchObject({
      from: new Date('2026-04-28T13:00:00.000Z'),
      to: new Date('2026-04-28T18:00:00.000Z'),
      maxSlots: 20,
    });
    expect(savedSlots(repository).map((item) => item.start)).toEqual([
      '2026-04-28T14:00:00.000Z',
      '2026-04-28T16:00:00.000Z',
    ]);
    expect(reply.metadata).toMatchObject({
      bookingBridge: {
        request: {
          datePreference: {
            label: 'domani',
          },
          timePreference: {
            dayPart: 'afternoon',
          },
        },
      },
    });
  });

  it('asks which service when the request is ambiguous', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
      serviceOption('service_2', 'Igiene dentale'),
    ]);
    const booking = new FakeAppointmentBookingService();
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Vorrei prenotare',
    });

    expect(reply.replyText).toContain('Quale servizio ti interessa?');
    expect(reply.replyText).toContain('Prima visita');
    expect(reply.replyText).toContain('Igiene dentale');
    expect(booking.availabilityCalls).toHaveLength(0);
  });

  it('confirms a previously proposed slot and clears conversation state', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    repository.savedState = stateWithSlots();
    const booking = new FakeAppointmentBookingService();
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Confermo 2',
    });

    expect(reply).toMatchObject({
      handled: true,
      metadata: {
        bookingBridge: {
          action: 'appointment_created',
          appointmentId: 'appointment_1',
        },
      },
    });
    expect(booking.createCalls[0]).toMatchObject({
      tenantId: 'tenant_1',
      serviceId: 'service_1',
      conversationId: 'conversation_1',
      customerIdentifier: '393331112233',
      customerPhone: '393331112233',
      scheduledAt: new Date('2026-04-28T10:00:00.000Z'),
      requireCalendarSync: false,
      sendConfirmation: true,
    });
    expect(repository.cleared).toBe(true);
    expect(reply.replyText).toContain('Perfetto, ho prenotato');
  });

  it('expires stale proposed slots before booking', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    repository.savedState = {
      ...stateWithSlots(),
      expiresAt: '2026-04-27T06:00:00.000Z',
    };
    const booking = new FakeAppointmentBookingService();
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Confermo 1',
    });

    expect(reply.metadata).toMatchObject({
      bookingBridge: {
        action: 'slot_state_expired',
      },
    });
    expect(booking.createCalls).toHaveLength(0);
    expect(repository.cleared).toBe(true);
  });

  it('asks for a target date before rescheduling a single appointment', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    repository.appointments = [customerAppointment()];
    const booking = new FakeAppointmentBookingService();
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Vorrei spostare il mio appuntamento',
      intent: 'reschedule_request',
    });

    expect(reply).toMatchObject({
      handled: true,
      metadata: {
        bookingBridge: {
          action: 'reschedule_date_requested',
          appointmentId: 'appointment_1',
        },
      },
    });
    expect(reply.replyText).toContain('Per quale giorno');
    expect(repository.savedState).toMatchObject({
      status: 'reschedule_date_requested',
    });
  });

  it('proposes reschedule slots and confirms the selected new slot', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    repository.savedState = {
      status: 'reschedule_date_requested',
      appointment: pendingAppointment(),
      proposedAt: '2026-04-27T07:00:00.000Z',
      expiresAt: '2026-04-27T07:30:00.000Z',
    };
    const booking = new FakeAppointmentBookingService();
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const slotsReply = await service.createBookingReply({
      ...baseInput(),
      text: 'domani mattina',
      intent: 'booking_request',
    });

    expect(slotsReply).toMatchObject({
      metadata: {
        bookingBridge: {
          action: 'reschedule_slots_proposed',
          appointmentId: 'appointment_1',
        },
      },
    });
    expect(booking.availabilityCalls[0]).toMatchObject({
      tenantId: 'tenant_1',
      serviceId: 'service_1',
      excludeAppointmentId: 'appointment_1',
      durationMinutes: 30,
      maxSlots: 20,
    });
    expect(repository.savedState).toMatchObject({
      status: 'reschedule_slots_proposed',
    });

    const confirmReply = await service.createBookingReply({
      ...baseInput(),
      text: 'confermo 2',
      intent: 'other',
    });

    expect(confirmReply).toMatchObject({
      metadata: {
        bookingBridge: {
          action: 'appointment_rescheduled',
          appointmentId: 'appointment_1',
        },
      },
    });
    expect(booking.rescheduleCalls[0]).toMatchObject({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      scheduledAt: new Date('2026-04-28T10:00:00.000Z'),
      requireCalendarSync: false,
      sendConfirmation: true,
    });
    expect(repository.cleared).toBe(true);
  });

  it('cancels a single future appointment for the WhatsApp number', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    repository.appointments = [customerAppointment()];
    const booking = new FakeAppointmentBookingService();
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Vorrei annullare il mio appuntamento',
      intent: 'cancellation_request',
    });

    expect(reply).toMatchObject({
      metadata: {
        bookingBridge: {
          action: 'appointment_cancelled',
          appointmentId: 'appointment_1',
        },
      },
    });
    expect(booking.cancelCalls[0]).toMatchObject({
      tenantId: 'tenant_1',
      appointmentId: 'appointment_1',
      requireCalendarSync: false,
      sendCancellation: true,
    });
  });

  it('uses natural appointment hints to cancel the matching time', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    repository.appointments = [
      customerAppointment({ appointmentId: 'appointment_1' }),
      customerAppointment({
        appointmentId: 'appointment_2',
        scheduledAt: new Date('2026-04-28T15:00:00.000Z'),
      }),
    ];
    const booking = new FakeAppointmentBookingService();
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Annulla quello delle 15',
      intent: 'cancellation_request',
    });

    expect(reply.metadata).toMatchObject({
      bookingBridge: {
        action: 'appointment_cancelled',
        appointmentId: 'appointment_2',
      },
    });
    expect(booking.cancelCalls[0]).toMatchObject({
      appointmentId: 'appointment_2',
    });
  });

  it('uses natural appointment hints to cancel the matching customer name', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    repository.appointments = [
      customerAppointment({
        appointmentId: 'appointment_1',
        customerName: 'Luca',
      }),
      customerAppointment({
        appointmentId: 'appointment_2',
        customerName: 'Mario',
        scheduledAt: new Date('2026-04-29T09:00:00.000Z'),
      }),
    ];
    const booking = new FakeAppointmentBookingService();
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Annulla la visita di Mario',
      intent: 'cancellation_request',
    });

    expect(reply.metadata).toMatchObject({
      bookingBridge: {
        action: 'appointment_cancelled',
        appointmentId: 'appointment_2',
      },
    });
    expect(booking.cancelCalls[0]).toMatchObject({
      appointmentId: 'appointment_2',
    });
  });

  it('uses source-date hints for reschedule lookup before asking the target date', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    repository.appointments = [
      customerAppointment({
        appointmentId: 'appointment_1',
        scheduledAt: new Date('2026-04-28T09:00:00.000Z'),
      }),
      customerAppointment({
        appointmentId: 'appointment_2',
        scheduledAt: new Date('2026-04-29T09:00:00.000Z'),
      }),
    ];
    const booking = new FakeAppointmentBookingService();
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Vorrei spostare quello di domani',
      intent: 'reschedule_request',
    });

    expect(reply.metadata).toMatchObject({
      bookingBridge: {
        action: 'reschedule_date_requested',
        appointmentId: 'appointment_1',
      },
    });
    expect(reply.replyText).toContain('Per quale giorno');
    expect(booking.availabilityCalls).toHaveLength(0);
    expect(repository.savedState).toMatchObject({
      status: 'reschedule_date_requested',
      appointment: {
        appointmentId: 'appointment_1',
      },
    });
  });

  it('keeps source customer and target date separate during reschedule', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    repository.appointments = [
      customerAppointment({
        appointmentId: 'appointment_1',
        customerName: 'Luca',
      }),
      customerAppointment({
        appointmentId: 'appointment_2',
        customerName: 'Mario',
      }),
    ];
    const booking = new FakeAppointmentBookingService();
    booking.slots = [
      slot('2026-05-01T09:00:00.000Z', '2026-05-01T09:30:00.000Z'),
      slot('2026-05-01T10:00:00.000Z', '2026-05-01T10:30:00.000Z'),
    ];
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Sposta la visita di Mario a venerdi mattina',
      intent: 'reschedule_request',
    });

    expect(reply.metadata).toMatchObject({
      bookingBridge: {
        action: 'reschedule_slots_proposed',
        appointmentId: 'appointment_2',
        request: {
          datePreference: {
            label: 'venerdi',
          },
          timePreference: {
            dayPart: 'morning',
          },
        },
      },
    });
    expect(booking.availabilityCalls[0]).toMatchObject({
      tenantId: 'tenant_1',
      serviceId: 'service_1',
      excludeAppointmentId: 'appointment_2',
      from: new Date('2026-05-01T08:00:00.000Z'),
      to: new Date('2026-05-01T13:00:00.000Z'),
    });
    expect(repository.savedState).toMatchObject({
      status: 'reschedule_slots_proposed',
      appointment: {
        appointmentId: 'appointment_2',
      },
    });
  });

  it('keeps source date and target date separate during reschedule', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    repository.appointments = [
      customerAppointment({
        appointmentId: 'appointment_1',
        scheduledAt: new Date('2026-04-28T09:00:00.000Z'),
      }),
      customerAppointment({
        appointmentId: 'appointment_2',
        scheduledAt: new Date('2026-04-29T09:00:00.000Z'),
      }),
    ];
    const booking = new FakeAppointmentBookingService();
    booking.slots = [
      slot('2026-05-01T09:00:00.000Z', '2026-05-01T09:30:00.000Z'),
      slot('2026-05-01T10:00:00.000Z', '2026-05-01T10:30:00.000Z'),
    ];
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const reply = await service.createBookingReply({
      ...baseInput(),
      text: 'Sposta quello di domani a venerdi mattina',
      intent: 'reschedule_request',
    });

    expect(reply.metadata).toMatchObject({
      bookingBridge: {
        action: 'reschedule_slots_proposed',
        appointmentId: 'appointment_1',
        request: {
          datePreference: {
            label: 'venerdi',
          },
          timePreference: {
            dayPart: 'morning',
          },
        },
      },
    });
    expect(booking.availabilityCalls[0]).toMatchObject({
      excludeAppointmentId: 'appointment_1',
      from: new Date('2026-05-01T08:00:00.000Z'),
      to: new Date('2026-05-01T13:00:00.000Z'),
    });
    expect(repository.savedState).toMatchObject({
      status: 'reschedule_slots_proposed',
      appointment: {
        appointmentId: 'appointment_1',
      },
    });
  });

  it('asks which appointment to cancel when multiple future appointments match', async () => {
    const repository = new FakeBookingBridgeRepository([
      serviceOption('service_1', 'Prima visita'),
    ]);
    repository.appointments = [
      customerAppointment({ appointmentId: 'appointment_1' }),
      customerAppointment({
        appointmentId: 'appointment_2',
        scheduledAt: new Date('2026-04-29T09:00:00.000Z'),
      }),
    ];
    const booking = new FakeAppointmentBookingService();
    const service = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );

    const selectionReply = await service.createBookingReply({
      ...baseInput(),
      text: 'Annulla appuntamento',
      intent: 'cancellation_request',
    });

    expect(selectionReply.replyText).toContain('Quale vuoi annullare?');
    expect(repository.savedState).toMatchObject({
      status: 'cancellation_selection',
    });

    const confirmReply = await service.createBookingReply({
      ...baseInput(),
      text: 'annulla 2',
      intent: 'other',
    });

    expect(confirmReply.metadata).toMatchObject({
      bookingBridge: {
        action: 'appointment_cancelled',
        appointmentId: 'appointment_2',
      },
    });
    expect(booking.cancelCalls[0]).toMatchObject({
      appointmentId: 'appointment_2',
    });
  });
});

class FakeBookingBridgeRepository implements BookingBridgeRepository {
  savedState: ConversationBookingState | null = null;
  cleared = false;
  appointments: CustomerAppointmentForBridge[] = [];

  constructor(private readonly services: BookingServiceOption[]) {}

  async getTenantTimezone(): Promise<string> {
    return 'UTC';
  }

  async listActiveServices(): Promise<BookingServiceOption[]> {
    return this.services;
  }

  async getConversationBookingState(): Promise<ConversationBookingState | null> {
    return this.savedState;
  }

  async saveConversationBookingState(input: { state: ConversationBookingState }): Promise<void> {
    this.savedState = input.state;
    this.cleared = false;
  }

  async clearConversationBookingState(): Promise<void> {
    this.savedState = null;
    this.cleared = true;
  }

  async listCustomerAppointments(): Promise<CustomerAppointmentForBridge[]> {
    return this.appointments;
  }
}

class FakeAppointmentBookingService {
  availabilityCalls: Array<{
    tenantId: string;
    serviceId: string;
    from?: Date;
    to?: Date;
    maxSlots?: number;
    durationMinutes?: number;
    excludeAppointmentId?: string;
  }> = [];
  createCalls: CreateAppointmentInput[] = [];
  rescheduleCalls: RescheduleAppointmentInput[] = [];
  cancelCalls: CancelAppointmentInput[] = [];
  slots: BookingSlot[] = [
    slot('2026-04-28T09:00:00.000Z', '2026-04-28T09:30:00.000Z'),
    slot('2026-04-28T10:00:00.000Z', '2026-04-28T10:30:00.000Z'),
    slot('2026-04-28T11:00:00.000Z', '2026-04-28T11:30:00.000Z'),
  ];

  async getAvailableSlots(input: {
    tenantId: string;
    serviceId: string;
    from?: Date;
    to?: Date;
    maxSlots?: number;
    durationMinutes?: number;
    excludeAppointmentId?: string;
  }): Promise<BookingSlot[]> {
    this.availabilityCalls.push(input);

    return this.slots;
  }

  async createAppointment(input: CreateAppointmentInput): Promise<{ appointmentId: string }> {
    this.createCalls.push(input);
    return { appointmentId: 'appointment_1' };
  }

  async rescheduleAppointment(
    input: RescheduleAppointmentInput,
  ): Promise<{ appointmentId: string }> {
    this.rescheduleCalls.push(input);
    return { appointmentId: input.appointmentId };
  }

  async cancelAppointment(input: CancelAppointmentInput): Promise<{ appointmentId: string }> {
    this.cancelCalls.push(input);
    return { appointmentId: input.appointmentId };
  }
}

function baseInput() {
  return {
    tenantId: 'tenant_1',
    conversationId: 'conversation_1',
    customerIdentifier: '393331112233',
    customerName: null,
    text: 'Vorrei prenotare',
    occurredAt,
  };
}

function serviceOption(id: string, name: string): BookingServiceOption {
  return {
    id,
    name,
    durationMinutes: 30,
    priceCents: null,
  };
}

function stateWithSlots(): ConversationBookingState {
  return {
    status: 'slots_proposed',
    serviceId: 'service_1',
    serviceName: 'Prima visita',
    proposedAt: '2026-04-27T07:00:00.000Z',
    expiresAt: '2026-04-27T07:30:00.000Z',
    slots: [
      toPendingSlot(slot('2026-04-28T09:00:00.000Z', '2026-04-28T09:30:00.000Z')),
      toPendingSlot(slot('2026-04-28T10:00:00.000Z', '2026-04-28T10:30:00.000Z')),
      toPendingSlot(slot('2026-04-28T11:00:00.000Z', '2026-04-28T11:30:00.000Z')),
    ],
  };
}

function slot(start: string, end: string): BookingSlot {
  return {
    tenantId: 'tenant_1',
    serviceId: 'service_1',
    serviceName: 'Prima visita',
    start,
    end,
    durationMinutes: 30,
    timezone: 'UTC',
  };
}

function toPendingSlot(slotInput: BookingSlot) {
  return {
    serviceId: slotInput.serviceId,
    serviceName: slotInput.serviceName,
    start: slotInput.start,
    end: slotInput.end,
    durationMinutes: slotInput.durationMinutes,
    timezone: slotInput.timezone,
  };
}

function customerAppointment(
  overrides: Partial<CustomerAppointmentForBridge> = {},
): CustomerAppointmentForBridge {
  return {
    appointmentId: 'appointment_1',
    serviceId: 'service_1',
    serviceName: 'Prima visita',
    customerName: 'Mario Rossi',
    scheduledAt: new Date('2026-04-28T09:00:00.000Z'),
    durationMinutes: 30,
    ...overrides,
  };
}

function pendingAppointment() {
  return {
    appointmentId: 'appointment_1',
    serviceId: 'service_1',
    serviceName: 'Prima visita',
    customerName: 'Mario Rossi',
    scheduledAt: '2026-04-28T09:00:00.000Z',
    durationMinutes: 30,
    timezone: 'UTC',
  };
}

function savedSlots(repository: FakeBookingBridgeRepository) {
  return repository.savedState?.status === 'slots_proposed' ? repository.savedState.slots : [];
}
