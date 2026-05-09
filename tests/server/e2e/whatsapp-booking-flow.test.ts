/* eslint-disable no-restricted-syntax -- E2E test fixtures: i fake
AppointmentBookingService vengono castati per soddisfare la firma del tipo,
senza necessità di validazione runtime in test. */

import { describe, expect, it } from 'vitest';

import { RuleBasedIntentClassifier } from '@/server/ai/intent-router';
import { ReplyOrchestrator } from '@/server/ai/reply-orchestrator';
import {
  BookingBridgeService,
  type BookingBridgeRepository,
  type BookingServiceOption,
  type ConversationBookingState,
  type CustomerAppointmentForBridge,
} from '@/server/ai/booking-bridge';
import {
  WhatsAppAutoReplyService,
  type WhatsAppAutoReplyRepository,
} from '@/server/whatsapp/auto-reply';
import type { VoiceTranscript } from '@/lib/elevenlabs/audio';
import type {
  StoreVoiceMediaInput,
  StoredVoiceMedia,
  TenantMediaStorage,
} from '@/server/storage/media-storage';
import type {
  DownloadedWhatsAppMedia,
  DownloadWhatsAppMediaInput,
  WhatsAppMediaDownloader,
} from '@/server/whatsapp/media';
import {
  WhatsAppVoicePipelineWorker,
  type VoiceTranscriber,
} from '@/server/whatsapp/voice-pipeline';
import type {
  ClaimedWhatsAppVoiceJob,
  CreateVoiceEventInput,
  UpdateMessageTranscriptInput,
  WhatsAppVoiceReplyContext,
  WhatsAppVoiceRepository,
} from '@/server/whatsapp/voice-repository';
import {
  WhatsAppWebhookService,
  type ProcessWhatsAppWebhookContext,
} from '@/server/whatsapp/service';
import type {
  AppointmentBookingService,
  BookingSlot,
  CancelAppointmentInput,
  CreateAppointmentInput,
  RescheduleAppointmentInput,
} from '@/server/appointments/booking';
import type {
  EnqueueOutboundMessageInput,
  EnqueueOutboundMessageResult,
  EnqueueVoiceProcessingJobInput,
  EnqueueVoiceProcessingJobResult,
  InsertInboundMessageInput,
  InsertInboundMessageResult,
  InsertOutboundMessageInput,
  InsertOutboundMessageResult,
  RecordWebhookEventInput,
  RecordWebhookEventResult,
  TenantMessagingConfig,
  TenantResolution,
  UpdateInboundMessageAnalysisInput,
  UpsertConversationInput,
  UpsertConversationResult,
  WhatsAppMessageStatus,
  WhatsAppWebhookRepository,
} from '@/server/whatsapp/repository';
import { WhatsAppWebhookPayloadSchema } from '@/types/whatsapp';

const tenantId = 'tenant_1';
const conversationId = 'conversation_1';
const customerIdentifier = '393331112233';
const phoneNumberId = 'phone_123';
const context: ProcessWhatsAppWebhookContext = {
  requestId: 'req_e2e',
  ipAddress: '127.0.0.1',
};

describe('WhatsApp backend booking E2E flow', () => {
  it('books, reschedules and cancels an appointment from WhatsApp messages', async () => {
    const repository = new InMemoryWhatsAppBookingRepository();
    const booking = new InMemoryAppointmentBookingService(repository);
    const bridge = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );
    const autoReply = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
      replyOrchestrator: new ReplyOrchestrator(new RuleBasedIntentClassifier()),
      bookingBridge: bridge,
    });
    const webhook = new WhatsAppWebhookService(repository, {
      autoReplyService: autoReply,
    });

    await webhook.processPayload(
      textPayload('wamid.booking.ask', 'Vorrei prenotare una prima visita domani mattina'),
      context,
    );

    expect(lastOutboundText(repository)).toContain('Ho trovato questi slot');
    expect(repository.bookingState()).toMatchObject({
      status: 'slots_proposed',
    });
    expect(repository.appointments).toHaveLength(0);

    await webhook.processPayload(textPayload('wamid.booking.confirm', 'confermo 1'), context);

    expect(repository.appointments).toHaveLength(1);
    expect(repository.appointments[0]).toMatchObject({
      appointmentId: 'appointment_1',
      status: 'confirmed',
      scheduledAt: new Date('2026-04-28T09:00:00.000Z'),
    });
    expect(repository.bookingState()).toBeNull();
    expect(lastOutboundText(repository)).toContain('ho prenotato');

    await webhook.processPayload(
      textPayload('wamid.reschedule.ask', 'Vorrei spostare l appuntamento'),
      context,
    );

    expect(repository.bookingState()).toMatchObject({
      status: 'reschedule_date_requested',
    });
    expect(lastOutboundText(repository)).toContain('Per quale giorno');

    await webhook.processPayload(textPayload('wamid.reschedule.slots', 'domani mattina'), context);

    expect(repository.bookingState()).toMatchObject({
      status: 'reschedule_slots_proposed',
    });
    expect(booking.availabilityCalls.at(-1)).toMatchObject({
      excludeAppointmentId: 'appointment_1',
      durationMinutes: 30,
    });
    expect(lastOutboundText(repository)).toContain('Posso spostarlo');

    await webhook.processPayload(textPayload('wamid.reschedule.confirm', 'confermo 2'), context);

    expect(repository.appointments[0]).toMatchObject({
      appointmentId: 'appointment_1',
      status: 'confirmed',
      scheduledAt: new Date('2026-04-28T10:00:00.000Z'),
    });
    expect(repository.bookingState()).toBeNull();
    expect(lastOutboundText(repository)).toContain('ho spostato');

    await webhook.processPayload(textPayload('wamid.cancel.ask', 'annulla appuntamento'), context);

    expect(repository.appointments[0]).toMatchObject({
      appointmentId: 'appointment_1',
      status: 'cancelled',
    });
    expect(lastOutboundText(repository)).toContain('ho annullato');
    expect(repository.outboxJobs).toHaveLength(6);
    expect(repository.messageAnalyses.map((item) => item.intent)).toEqual([
      'booking_request',
      'other',
      'reschedule_request',
      'booking_request',
      'other',
      'cancellation_request',
    ]);
    expect(repository.usageIncrements.filter((item) => item.messagesDelta === 1)).toHaveLength(12);
  });

  it('books an appointment from a WhatsApp voice transcript', async () => {
    const repository = new InMemoryWhatsAppBookingRepository();
    const booking = new InMemoryAppointmentBookingService(repository);
    const bridge = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );
    const autoReply = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
      replyOrchestrator: new ReplyOrchestrator(new RuleBasedIntentClassifier()),
      bookingBridge: bridge,
    });
    const webhook = new WhatsAppWebhookService(repository, {
      autoReplyService: autoReply,
    });
    const voiceWorker = new WhatsAppVoicePipelineWorker(
      repository,
      new InMemoryWhatsAppMediaDownloader(),
      new InMemoryTenantMediaStorage(),
      new InMemoryVoiceTranscriber('Vorrei prenotare una prima visita domani mattina'),
      {
        autoReplyHandler: autoReply,
        sttModel: 'scribe_v2',
      },
    );

    await webhook.processPayload(audioPayload('wamid.voice.booking'), context);

    expect(repository.claimedVoiceJobs).toHaveLength(1);
    expect(repository.outboxJobs).toHaveLength(0);

    const voiceResult = await voiceWorker.processReadyJobs({
      now: new Date('2026-04-27T07:00:00.000Z'),
      lockId: 'voice_worker_1',
    });

    expect(voiceResult).toEqual({
      claimedJobs: 1,
      completedJobs: 1,
      retriedJobs: 0,
      deadLetterJobs: 0,
    });
    expect(repository.messageTranscripts[0]).toMatchObject({
      transcriptText: 'Vorrei prenotare una prima visita domani mattina',
      transcriptLanguage: 'it',
      mediaUri: 'supabase://ambrogio-media/tenant_1/voice/message_1/media_audio_1.ogg',
    });
    expect(repository.completedVoiceEvents[0]).toMatchObject({
      voiceEventId: 'voice_event_1',
      audioDurationSecs: 4.2,
    });
    expect(lastOutboundText(repository)).toContain('Ho trovato questi slot');
    expect(repository.bookingState()).toMatchObject({
      status: 'slots_proposed',
    });
    expect(repository.messageAnalyses.at(-1)).toMatchObject({
      intent: 'booking_request',
    });

    await webhook.processPayload(textPayload('wamid.voice.confirm', 'confermo 1'), context);

    expect(repository.appointments[0]).toMatchObject({
      appointmentId: 'appointment_1',
      status: 'confirmed',
      scheduledAt: new Date('2026-04-28T09:00:00.000Z'),
    });
    expect(lastOutboundText(repository)).toContain('ho prenotato');
    expect(repository.completedVoiceJobs).toEqual(['voice_job_1']);
  });

  it('analyzes opted-out customers without mutating booking state or queueing replies', async () => {
    const repository = new InMemoryWhatsAppBookingRepository();
    repository.optOuts.add(`${tenantId}:whatsapp:${customerIdentifier}`);
    const booking = new InMemoryAppointmentBookingService(repository);
    const bridge = new BookingBridgeService(
      repository,
      booking as unknown as AppointmentBookingService,
    );
    const autoReply = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
      replyOrchestrator: new ReplyOrchestrator(new RuleBasedIntentClassifier()),
      bookingBridge: bridge,
    });
    const webhook = new WhatsAppWebhookService(repository, {
      autoReplyService: autoReply,
    });

    await webhook.processPayload(
      textPayload('wamid.opted-out.booking', 'Vorrei prenotare una prima visita domani mattina'),
      context,
    );

    expect(repository.messageAnalyses[0]).toMatchObject({
      intent: 'booking_request',
    });
    expect(repository.outboundMessages).toHaveLength(0);
    expect(repository.outboxJobs).toHaveLength(0);
    expect(booking.availabilityCalls).toHaveLength(0);
    expect(repository.bookingState()).toBeNull();
  });
});

type StoredConversation = {
  id: string;
  metadata: Record<string, unknown>;
};

type StoredAppointment = CustomerAppointmentForBridge & {
  status: 'confirmed' | 'cancelled';
};

type StoredInboundMessage = InsertInboundMessageInput & {
  messageId: string;
};

class InMemoryWhatsAppBookingRepository
  implements
    WhatsAppWebhookRepository,
    WhatsAppAutoReplyRepository,
    BookingBridgeRepository,
    WhatsAppVoiceRepository
{
  readonly tenants = new Map<string, TenantResolution>([
    [
      phoneNumberId,
      {
        integrationId: 'integration_1',
        tenantId,
      },
    ],
  ]);
  readonly tenantConfigs = new Map<string, TenantMessagingConfig>([
    [
      tenantId,
      {
        assistantName: 'Ambrogio',
        aiDisclosureEnabled: true,
        autoReplyEnabled: true,
        defaultLocale: 'it-IT',
      },
    ],
  ]);
  readonly optOuts = new Set<string>();
  readonly services: BookingServiceOption[] = [
    {
      id: 'service_1',
      name: 'Prima visita',
      durationMinutes: 30,
      priceCents: 7000,
    },
  ];
  readonly webhookKeys = new Set<string>();
  readonly conversations = new Map<string, StoredConversation>();
  readonly inboundMessages: InsertInboundMessageInput[] = [];
  readonly inboundMessageById = new Map<string, StoredInboundMessage>();
  readonly messageAnalyses: UpdateInboundMessageAnalysisInput[] = [];
  readonly outboundMessages: InsertOutboundMessageInput[] = [];
  readonly outboxJobs: EnqueueOutboundMessageInput[] = [];
  readonly voiceJobs: EnqueueVoiceProcessingJobInput[] = [];
  readonly claimedVoiceJobs: ClaimedWhatsAppVoiceJob[] = [];
  readonly createdVoiceEvents: CreateVoiceEventInput[] = [];
  readonly completedVoiceEvents: Array<{
    voiceEventId: string;
    audioDurationSecs: number | null;
    metadata: Record<string, unknown>;
  }> = [];
  readonly failedVoiceEvents: Array<{
    voiceEventId: string;
    metadata: Record<string, unknown>;
  }> = [];
  readonly messageTranscripts: UpdateMessageTranscriptInput[] = [];
  readonly completedVoiceJobs: string[] = [];
  readonly retriedVoiceJobs: Array<{
    jobId: string;
    nextAttemptAt: Date;
    error: { code: string; message: string };
  }> = [];
  readonly deadLetterVoiceJobs: Array<{
    jobId: string;
    error: { code: string; message: string };
  }> = [];
  readonly usageIncrements: Array<{
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
    aiCostCentsDelta?: number;
  }> = [];
  readonly appointments: StoredAppointment[] = [];

  async recordWebhookEvent(input: RecordWebhookEventInput): Promise<RecordWebhookEventResult> {
    if (this.webhookKeys.has(input.idempotencyKey)) {
      return { eventId: null, duplicate: true };
    }

    this.webhookKeys.add(input.idempotencyKey);

    return { eventId: `event_${this.webhookKeys.size}`, duplicate: false };
  }

  async markWebhookEventProcessed(): Promise<void> {}

  async markWebhookEventFailed(): Promise<void> {}

  async resolveTenantByPhoneNumberId(inputPhoneNumberId: string): Promise<TenantResolution | null> {
    return this.tenants.get(inputPhoneNumberId) ?? null;
  }

  async upsertConversation(input: UpsertConversationInput): Promise<UpsertConversationResult> {
    const key = `${input.tenantId}:${input.customerIdentifier}`;
    const existing = this.conversations.get(key);

    if (existing) {
      existing.metadata = {
        ...existing.metadata,
        ...input.metadata,
      };
      return { conversationId: existing.id };
    }

    this.conversations.set(key, {
      id: conversationId,
      metadata: input.metadata,
    });

    return { conversationId };
  }

  async insertInboundMessage(
    input: InsertInboundMessageInput,
  ): Promise<InsertInboundMessageResult> {
    const duplicate = this.inboundMessages.some(
      (message) => message.tenantId === input.tenantId && message.externalId === input.externalId,
    );

    if (duplicate) {
      return { messageId: null, created: false };
    }

    this.inboundMessages.push(input);
    const messageId = `message_${this.inboundMessages.length}`;
    this.inboundMessageById.set(messageId, {
      ...input,
      messageId,
    });

    return {
      messageId,
      created: true,
    };
  }

  async updateInboundMessageAnalysis(input: UpdateInboundMessageAnalysisInput): Promise<void> {
    this.messageAnalyses.push(input);
  }

  async getTenantMessagingConfig(inputTenantId: string): Promise<TenantMessagingConfig> {
    return (
      this.tenantConfigs.get(inputTenantId) ?? {
        assistantName: 'Ambrogio',
        aiDisclosureEnabled: true,
        autoReplyEnabled: false,
        defaultLocale: 'it-IT',
      }
    );
  }

  async isCustomerOptedOut(input: {
    tenantId: string;
    channel: 'whatsapp';
    customerIdentifier: string;
  }): Promise<boolean> {
    return this.optOuts.has(`${input.tenantId}:${input.channel}:${input.customerIdentifier}`);
  }

  async upsertCustomerOptOut(input: {
    tenantId: string;
    channel: 'whatsapp';
    customerIdentifier: string;
  }): Promise<void> {
    this.optOuts.add(`${input.tenantId}:${input.channel}:${input.customerIdentifier}`);
  }

  async insertOutboundMessage(
    input: InsertOutboundMessageInput,
  ): Promise<InsertOutboundMessageResult> {
    const duplicate = this.outboundMessages.some(
      (message) => message.tenantId === input.tenantId && message.externalId === input.externalId,
    );

    if (duplicate) {
      return { messageId: null, created: false };
    }

    this.outboundMessages.push(input);

    return {
      messageId: `outbound_${this.outboundMessages.length}`,
      created: true,
    };
  }

  async enqueueOutboundMessage(
    input: EnqueueOutboundMessageInput,
  ): Promise<EnqueueOutboundMessageResult> {
    this.outboxJobs.push(input);

    return {
      jobId: `job_${this.outboxJobs.length}`,
      created: true,
    };
  }

  async enqueueVoiceProcessingJob(
    input: EnqueueVoiceProcessingJobInput,
  ): Promise<EnqueueVoiceProcessingJobResult> {
    this.voiceJobs.push(input);
    const jobId = `voice_job_${this.voiceJobs.length}`;
    this.claimedVoiceJobs.push({
      id: jobId,
      tenantId: input.tenantId,
      messageId: input.messageId,
      mediaId: input.mediaId,
      mediaMimeType: input.mediaMimeType,
      mediaSha256: input.mediaSha256,
      payload: input.payload,
      attemptCount: 1,
      maxAttempts: 5,
    });

    return {
      jobId,
      created: true,
    };
  }

  async claimReadyJobs(): Promise<ClaimedWhatsAppVoiceJob[]> {
    return this.claimedVoiceJobs.filter(
      (job) =>
        !this.completedVoiceJobs.includes(job.id) &&
        !this.deadLetterVoiceJobs.some((deadLetter) => deadLetter.jobId === job.id),
    );
  }

  async getVoiceReplyContext(input: {
    tenantId: string;
    messageId: string;
  }): Promise<WhatsAppVoiceReplyContext | null> {
    const message = this.inboundMessageById.get(input.messageId);

    if (!message || message.tenantId !== input.tenantId) {
      return null;
    }

    const transcript = this.messageTranscripts.find((item) => item.messageId === input.messageId);
    const metadata = transcript?.metadata ?? message.metadata;

    return {
      tenantId: input.tenantId,
      conversationId: message.conversationId,
      messageId: input.messageId,
      externalId: message.externalId,
      customerIdentifier,
      createdAt: message.createdAt,
      transcriptText: transcript?.transcriptText ?? null,
      transcriptLanguage: transcript?.transcriptLanguage ?? null,
      transcriptLanguageProbability: 0.98,
      provider: 'whatsapp_360dialog',
      whatsappMessageId: metadataString(metadata, 'whatsappMessageId'),
      phoneNumberId: metadataString(metadata, 'phoneNumberId'),
      displayPhoneNumber: metadataString(metadata, 'displayPhoneNumber'),
      metadata,
    };
  }

  async createVoiceEvent(input: CreateVoiceEventInput): Promise<string> {
    this.createdVoiceEvents.push(input);

    return `voice_event_${this.createdVoiceEvents.length}`;
  }

  async markVoiceEventCompleted(input: {
    voiceEventId: string;
    audioDurationSecs: number | null;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    this.completedVoiceEvents.push(input);
  }

  async markVoiceEventFailed(input: {
    voiceEventId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    this.failedVoiceEvents.push(input);
  }

  async updateMessageTranscript(input: UpdateMessageTranscriptInput): Promise<void> {
    this.messageTranscripts.push(input);
  }

  async markJobCompleted(jobId: string): Promise<void> {
    this.completedVoiceJobs.push(jobId);
  }

  async scheduleJobRetry(input: {
    jobId: string;
    nextAttemptAt: Date;
    error: { code: string; message: string };
  }): Promise<void> {
    this.retriedVoiceJobs.push(input);
  }

  async markJobDeadLetter(input: {
    jobId: string;
    error: { code: string; message: string };
  }): Promise<void> {
    this.deadLetterVoiceJobs.push(input);
  }

  async updateOutboundMessageStatus(_input: {
    tenantId: string;
    providerMessageId: string;
    status: WhatsAppMessageStatus;
  }): Promise<void> {}

  async incrementUsage(input: {
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
    aiCostCentsDelta?: number;
  }): Promise<void> {
    this.usageIncrements.push(input);
  }

  async getTenantTimezone(): Promise<string> {
    return 'UTC';
  }

  async listActiveServices(): Promise<BookingServiceOption[]> {
    return this.services;
  }

  async getConversationBookingState(): Promise<ConversationBookingState | null> {
    const state = this.bookingState();

    return state;
  }

  async saveConversationBookingState(input: { state: ConversationBookingState }): Promise<void> {
    const conversation = this.requireConversation();
    conversation.metadata = {
      ...conversation.metadata,
      ambrogioBooking: input.state,
    };
  }

  async clearConversationBookingState(): Promise<void> {
    const conversation = this.requireConversation();
    const metadata = { ...conversation.metadata };
    delete metadata.ambrogioBooking;
    conversation.metadata = metadata;
  }

  async listCustomerAppointments(input: {
    from: Date;
    to: Date;
  }): Promise<CustomerAppointmentForBridge[]> {
    return this.appointments
      .filter(
        (appointment) =>
          appointment.status === 'confirmed' &&
          appointment.scheduledAt >= input.from &&
          appointment.scheduledAt <= input.to,
      )
      .map((appointment) => ({
        appointmentId: appointment.appointmentId,
        serviceId: appointment.serviceId,
        serviceName: appointment.serviceName,
        customerName: appointment.customerName,
        scheduledAt: appointment.scheduledAt,
        durationMinutes: appointment.durationMinutes,
      }));
  }

  bookingState(): ConversationBookingState | null {
    const value = this.requireConversation().metadata.ambrogioBooking;

    return typeof value === 'object' && value !== null ? (value as ConversationBookingState) : null;
  }

  private requireConversation(): StoredConversation {
    const conversation = this.conversations.get(`${tenantId}:${customerIdentifier}`);

    if (!conversation) {
      throw new Error('Expected conversation to exist');
    }

    return conversation;
  }
}

class InMemoryAppointmentBookingService {
  readonly availabilityCalls: Array<{
    tenantId: string;
    serviceId: string;
    from: Date;
    to: Date;
    excludeAppointmentId?: string;
    durationMinutes?: number;
  }> = [];

  constructor(private readonly repository: InMemoryWhatsAppBookingRepository) {}

  async getAvailableSlots(input: {
    tenantId: string;
    serviceId: string;
    from: Date;
    to: Date;
    excludeAppointmentId?: string;
    durationMinutes?: number;
  }): Promise<BookingSlot[]> {
    this.availabilityCalls.push(input);

    return [
      slot('2026-04-27T09:00:00.000Z', '2026-04-27T09:30:00.000Z'),
      slot('2026-04-27T10:00:00.000Z', '2026-04-27T10:30:00.000Z'),
      slot('2026-04-27T11:00:00.000Z', '2026-04-27T11:30:00.000Z'),
      slot('2026-04-28T09:00:00.000Z', '2026-04-28T09:30:00.000Z'),
      slot('2026-04-28T10:00:00.000Z', '2026-04-28T10:30:00.000Z'),
      slot('2026-04-28T11:00:00.000Z', '2026-04-28T11:30:00.000Z'),
    ].filter(
      (item) =>
        item.serviceId === input.serviceId &&
        new Date(item.start) >= input.from &&
        new Date(item.end) <= input.to,
    );
  }

  async createAppointment(input: CreateAppointmentInput) {
    const appointmentId = `appointment_${this.repository.appointments.length + 1}`;
    this.repository.appointments.push({
      appointmentId,
      serviceId: input.serviceId,
      serviceName: 'Prima visita',
      customerName: input.customerName,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes ?? 30,
      status: 'confirmed',
    });

    return {
      appointmentId,
      scheduledAt: input.scheduledAt.toISOString(),
      endsAt: new Date(input.scheduledAt.getTime() + 30 * 60_000).toISOString(),
      durationMinutes: input.durationMinutes ?? 30,
      calendarSyncStatus: 'synced',
      calendarEventId: 'event_1',
      calendarEventHtmlLink: null,
      confirmationQueued: true,
      confirmationErrorCode: null,
    };
  }

  async rescheduleAppointment(input: RescheduleAppointmentInput) {
    const appointment = this.repository.appointments.find(
      (item) => item.appointmentId === input.appointmentId,
    );

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    appointment.scheduledAt = input.scheduledAt;
    appointment.durationMinutes = input.durationMinutes ?? appointment.durationMinutes;

    return {
      appointmentId: appointment.appointmentId,
      scheduledAt: appointment.scheduledAt.toISOString(),
      endsAt: new Date(
        appointment.scheduledAt.getTime() + appointment.durationMinutes * 60_000,
      ).toISOString(),
      durationMinutes: appointment.durationMinutes,
      status: 'confirmed',
      calendarSyncStatus: 'synced',
      calendarEventId: 'event_1',
      calendarEventHtmlLink: null,
      notificationQueued: true,
      notificationErrorCode: null,
    };
  }

  async cancelAppointment(input: CancelAppointmentInput) {
    const appointment = this.repository.appointments.find(
      (item) => item.appointmentId === input.appointmentId,
    );

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    appointment.status = 'cancelled';

    return {
      appointmentId: appointment.appointmentId,
      scheduledAt: appointment.scheduledAt.toISOString(),
      endsAt: new Date(
        appointment.scheduledAt.getTime() + appointment.durationMinutes * 60_000,
      ).toISOString(),
      durationMinutes: appointment.durationMinutes,
      status: 'cancelled',
      calendarSyncStatus: 'synced',
      calendarEventId: 'event_1',
      calendarEventHtmlLink: null,
      notificationQueued: true,
      notificationErrorCode: null,
    };
  }
}

function textPayload(messageId: string, body: string) {
  return WhatsAppWebhookPayloadSchema.parse({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba_1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '390212345678',
                phone_number_id: phoneNumberId,
              },
              messages: [
                {
                  from: customerIdentifier,
                  id: messageId,
                  timestamp: '1777273200',
                  type: 'text',
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

function audioPayload(messageId: string) {
  return WhatsAppWebhookPayloadSchema.parse({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba_1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '390212345678',
                phone_number_id: phoneNumberId,
              },
              messages: [
                {
                  from: customerIdentifier,
                  id: messageId,
                  timestamp: '1777273200',
                  type: 'audio',
                  audio: {
                    id: 'media_audio_1',
                    mime_type: 'audio/ogg',
                    sha256: 'audio_hash',
                    voice: true,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

class InMemoryWhatsAppMediaDownloader implements WhatsAppMediaDownloader {
  readonly downloads: DownloadWhatsAppMediaInput[] = [];

  async downloadMedia(input: DownloadWhatsAppMediaInput): Promise<DownloadedWhatsAppMedia> {
    this.downloads.push(input);

    return {
      mediaId: input.mediaId,
      bytes: new Uint8Array([1, 2, 3]),
      contentType: input.expectedMimeType ?? 'audio/ogg',
      sha256: 'audio_hash',
      rawMetadata: {
        id: input.mediaId,
      },
    };
  }
}

class InMemoryTenantMediaStorage implements TenantMediaStorage {
  readonly uploads: StoreVoiceMediaInput[] = [];

  async storeVoiceMedia(input: StoreVoiceMediaInput): Promise<StoredVoiceMedia> {
    this.uploads.push(input);

    return {
      bucket: 'ambrogio-media',
      path: `${input.tenantId}/voice/${input.messageId}/${input.mediaId}.ogg`,
      uri: `supabase://ambrogio-media/${input.tenantId}/voice/${input.messageId}/${input.mediaId}.ogg`,
    };
  }
}

class InMemoryVoiceTranscriber implements VoiceTranscriber {
  readonly calls: Array<{
    audio: Blob;
    languageCode?: string;
    keyterms?: string[];
  }> = [];

  constructor(private readonly transcriptText: string) {}

  async transcribe(input: {
    audio: Blob;
    languageCode?: string;
    keyterms?: string[];
  }): Promise<VoiceTranscript> {
    this.calls.push(input);

    return {
      text: this.transcriptText,
      languageCode: 'it',
      languageProbability: 0.98,
      audioDurationSecs: 4.2,
    };
  }
}

function slot(start: string, end: string): BookingSlot {
  return {
    tenantId,
    serviceId: 'service_1',
    serviceName: 'Prima visita',
    start,
    end,
    durationMinutes: 30,
    timezone: 'UTC',
  };
}

function lastOutboundText(repository: InMemoryWhatsAppBookingRepository): string {
  const payload = repository.outboxJobs.at(-1)?.payload;

  if (!isRecord(payload)) {
    return '';
  }

  const text = payload.text;

  if (!isRecord(text)) {
    return '';
  }

  return typeof text.body === 'string' ? text.body : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];

  return typeof value === 'string' ? value : null;
}
