import { AppError } from '@/lib/errors/app-error';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  RuleBasedBookingRequestExtractor,
  filterSlotsByBookingRequest,
  type BookingRequestExtractor,
  type StructuredBookingRequest,
} from '@/server/ai/booking-extractor';
import {
  createAppointmentBookingService,
  type AppointmentBookingService,
  type BookingSlot,
  type ChangeAppointmentResult,
  type RescheduleAppointmentInput,
  type CancelAppointmentInput,
} from '@/server/appointments/booking';
import type { IntentCategory } from '@/server/ai/intent-router';

export type BookingBridgeInput = {
  tenantId: string;
  conversationId: string;
  customerIdentifier: string;
  customerName: string | null;
  text: string;
  occurredAt: Date;
  intent?: IntentCategory;
};

export type BookingBridgeReply = {
  handled: boolean;
  replyText: string | null;
  metadata: Record<string, unknown>;
};

export type BookingServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number | null;
};

export type PendingBookingSlot = {
  serviceId: string;
  serviceName: string;
  start: string;
  end: string;
  durationMinutes: number;
  timezone: string;
};

export type PendingAppointmentReference = {
  appointmentId: string;
  serviceId: string | null;
  serviceName: string | null;
  customerName: string | null;
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
};

export type ConversationBookingState =
  | {
      status: 'slots_proposed';
      serviceId: string;
      serviceName: string;
      slots: PendingBookingSlot[];
      proposedAt: string;
      expiresAt: string;
    }
  | {
      status: 'reschedule_appointment_selection';
      appointments: PendingAppointmentReference[];
      request: Record<string, unknown>;
      proposedAt: string;
      expiresAt: string;
    }
  | {
      status: 'reschedule_date_requested';
      appointment: PendingAppointmentReference;
      proposedAt: string;
      expiresAt: string;
    }
  | {
      status: 'reschedule_slots_proposed';
      appointment: PendingAppointmentReference;
      slots: PendingBookingSlot[];
      request: Record<string, unknown>;
      proposedAt: string;
      expiresAt: string;
    }
  | {
      status: 'cancellation_selection';
      appointments: PendingAppointmentReference[];
      proposedAt: string;
      expiresAt: string;
    };

export type CustomerAppointmentForBridge = {
  appointmentId: string;
  serviceId: string | null;
  serviceName: string | null;
  customerName: string | null;
  scheduledAt: Date;
  durationMinutes: number;
};

export type BookingBridgeRepository = {
  getTenantTimezone(tenantId: string): Promise<string>;
  listActiveServices(tenantId: string): Promise<BookingServiceOption[]>;
  getConversationBookingState(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<ConversationBookingState | null>;
  saveConversationBookingState(input: {
    tenantId: string;
    conversationId: string;
    state: ConversationBookingState;
  }): Promise<void>;
  clearConversationBookingState(input: { tenantId: string; conversationId: string }): Promise<void>;
  listCustomerAppointments(input: {
    tenantId: string;
    customerIdentifier: string;
    from: Date;
    to: Date;
    limit: number;
  }): Promise<CustomerAppointmentForBridge[]>;
};

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
};

type AppointmentRow = {
  id: string;
  service_id: string | null;
  service_type: string | null;
  customer_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
};

type ConversationMetadataRow = {
  metadata: unknown;
};

const bookingMetadataKey = 'ambrogioBooking';

export class BookingBridgeService {
  constructor(
    private readonly repository: BookingBridgeRepository,
    private readonly bookingService: AppointmentBookingService,
    private readonly extractor: BookingRequestExtractor = new RuleBasedBookingRequestExtractor(),
  ) {}

  async createBookingReply(input: BookingBridgeInput): Promise<BookingBridgeReply> {
    const timezone = await this.repository.getTenantTimezone(input.tenantId);
    const extracted = await this.extractor.extract({
      text: input.text,
      now: input.occurredAt,
      timezone,
    });
    const state = await this.repository.getConversationBookingState({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
    });

    if (state) {
      return this.handleConversationState(input, timezone, extracted, state);
    }

    if (input.intent === 'reschedule_request') {
      return this.startRescheduleFlow(input, timezone, extracted);
    }

    if (input.intent === 'cancellation_request') {
      return this.startCancellationFlow(input, timezone, extracted);
    }

    if (input.intent && input.intent !== 'booking_request') {
      return {
        handled: false,
        replyText: null,
        metadata: {},
      };
    }

    const services = await this.repository.listActiveServices(input.tenantId);

    if (services.length === 0) {
      return {
        handled: true,
        replyText:
          'Posso aiutarti a prenotare, ma lo studio non ha ancora configurato i servizi. Segno la richiesta al team.',
        metadata: {
          bookingBridge: {
            action: 'no_services_configured',
          },
        },
      };
    }

    const selectedService = selectServiceFromText(input.text, services, extracted.serviceQuery);

    if (!selectedService && services.length > 1) {
      return {
        handled: true,
        replyText: `Certo, ti aiuto a prenotare. Quale servizio ti interessa?\n\n${services
          .slice(0, 6)
          .map((service, index) => `${index + 1}. ${service.name}`)
          .join('\n')}`,
        metadata: {
          bookingBridge: {
            action: 'service_clarification_requested',
            serviceCount: services.length,
          },
        },
      };
    }

    const service = selectedService ?? services[0];

    if (!service) {
      throw new AppError('internal', 'Booking service selection failed', {
        expose: false,
      });
    }

    const availabilityWindow = availabilityWindowForRequest(extracted, input.occurredAt);
    const rawSlots = await this.bookingService.getAvailableSlots({
      tenantId: input.tenantId,
      serviceId: service.id,
      from: availabilityWindow.from,
      to: availabilityWindow.to,
      now: input.occurredAt,
      maxSlots: shouldOverfetchForTimePreference(extracted) ? 20 : 3,
    });
    const slots = filterSlotsByBookingRequest(rawSlots, extracted).slice(0, 3);

    if (slots.length === 0) {
      await this.repository.clearConversationBookingState({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
      });

      return {
        handled: true,
        replyText: `Ho controllato ${service.name}, ma non vedo slot liberi nei prossimi giorni. Segno la richiesta al team cosi puo' proporti un orario manualmente.`,
        metadata: {
          bookingBridge: {
            action: 'no_slots_available',
            serviceId: service.id,
            request: serializeStructuredBookingRequest(extracted),
          },
        },
      };
    }

    const pendingSlots = slots.map(toPendingSlot);
    const nextState: ConversationBookingState = {
      status: 'slots_proposed',
      serviceId: service.id,
      serviceName: service.name,
      slots: pendingSlots,
      proposedAt: input.occurredAt.toISOString(),
      expiresAt: addMinutes(input.occurredAt, 30).toISOString(),
    };

    await this.repository.saveConversationBookingState({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      state: nextState,
    });

    return {
      handled: true,
      replyText: `Ho trovato questi slot per ${service.name}:\n\n${formatSlotList(
        pendingSlots,
      )}\n\nRispondimi con "confermo 1", "confermo 2" o "confermo 3".`,
      metadata: {
        bookingBridge: {
          action: 'slots_proposed',
          serviceId: service.id,
          slots: pendingSlots,
          request: serializeStructuredBookingRequest(extracted),
        },
      },
    };
  }

  private async confirmProposedSlot(
    input: BookingBridgeInput,
    state: Extract<ConversationBookingState, { status: 'slots_proposed' }>,
    selectedSlotIndex: number,
  ): Promise<BookingBridgeReply> {
    if (new Date(state.expiresAt).getTime() < input.occurredAt.getTime()) {
      await this.repository.clearConversationBookingState({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
      });

      return {
        handled: true,
        replyText:
          'Quegli slot sono scaduti. Ricontrollo la disponibilita: scrivimi di nuovo quale servizio vuoi prenotare.',
        metadata: {
          bookingBridge: {
            action: 'slot_state_expired',
          },
        },
      };
    }

    const slot = state.slots[selectedSlotIndex];

    if (!slot) {
      return {
        handled: false,
        replyText: null,
        metadata: {},
      };
    }

    try {
      const appointment = await this.bookingService.createAppointment({
        tenantId: input.tenantId,
        serviceId: slot.serviceId,
        conversationId: input.conversationId,
        customerIdentifier: input.customerIdentifier,
        customerName: input.customerName?.trim() || 'Cliente WhatsApp',
        customerPhone: input.customerIdentifier,
        scheduledAt: new Date(slot.start),
        durationMinutes: slot.durationMinutes,
        bookingSource: 'whatsapp_ai',
        now: input.occurredAt,
        requireCalendarSync: false,
        sendConfirmation: true,
      });

      await this.repository.clearConversationBookingState({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
      });

      return {
        handled: true,
        replyText: `Perfetto, ho prenotato ${slot.serviceName} per ${formatSlotStart(
          slot,
        )}. Riceverai anche la conferma WhatsApp dello studio.`,
        metadata: {
          bookingBridge: {
            action: 'appointment_created',
            appointmentId: appointment.appointmentId,
            serviceId: slot.serviceId,
            slot,
          },
        },
      };
    } catch (error) {
      if (error instanceof AppError && error.code === 'conflict') {
        await this.repository.clearConversationBookingState({
          tenantId: input.tenantId,
          conversationId: input.conversationId,
        });

        return {
          handled: true,
          replyText:
            'Mi spiace, quello slot non risulta piu disponibile. Scrivimi di nuovo il servizio e controllo altri orari.',
          metadata: {
            bookingBridge: {
              action: 'slot_conflict',
              serviceId: slot.serviceId,
            },
          },
        };
      }

      throw error;
    }
  }

  private async handleConversationState(
    input: BookingBridgeInput,
    timezone: string,
    extracted: StructuredBookingRequest,
    state: ConversationBookingState,
  ): Promise<BookingBridgeReply> {
    if (new Date(state.expiresAt).getTime() < input.occurredAt.getTime()) {
      await this.repository.clearConversationBookingState({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
      });

      return {
        handled: true,
        replyText:
          state.status === 'slots_proposed'
            ? 'Quegli slot sono scaduti. Ricontrollo la disponibilita: scrivimi di nuovo quale servizio vuoi prenotare.'
            : 'La scelta precedente e scaduta. Scrivimi di nuovo cosa vuoi fare e ricontrollo tutto.',
        metadata: {
          bookingBridge: {
            action:
              state.status === 'slots_proposed'
                ? 'slot_state_expired'
                : 'conversation_state_expired',
            previousStatus: state.status,
          },
        },
      };
    }

    if (state.status === 'slots_proposed') {
      const selectedSlotIndex = selectProposedSlotIndex(input.text, state);

      return selectedSlotIndex === null
        ? {
            handled: false,
            replyText: null,
            metadata: {},
          }
        : this.confirmProposedSlot(input, state, selectedSlotIndex);
    }

    if (state.status === 'reschedule_appointment_selection') {
      const selectedIndex = selectNumberedOptionIndex(input.text, state.appointments.length);

      if (selectedIndex === null) {
        return {
          handled: true,
          replyText: 'Dimmi il numero dell appuntamento che vuoi spostare, per esempio "sposta 1".',
          metadata: {
            bookingBridge: {
              action: 'reschedule_appointment_selection_repeated',
            },
          },
        };
      }

      const appointment = state.appointments[selectedIndex];

      if (!appointment) {
        return {
          handled: false,
          replyText: null,
          metadata: {},
        };
      }

      return this.prepareRescheduleSlots(input, timezone, extracted, appointment);
    }

    if (state.status === 'reschedule_date_requested') {
      return this.prepareRescheduleSlots(input, timezone, extracted, state.appointment);
    }

    if (state.status === 'reschedule_slots_proposed') {
      const selectedSlotIndex = selectProposedSlotIndex(input.text, {
        status: 'slots_proposed',
        serviceId: state.appointment.serviceId ?? '',
        serviceName: state.appointment.serviceName ?? 'appuntamento',
        slots: state.slots,
        proposedAt: state.proposedAt,
        expiresAt: state.expiresAt,
      });

      if (selectedSlotIndex === null) {
        return {
          handled: true,
          replyText: 'Dimmi quale nuovo slot vuoi confermare, per esempio "confermo 1".',
          metadata: {
            bookingBridge: {
              action: 'reschedule_slot_selection_repeated',
            },
          },
        };
      }

      return this.confirmRescheduleSlot(input, state, selectedSlotIndex);
    }

    const selectedIndex = selectNumberedOptionIndex(input.text, state.appointments.length);

    if (selectedIndex === null) {
      return {
        handled: true,
        replyText: 'Dimmi il numero dell appuntamento che vuoi annullare, per esempio "annulla 1".',
        metadata: {
          bookingBridge: {
            action: 'cancellation_selection_repeated',
          },
        },
      };
    }

    const appointment = state.appointments[selectedIndex];

    if (!appointment) {
      return {
        handled: false,
        replyText: null,
        metadata: {},
      };
    }

    return this.cancelSelectedAppointment(input, appointment);
  }

  private async startRescheduleFlow(
    input: BookingBridgeInput,
    timezone: string,
    extracted: StructuredBookingRequest,
  ): Promise<BookingBridgeReply> {
    const rescheduleRequest = await this.prepareRescheduleRequests({
      input,
      timezone,
      extracted,
    });
    const appointments = await this.findCustomerAppointments({
      input,
      extracted: rescheduleRequest.lookupRequest,
      timezone,
    });

    if (appointments.length === 0) {
      return {
        handled: true,
        replyText:
          'Non trovo appuntamenti futuri collegati a questo numero. Mandami giorno e orario dell appuntamento che vuoi spostare, cosi lo faccio verificare dal team.',
        metadata: {
          bookingBridge: {
            action: 'reschedule_no_appointments_found',
            request: serializeStructuredBookingRequest(rescheduleRequest.lookupRequest),
          },
        },
      };
    }

    if (appointments.length > 1) {
      const state: ConversationBookingState = {
        status: 'reschedule_appointment_selection',
        appointments,
        request: serializeStructuredBookingRequest(extracted),
        proposedAt: input.occurredAt.toISOString(),
        expiresAt: addMinutes(input.occurredAt, 30).toISOString(),
      };
      await this.repository.saveConversationBookingState({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        state,
      });

      return {
        handled: true,
        replyText: `Ho trovato piu appuntamenti. Quale vuoi spostare?\n\n${formatAppointmentList(
          appointments,
        )}`,
        metadata: {
          bookingBridge: {
            action: 'reschedule_appointment_selection_requested',
            appointmentCount: appointments.length,
          },
        },
      };
    }

    const appointment = appointments[0];

    if (!appointment) {
      throw new AppError('internal', 'Appointment selection failed', {
        expose: false,
      });
    }

    if (!rescheduleRequest.hasTargetPreference) {
      const state: ConversationBookingState = {
        status: 'reschedule_date_requested',
        appointment,
        proposedAt: input.occurredAt.toISOString(),
        expiresAt: addMinutes(input.occurredAt, 30).toISOString(),
      };
      await this.repository.saveConversationBookingState({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        state,
      });

      return {
        handled: true,
        replyText: `Ho trovato ${formatAppointmentStart(
          appointment,
        )}. Per quale giorno o fascia oraria vuoi spostarlo?`,
        metadata: {
          bookingBridge: {
            action: 'reschedule_date_requested',
            appointmentId: appointment.appointmentId,
            appointmentLookup: appointmentLookupMetadata(rescheduleRequest.lookupRequest),
          },
        },
      };
    }

    return this.prepareRescheduleSlots(
      input,
      timezone,
      rescheduleRequest.targetRequest,
      appointment,
    );
  }

  private async prepareRescheduleRequests(input: {
    input: BookingBridgeInput;
    timezone: string;
    extracted: StructuredBookingRequest;
  }): Promise<{
    lookupRequest: StructuredBookingRequest;
    targetRequest: StructuredBookingRequest;
    hasTargetPreference: boolean;
  }> {
    const sourceTarget = splitSourceAndTargetDateReference(input.input.text);

    if (sourceTarget) {
      const [sourceRequest, targetRequest] = await Promise.all([
        this.extractor.extract({
          text: sourceTarget.sourceText,
          now: input.input.occurredAt,
          timezone: input.timezone,
        }),
        this.extractor.extract({
          text: sourceTarget.targetText,
          now: input.input.occurredAt,
          timezone: input.timezone,
        }),
      ]);

      return {
        lookupRequest: mergeLookupContext(sourceRequest, input.extracted),
        targetRequest: mergeTargetContext(targetRequest, input.extracted),
        hasTargetPreference: hasRescheduleTargetPreference(targetRequest),
      };
    }

    const lookupRequest = appointmentLookupRequestForReschedule(input.input.text, input.extracted);

    return {
      lookupRequest,
      targetRequest: input.extracted,
      hasTargetPreference: shouldPrepareRescheduleSlots(input.input.text, input.extracted),
    };
  }

  private async prepareRescheduleSlots(
    input: BookingBridgeInput,
    timezone: string,
    extracted: StructuredBookingRequest,
    appointment: PendingAppointmentReference,
  ): Promise<BookingBridgeReply> {
    if (!appointment.serviceId) {
      await this.repository.clearConversationBookingState({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
      });

      return {
        handled: true,
        replyText:
          'Ho trovato l appuntamento, ma non riesco a collegarlo a un servizio configurato. Segno la richiesta al team per spostarlo manualmente.',
        metadata: {
          bookingBridge: {
            action: 'reschedule_missing_service',
            appointmentId: appointment.appointmentId,
          },
        },
      };
    }

    if (!hasRescheduleTargetPreference(extracted)) {
      await this.repository.saveConversationBookingState({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        state: {
          status: 'reschedule_date_requested',
          appointment,
          proposedAt: input.occurredAt.toISOString(),
          expiresAt: addMinutes(input.occurredAt, 30).toISOString(),
        },
      });

      return {
        handled: true,
        replyText:
          'Certo. Dimmi il nuovo giorno o la fascia oraria che preferisci, per esempio "domani pomeriggio".',
        metadata: {
          bookingBridge: {
            action: 'reschedule_date_requested',
            appointmentId: appointment.appointmentId,
          },
        },
      };
    }

    const availabilityWindow = availabilityWindowForRequest(extracted, input.occurredAt);
    const rawSlots = await this.bookingService.getAvailableSlots({
      tenantId: input.tenantId,
      serviceId: appointment.serviceId,
      from: availabilityWindow.from,
      to: availabilityWindow.to,
      now: input.occurredAt,
      maxSlots: shouldOverfetchForTimePreference(extracted) ? 20 : 3,
      durationMinutes: appointment.durationMinutes,
      excludeAppointmentId: appointment.appointmentId,
    });
    const slots = filterSlotsByBookingRequest(rawSlots, extracted).slice(0, 3).map(toPendingSlot);

    if (slots.length === 0) {
      return {
        handled: true,
        replyText:
          'Non vedo slot liberi in quella fascia. Dimmi un altro giorno o orario e ricontrollo.',
        metadata: {
          bookingBridge: {
            action: 'reschedule_no_slots_available',
            appointmentId: appointment.appointmentId,
            request: serializeStructuredBookingRequest(extracted),
          },
        },
      };
    }

    await this.repository.saveConversationBookingState({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      state: {
        status: 'reschedule_slots_proposed',
        appointment,
        slots,
        request: serializeStructuredBookingRequest(extracted),
        proposedAt: input.occurredAt.toISOString(),
        expiresAt: addMinutes(input.occurredAt, 30).toISOString(),
      },
    });

    return {
      handled: true,
      replyText: `Posso spostarlo in uno di questi slot:\n\n${formatSlotList(
        slots,
      )}\n\nRispondimi con "confermo 1", "confermo 2" o "confermo 3".`,
      metadata: {
        bookingBridge: {
          action: 'reschedule_slots_proposed',
          appointmentId: appointment.appointmentId,
          slots,
          request: serializeStructuredBookingRequest(extracted),
        },
      },
    };
  }

  private async confirmRescheduleSlot(
    input: BookingBridgeInput,
    state: Extract<ConversationBookingState, { status: 'reschedule_slots_proposed' }>,
    selectedSlotIndex: number,
  ): Promise<BookingBridgeReply> {
    const slot = state.slots[selectedSlotIndex];

    if (!slot) {
      return {
        handled: false,
        replyText: null,
        metadata: {},
      };
    }

    const rescheduleInput: RescheduleAppointmentInput = {
      tenantId: input.tenantId,
      appointmentId: state.appointment.appointmentId,
      scheduledAt: new Date(slot.start),
      durationMinutes: slot.durationMinutes,
      requireCalendarSync: false,
      sendConfirmation: true,
      now: input.occurredAt,
    };

    try {
      const result = await this.bookingService.rescheduleAppointment(rescheduleInput);

      await this.repository.clearConversationBookingState({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
      });

      return {
        handled: true,
        replyText: `Perfetto, ho spostato l appuntamento a ${formatSlotStart(
          slot,
        )}. Riceverai anche la nuova conferma WhatsApp dello studio.`,
        metadata: {
          bookingBridge: {
            action: 'appointment_rescheduled',
            appointmentId: result.appointmentId,
            slot,
          },
        },
      };
    } catch (error) {
      if (error instanceof AppError && error.code === 'conflict') {
        await this.repository.clearConversationBookingState({
          tenantId: input.tenantId,
          conversationId: input.conversationId,
        });

        return {
          handled: true,
          replyText:
            'Mi spiace, quello slot non risulta piu disponibile. Dimmi un altro giorno o orario e ricontrollo.',
          metadata: {
            bookingBridge: {
              action: 'reschedule_slot_conflict',
              appointmentId: state.appointment.appointmentId,
            },
          },
        };
      }

      throw error;
    }
  }

  private async startCancellationFlow(
    input: BookingBridgeInput,
    timezone: string,
    extracted: StructuredBookingRequest,
  ): Promise<BookingBridgeReply> {
    const appointments = await this.findCustomerAppointments({
      input,
      extracted,
      timezone,
    });

    if (appointments.length === 0) {
      return {
        handled: true,
        replyText:
          'Non trovo appuntamenti futuri collegati a questo numero. Mandami giorno e orario dell appuntamento da annullare, cosi lo faccio verificare dal team.',
        metadata: {
          bookingBridge: {
            action: 'cancellation_no_appointments_found',
            request: serializeStructuredBookingRequest(extracted),
          },
        },
      };
    }

    if (appointments.length > 1) {
      await this.repository.saveConversationBookingState({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        state: {
          status: 'cancellation_selection',
          appointments,
          proposedAt: input.occurredAt.toISOString(),
          expiresAt: addMinutes(input.occurredAt, 30).toISOString(),
        },
      });

      return {
        handled: true,
        replyText: `Ho trovato piu appuntamenti. Quale vuoi annullare?\n\n${formatAppointmentList(
          appointments,
        )}`,
        metadata: {
          bookingBridge: {
            action: 'cancellation_selection_requested',
            appointmentCount: appointments.length,
          },
        },
      };
    }

    const appointment = appointments[0];

    if (!appointment) {
      throw new AppError('internal', 'Appointment selection failed', {
        expose: false,
      });
    }

    return this.cancelSelectedAppointment(input, appointment);
  }

  private async cancelSelectedAppointment(
    input: BookingBridgeInput,
    appointment: PendingAppointmentReference,
  ): Promise<BookingBridgeReply> {
    const cancelInput: CancelAppointmentInput = {
      tenantId: input.tenantId,
      appointmentId: appointment.appointmentId,
      requireCalendarSync: false,
      sendCancellation: true,
      now: input.occurredAt,
    };
    const result = (await this.bookingService.cancelAppointment(
      cancelInput,
    )) as ChangeAppointmentResult;

    await this.repository.clearConversationBookingState({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
    });

    return {
      handled: true,
      replyText: `Va bene, ho annullato l appuntamento ${formatAppointmentStart(
        appointment,
      )}. Riceverai anche la conferma WhatsApp dello studio.`,
      metadata: {
        bookingBridge: {
          action: 'appointment_cancelled',
          appointmentId: result.appointmentId,
        },
      },
    };
  }

  private async findCustomerAppointments(input: {
    input: BookingBridgeInput;
    extracted: StructuredBookingRequest;
    timezone: string;
  }): Promise<PendingAppointmentReference[]> {
    const searchWindow = appointmentSearchWindowForRequest(input.extracted, input.input.occurredAt);
    const appointments = await this.repository.listCustomerAppointments({
      tenantId: input.input.tenantId,
      customerIdentifier: input.input.customerIdentifier,
      from: searchWindow.from,
      to: searchWindow.to,
      limit: 5,
    });

    const pendingAppointments = appointments.map((appointment) =>
      toPendingAppointment(appointment, input.timezone),
    );

    return filterAppointmentsByRequest(pendingAppointments, input.extracted, input.timezone);
  }
}

export class SupabaseBookingBridgeRepository implements BookingBridgeRepository {
  private readonly supabase = createSupabaseAdminClient();

  async getTenantTimezone(tenantId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('timezone')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read tenant timezone', error);
    }

    return (data?.timezone as string | undefined) || 'Europe/Rome';
  }

  async listActiveServices(tenantId: string): Promise<BookingServiceOption[]> {
    const { data, error } = await this.supabase
      .from('services')
      .select('id, name, duration_minutes, price_cents')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) {
      throw toRepositoryError('Failed to read booking services', error);
    }

    return ((data ?? []) as ServiceRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      durationMinutes: row.duration_minutes,
      priceCents: row.price_cents,
    }));
  }

  async listCustomerAppointments(input: {
    tenantId: string;
    customerIdentifier: string;
    from: Date;
    to: Date;
    limit: number;
  }): Promise<CustomerAppointmentForBridge[]> {
    const { data, error } = await this.supabase
      .from('appointments')
      .select('id, service_id, service_type, customer_name, scheduled_at, duration_minutes')
      .eq('tenant_id', input.tenantId)
      .eq('customer_identifier', input.customerIdentifier)
      .eq('status', 'confirmed')
      .gte('scheduled_at', input.from.toISOString())
      .lte('scheduled_at', input.to.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(Math.max(1, Math.min(input.limit, 10)));

    if (error) {
      throw toRepositoryError('Failed to read customer appointments', error);
    }

    return ((data ?? []) as AppointmentRow[]).map((row) => ({
      appointmentId: row.id,
      serviceId: row.service_id,
      serviceName: row.service_type,
      customerName: row.customer_name,
      scheduledAt: new Date(row.scheduled_at),
      durationMinutes: row.duration_minutes,
    }));
  }

  async getConversationBookingState(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<ConversationBookingState | null> {
    const metadata = await this.readConversationMetadata(input);
    const state = metadata[bookingMetadataKey];

    return isConversationBookingState(state) ? state : null;
  }

  async saveConversationBookingState(input: {
    tenantId: string;
    conversationId: string;
    state: ConversationBookingState;
  }): Promise<void> {
    const metadata = await this.readConversationMetadata(input);

    await this.writeConversationMetadata({
      ...input,
      metadata: {
        ...metadata,
        [bookingMetadataKey]: input.state,
      },
    });
  }

  async clearConversationBookingState(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<void> {
    const metadata = await this.readConversationMetadata(input);
    const nextMetadata = { ...metadata };
    delete nextMetadata[bookingMetadataKey];

    await this.writeConversationMetadata({
      ...input,
      metadata: nextMetadata,
    });
  }

  private async readConversationMetadata(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<Record<string, unknown>> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('metadata')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.conversationId)
      .maybeSingle();

    if (error) {
      throw toRepositoryError('Failed to read conversation booking state', error);
    }

    return toPlainRecord((data as ConversationMetadataRow | null)?.metadata);
  }

  private async writeConversationMetadata(input: {
    tenantId: string;
    conversationId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .update({
        metadata: input.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.conversationId);

    if (error) {
      throw toRepositoryError('Failed to write conversation booking state', error);
    }
  }
}

export function createBookingBridgeService(): BookingBridgeService {
  return new BookingBridgeService(
    new SupabaseBookingBridgeRepository(),
    createAppointmentBookingService(),
  );
}

function selectServiceFromText(
  text: string,
  services: BookingServiceOption[],
  serviceQuery: string | null = null,
): BookingServiceOption | null {
  const normalized = normalizeForMatching(`${serviceQuery ?? ''} ${text}`);

  for (const service of services) {
    const serviceName = normalizeForMatching(service.name);

    if (serviceName && normalized.includes(serviceName)) {
      return service;
    }

    const significantWords = serviceName.split(' ').filter((word) => word.length >= 4);

    if (significantWords.some((word) => normalized.includes(word))) {
      return service;
    }
  }

  return null;
}

function availabilityWindowForRequest(
  request: StructuredBookingRequest,
  occurredAt: Date,
): { from: Date; to: Date } {
  if (request.datePreference) {
    return {
      from: request.datePreference.from,
      to: request.datePreference.to,
    };
  }

  return {
    from: occurredAt,
    to: addDays(occurredAt, request.urgency === 'urgent' ? 3 : 7),
  };
}

function appointmentSearchWindowForRequest(
  request: StructuredBookingRequest,
  occurredAt: Date,
): { from: Date; to: Date } {
  if (request.datePreference) {
    return {
      from: request.datePreference.from,
      to: request.datePreference.to,
    };
  }

  return {
    from: addMinutes(occurredAt, -15),
    to: addDays(occurredAt, 30),
  };
}

function hasRescheduleTargetPreference(request: StructuredBookingRequest): boolean {
  return request.datePreference !== null || request.timePreference.dayPart !== 'any';
}

function shouldOverfetchForTimePreference(request: StructuredBookingRequest): boolean {
  return request.timePreference.dayPart !== 'any';
}

function serializeStructuredBookingRequest(
  request: StructuredBookingRequest,
): Record<string, unknown> {
  return {
    serviceQuery: request.serviceQuery,
    urgency: request.urgency,
    confidence: request.confidence,
    signals: request.signals,
    timePreference: request.timePreference,
    datePreference: request.datePreference
      ? {
          from: request.datePreference.from.toISOString(),
          to: request.datePreference.to.toISOString(),
          label: request.datePreference.label,
        }
      : null,
  };
}

function appointmentLookupMetadata(request: StructuredBookingRequest): Record<string, unknown> {
  return {
    serviceQuery: request.serviceQuery,
    customerName: request.customerName,
    timePreference: request.timePreference,
    datePreference: request.datePreference
      ? {
          from: request.datePreference.from.toISOString(),
          to: request.datePreference.to.toISOString(),
          label: request.datePreference.label,
        }
      : null,
  };
}

function filterAppointmentsByRequest(
  appointments: PendingAppointmentReference[],
  request: StructuredBookingRequest,
  timezone: string,
): PendingAppointmentReference[] {
  if (!requestHasAppointmentFilters(request)) {
    return appointments;
  }

  return appointments
    .map((appointment) => ({
      appointment,
      score: appointmentLookupScore(appointment, request, timezone),
    }))
    .filter((item) => item.score !== null)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return (right.score ?? 0) - (left.score ?? 0);
      }

      return (
        new Date(left.appointment.scheduledAt).getTime() -
        new Date(right.appointment.scheduledAt).getTime()
      );
    })
    .map((item) => item.appointment);
}

function requestHasAppointmentFilters(request: StructuredBookingRequest): boolean {
  return (
    request.datePreference !== null ||
    request.timePreference.dayPart !== 'any' ||
    request.customerName !== null ||
    request.serviceQuery !== null
  );
}

function appointmentLookupScore(
  appointment: PendingAppointmentReference,
  request: StructuredBookingRequest,
  timezone: string,
): number | null {
  let score = 0;

  if (request.datePreference) {
    if (!appointmentMatchesDatePreference(appointment, request)) {
      return null;
    }

    score += 4;
  }

  if (request.timePreference.dayPart !== 'any') {
    if (!appointmentMatchesTimePreference(appointment, request, timezone)) {
      return null;
    }

    score += 3;
  }

  if (request.customerName) {
    if (!appointmentMatchesCustomerName(appointment, request.customerName)) {
      return null;
    }

    score += 4;
  }

  if (request.serviceQuery) {
    if (!appointmentMatchesService(appointment, request.serviceQuery)) {
      return null;
    }

    score += 2;
  }

  return score;
}

function appointmentMatchesDatePreference(
  appointment: PendingAppointmentReference,
  request: StructuredBookingRequest,
): boolean {
  const scheduledAt = new Date(appointment.scheduledAt);

  return (
    scheduledAt.getTime() >= request.datePreference!.from.getTime() &&
    scheduledAt.getTime() < request.datePreference!.to.getTime()
  );
}

function appointmentMatchesTimePreference(
  appointment: PendingAppointmentReference,
  request: StructuredBookingRequest,
  timezone: string,
): boolean {
  const parts = zonedHourParts(
    new Date(appointment.scheduledAt),
    appointment.timezone || timezone || 'Europe/Rome',
  );
  const localHour = parts.hour + parts.minute / 60;
  const startHour = request.timePreference.startHour ?? 0;
  const endHour = request.timePreference.endHour ?? 24;

  return localHour >= startHour && localHour < endHour;
}

function appointmentMatchesCustomerName(
  appointment: PendingAppointmentReference,
  customerName: string,
): boolean {
  if (!appointment.customerName) {
    return false;
  }

  const appointmentName = normalizeForMatching(appointment.customerName);
  const requestedName = normalizeForMatching(customerName);

  return (
    appointmentName === requestedName ||
    appointmentName.includes(requestedName) ||
    requestedName.includes(appointmentName)
  );
}

function appointmentMatchesService(
  appointment: PendingAppointmentReference,
  serviceQuery: string,
): boolean {
  if (!appointment.serviceName) {
    return false;
  }

  const serviceName = normalizeForMatching(appointment.serviceName);
  const query = normalizeForMatching(serviceQuery);

  return serviceName.includes(query) || query.includes(serviceName);
}

function appointmentLookupRequestForReschedule(
  text: string,
  request: StructuredBookingRequest,
): StructuredBookingRequest {
  if (!isLikelyAppointmentLookupOnly(text) || !hasExplicitRescheduleTarget(text)) {
    return request;
  }

  if (!request.customerName) {
    return request;
  }

  return {
    ...request,
    datePreference: null,
    timePreference: {
      dayPart: 'any',
      startHour: null,
      endHour: null,
    },
    signals: [
      ...request.signals,
      'appointment_lookup_customer_name',
      'reschedule_target_preserved',
    ],
  };
}

function mergeLookupContext(
  lookupRequest: StructuredBookingRequest,
  originalRequest: StructuredBookingRequest,
): StructuredBookingRequest {
  return {
    ...lookupRequest,
    serviceQuery: originalRequest.serviceQuery ?? lookupRequest.serviceQuery,
    customerName: originalRequest.customerName ?? lookupRequest.customerName,
    customerPhone: originalRequest.customerPhone ?? lookupRequest.customerPhone,
    signals: [
      ...lookupRequest.signals,
      ...originalRequest.signals.filter((signal) =>
        ['service_keyword', 'service_phrase', 'customer_name', 'customer_phone'].includes(signal),
      ),
      'reschedule_source_lookup',
    ],
  };
}

function mergeTargetContext(
  targetRequest: StructuredBookingRequest,
  originalRequest: StructuredBookingRequest,
): StructuredBookingRequest {
  return {
    ...targetRequest,
    serviceQuery: originalRequest.serviceQuery ?? targetRequest.serviceQuery,
    customerName: originalRequest.customerName ?? targetRequest.customerName,
    customerPhone: originalRequest.customerPhone ?? targetRequest.customerPhone,
    signals: [...targetRequest.signals, 'reschedule_target_lookup'],
  };
}

function shouldPrepareRescheduleSlots(text: string, request: StructuredBookingRequest): boolean {
  if (!hasRescheduleTargetPreference(request)) {
    return false;
  }

  return !isLikelyAppointmentLookupOnly(text) || hasExplicitRescheduleTarget(text);
}

function isLikelyAppointmentLookupOnly(text: string): boolean {
  const normalized = normalizeForMatching(text);

  return /\b(quello|quella|appuntamento|prenotazione|visita|seduta|lezione)\s+(?:di|del|della|delle|alle|ore)\b/.test(
    normalized,
  );
}

function hasExplicitRescheduleTarget(text: string): boolean {
  const normalized = normalizeForMatching(text);

  return /\b(?:a|ad|al|alla|alle|per)\s+(?:oggi|domani|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|mattina|mattino|pomeriggio|sera|ore|le|\d{1,2})\b/.test(
    normalized,
  );
}

function splitSourceAndTargetDateReference(
  text: string,
): { sourceText: string; targetText: string } | null {
  const normalized = normalizeForMatching(text);
  const match = normalized.match(
    /\b(?:quello|quella|appuntamento|prenotazione|visita|seduta|lezione)\s+(?:di|del|della)\s+(oggi|domani|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\s+(?:a|ad|al|alla|alle|per)\s+(.+)$/,
  );
  const sourceText = match?.[1]?.trim();
  const targetText = match?.[2]?.trim();

  if (!sourceText || !targetText) {
    return null;
  }

  return { sourceText, targetText };
}

function selectProposedSlotIndex(
  text: string,
  state: Extract<ConversationBookingState, { status: 'slots_proposed' }>,
): number | null {
  const normalized = normalizeForMatching(text);
  const hasConfirmationSignal =
    /\b(confermo|ok|va bene|perfetto|prendo|prenota|blocca|si|sì)\b/.test(normalized);

  if (!hasConfirmationSignal) {
    return null;
  }

  if (/\b(1|primo|prima)\b/.test(normalized)) {
    return 0;
  }

  if (/\b(2|secondo|seconda)\b/.test(normalized)) {
    return 1;
  }

  if (/\b(3|terzo|terza)\b/.test(normalized)) {
    return 2;
  }

  return state.slots.length === 1 ? 0 : null;
}

function selectNumberedOptionIndex(text: string, count: number): number | null {
  const normalized = normalizeForMatching(text);

  if (count <= 0) {
    return null;
  }

  if (/\b(1|primo|prima)\b/.test(normalized)) {
    return 0;
  }

  if (count >= 2 && /\b(2|secondo|seconda)\b/.test(normalized)) {
    return 1;
  }

  if (count >= 3 && /\b(3|terzo|terza)\b/.test(normalized)) {
    return 2;
  }

  if (count >= 4 && /\b(4|quarto|quarta)\b/.test(normalized)) {
    return 3;
  }

  if (count >= 5 && /\b(5|quinto|quinta)\b/.test(normalized)) {
    return 4;
  }

  return count === 1 && /\b(si|sì|ok|va bene|confermo)\b/.test(normalized) ? 0 : null;
}

function toPendingSlot(slot: BookingSlot): PendingBookingSlot {
  return {
    serviceId: slot.serviceId,
    serviceName: slot.serviceName,
    start: slot.start,
    end: slot.end,
    durationMinutes: slot.durationMinutes,
    timezone: slot.timezone,
  };
}

function toPendingAppointment(
  appointment: CustomerAppointmentForBridge,
  timezone: string,
): PendingAppointmentReference {
  return {
    appointmentId: appointment.appointmentId,
    serviceId: appointment.serviceId,
    serviceName: appointment.serviceName,
    customerName: appointment.customerName,
    scheduledAt: appointment.scheduledAt.toISOString(),
    durationMinutes: appointment.durationMinutes,
    timezone,
  };
}

function formatSlotList(slots: PendingBookingSlot[]): string {
  return slots.map((slot, index) => `${index + 1}. ${formatSlotStart(slot)}`).join('\n');
}

function formatAppointmentList(appointments: PendingAppointmentReference[]): string {
  return appointments
    .map((appointment, index) => `${index + 1}. ${formatAppointmentStart(appointment)}`)
    .join('\n');
}

function formatAppointmentStart(appointment: PendingAppointmentReference): string {
  const serviceName = appointment.serviceName ?? 'appuntamento';
  const customerLabel = appointment.customerName ? ` per ${appointment.customerName}` : '';

  return `${serviceName}${customerLabel} ${new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: appointment.timezone || 'Europe/Rome',
  }).format(new Date(appointment.scheduledAt))}`;
}

function formatSlotStart(slot: PendingBookingSlot): string {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: slot.timezone || 'Europe/Rome',
  }).format(new Date(slot.start));
}

function isConversationBookingState(value: unknown): value is ConversationBookingState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ConversationBookingState>;

  if (typeof candidate.proposedAt !== 'string' || typeof candidate.expiresAt !== 'string') {
    return false;
  }

  switch (candidate.status) {
    case 'slots_proposed':
      return (
        typeof candidate.serviceId === 'string' &&
        typeof candidate.serviceName === 'string' &&
        Array.isArray(candidate.slots)
      );
    case 'reschedule_appointment_selection':
      return Array.isArray(candidate.appointments) && typeof candidate.request === 'object';
    case 'reschedule_date_requested':
      return isPendingAppointmentReference(candidate.appointment);
    case 'reschedule_slots_proposed':
      return (
        isPendingAppointmentReference(candidate.appointment) &&
        Array.isArray(candidate.slots) &&
        typeof candidate.request === 'object'
      );
    case 'cancellation_selection':
      return Array.isArray(candidate.appointments);
    default:
      return false;
  }
}

function isPendingAppointmentReference(value: unknown): value is PendingAppointmentReference {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<PendingAppointmentReference>;

  return (
    typeof candidate.appointmentId === 'string' &&
    (typeof candidate.serviceId === 'string' || candidate.serviceId === null) &&
    (typeof candidate.serviceName === 'string' || candidate.serviceName === null) &&
    (candidate.customerName === undefined ||
      typeof candidate.customerName === 'string' ||
      candidate.customerName === null) &&
    typeof candidate.scheduledAt === 'string' &&
    typeof candidate.durationMinutes === 'number' &&
    typeof candidate.timezone === 'string'
  );
}

function zonedHourParts(date: Date, timezone: string): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const map = new Map(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(map.get('hour'));
  const minute = Number(map.get('minute'));

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { hour: date.getUTCHours(), minute: date.getUTCMinutes() };
  }

  return { hour, minute };
}

function normalizeForMatching(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
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
