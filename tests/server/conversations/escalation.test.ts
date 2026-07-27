import { describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import {
  EscalationService,
  type EscalationConversationSnapshot,
  type EscalationCustomerNotifier,
  type EscalationRepository,
  type EscalationTenantContact,
} from '@/server/conversations/escalation';
import type { EmailMessage, EmailSender, EmailSendResult } from '@/server/notifications/mailer';
import { ReplyOrchestrator } from '@/server/ai/reply-orchestrator';
import {
  WhatsAppAutoReplyService,
  type WhatsAppAutoReplyRepository,
} from '@/server/whatsapp/auto-reply';
import type {
  EnqueueOutboundMessageInput,
  EnqueueOutboundMessageResult,
  InsertOutboundMessageInput,
  InsertOutboundMessageResult,
  TenantMessagingConfig,
  UpdateInboundMessageAnalysisInput,
} from '@/server/whatsapp/repository';

const occurredAt = new Date('2026-04-25T09:00:00.000Z');
const escalatedAt = new Date('2026-04-25T09:00:02.000Z');

describe('EscalationService', () => {
  it('marks the conversation escalated, warns the customer and emails the operator', async () => {
    const world = createWorld();

    const result = await world.service.escalate({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      customerIdentifier: '393331112233',
      inboundExternalId: 'message:wamid.1',
      messageText: 'Ho un dolore forte al dente, non riesco a dormire',
      occurredAt,
      reason: 'sensitive_handoff',
      aiReplied: false,
    });

    expect(result).toMatchObject({
      escalated: true,
      alreadyEscalated: false,
      customerNotified: true,
      email: { recipientConfigured: true, attempted: true, delivered: true },
    });
    expect(world.repository.conversations.get('tenant_1:conversation_1')?.status).toBe('escalated');
    expect(world.repository.markCalls).toEqual([
      { tenantId: 'tenant_1', conversationId: 'conversation_1', escalatedAt },
    ]);

    const email = world.emailSender.sent[0];
    expect(email?.to).toBe('reception@studio.example');
    expect(email?.subject).toContain('Studio Rossi');
    expect(email?.text).toContain('Ho un dolore forte al dente');
    expect(email?.text).toContain('393331112233');
    expect(email?.text).toContain('Giulia Bianchi');
    expect(email?.text).toContain('25 aprile 2026');
    expect(email?.text).toContain('https://app.ambrogio.test/conversations/conversation_1');
    expect(email?.text).toContain('avviso che una persona lo ricontattera');
    expect(email?.html).toContain('https://app.ambrogio.test/conversations/conversation_1');

    expect(world.notifier.inserted[0]).toMatchObject({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      externalId: 'escalation:message:wamid.1',
      metadata: { source: 'escalation_notice', reason: 'sensitive_handoff' },
    });
    expect(world.notifier.inserted[0]?.content).toContain('avvisato subito una persona');
    expect(world.notifier.enqueued[0]).toMatchObject({
      tenantId: 'tenant_1',
      messageId: 'outbound_1',
      recipientIdentifier: '393331112233',
    });
  });

  it('escapes customer text before putting it in the HTML body', async () => {
    const world = createWorld();

    await world.service.escalate({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      customerIdentifier: '393331112233',
      inboundExternalId: 'message:wamid.1',
      messageText: '<script>alert(1)</script> emergenza',
      occurredAt,
      reason: 'sensitive_handoff',
      aiReplied: false,
    });

    const email = world.emailSender.sent[0];
    expect(email?.html).not.toContain('<script>');
    expect(email?.html).toContain('&lt;script&gt;');
  });

  it('keeps the escalation when the email transport fails', async () => {
    const world = createWorld();
    world.emailSender.failWith = new Error('resend is down');

    const result = await world.service.escalate({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      customerIdentifier: '393331112233',
      inboundExternalId: 'message:wamid.1',
      messageText: 'emergenza',
      occurredAt,
      reason: 'sensitive_handoff',
      aiReplied: false,
    });

    expect(result.escalated).toBe(true);
    expect(result.email).toEqual({
      recipientConfigured: true,
      attempted: true,
      delivered: false,
    });
    expect(world.repository.conversations.get('tenant_1:conversation_1')?.status).toBe('escalated');
    expect(world.notifier.enqueued).toHaveLength(1);
    expect(world.log.errors).toHaveLength(1);
  });

  it('keeps the escalation when the WhatsApp notice fails', async () => {
    const world = createWorld();
    world.notifier.failWith = new Error('outbox unavailable');

    const result = await world.service.escalate({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      customerIdentifier: '393331112233',
      inboundExternalId: 'message:wamid.1',
      messageText: 'emergenza',
      occurredAt,
      reason: 'sensitive_handoff',
      aiReplied: false,
    });

    expect(result).toMatchObject({ escalated: true, customerNotified: false });
    expect(world.repository.conversations.get('tenant_1:conversation_1')?.status).toBe('escalated');
    expect(world.emailSender.sent[0]?.text).toContain('non ha ricevuto nessuna risposta');
  });

  it('does not escalate the same conversation twice', async () => {
    const world = createWorld({ status: 'escalated' });

    const result = await world.service.escalate({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      customerIdentifier: '393331112233',
      inboundExternalId: 'message:wamid.2',
      messageText: 'ho ancora dolore forte',
      occurredAt,
      reason: 'sensitive_handoff',
      aiReplied: false,
    });

    expect(result).toMatchObject({ escalated: false, alreadyEscalated: true });
    expect(world.repository.markCalls).toHaveLength(0);
    expect(world.emailSender.sent).toHaveLength(0);
    expect(world.notifier.inserted).toHaveLength(0);
  });

  it('reports already escalated when a concurrent writer wins the status transition', async () => {
    const world = createWorld();
    world.repository.markResultOverride = false;

    const result = await world.service.escalate({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      customerIdentifier: '393331112233',
      inboundExternalId: 'message:wamid.1',
      messageText: 'emergenza',
      occurredAt,
      reason: 'sensitive_handoff',
      aiReplied: false,
    });

    expect(result).toMatchObject({ escalated: false, alreadyEscalated: true });
    expect(world.emailSender.sent).toHaveLength(0);
    expect(world.notifier.inserted).toHaveLength(0);
  });

  it('skips the WhatsApp notice when the AI already replied to the customer', async () => {
    const world = createWorld();

    const result = await world.service.escalate({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      customerIdentifier: '393331112233',
      inboundExternalId: 'message:wamid.1',
      messageText: 'Vorrei parlare con un operatore',
      occurredAt,
      reason: 'human_handoff_intent',
      aiReplied: true,
    });

    expect(result.customerNotified).toBe(false);
    expect(world.notifier.inserted).toHaveLength(0);
    expect(world.emailSender.sent[0]?.text).toContain('ha gia risposto al cliente');
  });

  it('escalates without email when the tenant configured no escalation address', async () => {
    const world = createWorld();
    world.repository.contact = {
      studioName: 'Studio Rossi',
      escalationEmail: null,
      timezone: 'Europe/Rome',
    };

    const result = await world.service.escalate({
      tenantId: 'tenant_1',
      conversationId: 'conversation_1',
      customerIdentifier: '393331112233',
      inboundExternalId: 'message:wamid.1',
      messageText: 'emergenza',
      occurredAt,
      reason: 'sensitive_handoff',
      aiReplied: false,
    });

    expect(result).toMatchObject({
      escalated: true,
      customerNotified: true,
      email: { recipientConfigured: false, attempted: false, delivered: false },
    });
    expect(world.emailSender.sent).toHaveLength(0);
  });

  it('refuses to escalate a conversation belonging to another tenant', async () => {
    const world = createWorld();

    await expect(
      world.service.escalate({
        tenantId: 'tenant_other',
        conversationId: 'conversation_1',
        customerIdentifier: '393331112233',
        inboundExternalId: 'message:wamid.1',
        messageText: 'emergenza',
        occurredAt,
        reason: 'sensitive_handoff',
        aiReplied: false,
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(world.repository.markCalls).toHaveLength(0);
    expect(world.emailSender.sent).toHaveLength(0);
  });
});

describe('WhatsAppAutoReplyService escalation wiring', () => {
  it('escalates a sensitive inbound message instead of staying silent', async () => {
    const world = createWorld();
    const repository = new FakeAutoReplyRepository();
    const service = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
      replyOrchestrator: new ReplyOrchestrator(),
      escalation: world.service,
    });

    const result = await service.handleInboundMessage({
      ...baseInput(),
      text: 'Ho un dolore forte fortissimo, cosa faccio?',
    });

    expect(result).toMatchObject({
      queued: false,
      skippedReason: 'guardrail',
      classification: { intent: 'human_handoff' },
    });
    expect(world.repository.conversations.get('tenant_1:conversation_1')?.status).toBe('escalated');
    expect(world.emailSender.sent[0]?.text).toContain('segnali sensibili');
    // Il guardrail blocca l'auto-reply: l'unico messaggio al cliente e' l'avviso di escalation.
    expect(repository.outboundMessages).toHaveLength(0);
    expect(world.notifier.enqueued).toHaveLength(1);
  });

  it('escalates when the customer explicitly asks for a human, without a second message', async () => {
    const world = createWorld();
    const repository = new FakeAutoReplyRepository();
    const service = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
      replyOrchestrator: new ReplyOrchestrator(),
      escalation: world.service,
    });

    const result = await service.handleInboundMessage({
      ...baseInput(),
      source: 'text',
      transcriptLanguageProbability: null,
      text: 'Vorrei parlare con un operatore',
    });

    expect(result).toMatchObject({
      queued: true,
      classification: { intent: 'human_handoff' },
    });
    expect(world.repository.conversations.get('tenant_1:conversation_1')?.status).toBe('escalated');
    expect(world.emailSender.sent[0]?.text).toContain('chiesto di parlare con una persona');
    expect(repository.outboxJobs).toHaveLength(1);
    // L'auto-reply ha gia' scritto al cliente: nessun avviso di escalation aggiuntivo.
    expect(world.notifier.inserted).toHaveLength(0);
  });

  it('never escalates a routine booking request', async () => {
    const world = createWorld();
    const repository = new FakeAutoReplyRepository();
    const service = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
      replyOrchestrator: new ReplyOrchestrator(),
      escalation: world.service,
    });

    await service.handleInboundMessage({
      ...baseInput(),
      source: 'text',
      transcriptLanguageProbability: null,
      text: 'Vorrei prenotare una visita domani mattina',
    });

    expect(world.repository.conversations.get('tenant_1:conversation_1')?.status).toBe('active');
    expect(world.emailSender.sent).toHaveLength(0);
  });

  it('does not fail the inbound message when the escalation blows up', async () => {
    const world = createWorld();
    world.repository.failWith = new Error('supabase unreachable');
    const repository = new FakeAutoReplyRepository();
    const log = new FakeLogger();
    const service = new WhatsAppAutoReplyService(repository, {
      autoReplyEnabled: true,
      replyOrchestrator: new ReplyOrchestrator(),
      escalation: world.service,
      log,
    });

    const result = await service.handleInboundMessage({
      ...baseInput(),
      text: 'emergenza, sto sanguinando',
    });

    expect(result).toMatchObject({ analyzed: true, skippedReason: 'guardrail' });
    expect(log.errors).toHaveLength(1);
    expect(repository.messageAnalyses).toHaveLength(1);
  });
});

// ---------- Fixture ----------

function baseInput() {
  return {
    tenantId: 'tenant_1',
    conversationId: 'conversation_1',
    inboundMessageId: 'message_1',
    inboundExternalId: 'message:wamid.audio',
    customerIdentifier: '393331112233',
    occurredAt,
    source: 'voice_transcript' as const,
    provider: 'whatsapp_360dialog' as const,
    whatsappMessageId: 'wamid.audio',
    phoneNumberId: 'phone_123',
    displayPhoneNumber: '390212345678',
    transcriptLanguage: 'it',
    transcriptLanguageProbability: 0.98,
  };
}

function createWorld(conversationOverrides: Partial<EscalationConversationSnapshot> = {}) {
  const repository = new FakeEscalationRepository(conversationOverrides);
  const emailSender = new FakeEmailSender();
  const notifier = new FakeCustomerNotifier();
  const log = new FakeLogger();
  const service = new EscalationService({
    repository,
    emailSender,
    customerNotifier: notifier,
    log,
    appUrl: 'https://app.ambrogio.test/',
    now: () => escalatedAt,
  });

  return { repository, emailSender, notifier, log, service };
}

class FakeEscalationRepository implements EscalationRepository {
  readonly conversations = new Map<string, EscalationConversationSnapshot>();
  readonly markCalls: Array<{
    tenantId: string;
    conversationId: string;
    escalatedAt: Date;
  }> = [];
  contact: EscalationTenantContact = {
    studioName: 'Studio Rossi',
    escalationEmail: 'reception@studio.example',
    timezone: 'Europe/Rome',
  };
  markResultOverride: boolean | null = null;
  failWith: Error | null = null;

  constructor(overrides: Partial<EscalationConversationSnapshot> = {}) {
    const conversation: EscalationConversationSnapshot = {
      conversationId: 'conversation_1',
      tenantId: 'tenant_1',
      channel: 'whatsapp',
      status: 'active',
      customerIdentifier: '393331112233',
      customerName: 'Giulia Bianchi',
      ...overrides,
    };
    this.conversations.set(`${conversation.tenantId}:${conversation.conversationId}`, conversation);
  }

  async getConversation(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<EscalationConversationSnapshot | null> {
    if (this.failWith) {
      throw this.failWith;
    }

    return this.conversations.get(`${input.tenantId}:${input.conversationId}`) ?? null;
  }

  async markConversationEscalated(input: {
    tenantId: string;
    conversationId: string;
    escalatedAt: Date;
  }): Promise<boolean> {
    this.markCalls.push(input);

    if (this.markResultOverride !== null) {
      return this.markResultOverride;
    }

    const key = `${input.tenantId}:${input.conversationId}`;
    const current = this.conversations.get(key);

    if (!current || current.status === 'escalated') {
      return false;
    }

    this.conversations.set(key, { ...current, status: 'escalated' });

    return true;
  }

  async getTenantEscalationContact(tenantId: string): Promise<EscalationTenantContact> {
    if (tenantId !== 'tenant_1') {
      throw new Error(`Unexpected tenant: ${tenantId}`);
    }

    return this.contact;
  }
}

class FakeEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  failWith: Error | null = null;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (this.failWith) {
      throw this.failWith;
    }

    this.sent.push(message);

    return {
      delivered: true,
      provider: 'resend',
      providerMessageId: `email_${this.sent.length}`,
    };
  }
}

class FakeCustomerNotifier implements EscalationCustomerNotifier {
  readonly inserted: InsertOutboundMessageInput[] = [];
  readonly enqueued: EnqueueOutboundMessageInput[] = [];
  failWith: Error | null = null;
  insertCreated = true;

  async insertOutboundMessage(
    input: InsertOutboundMessageInput,
  ): Promise<InsertOutboundMessageResult> {
    if (this.failWith) {
      throw this.failWith;
    }

    this.inserted.push(input);

    return {
      messageId: this.insertCreated ? `outbound_${this.inserted.length}` : null,
      created: this.insertCreated,
    };
  }

  async enqueueOutboundMessage(
    input: EnqueueOutboundMessageInput,
  ): Promise<EnqueueOutboundMessageResult> {
    this.enqueued.push(input);

    return {
      jobId: `job_${this.enqueued.length}`,
      created: true,
    };
  }
}

class FakeLogger {
  readonly errors: Array<{ obj: Record<string, unknown>; msg: string }> = [];
  readonly warns: Array<{ obj: Record<string, unknown>; msg: string }> = [];

  info(): void {}

  warn(obj: Record<string, unknown>, msg: string): void {
    this.warns.push({ obj, msg });
  }

  error(obj: Record<string, unknown>, msg: string): void {
    this.errors.push({ obj, msg });
  }
}

/**
 * Registra le uscite dell'auto-reply separatamente da quelle dell'escalation:
 * e' l'unico modo per distinguere "il cliente ha ricevuto la risposta AI" da
 * "il cliente ha ricevuto l'avviso di escalation".
 */
class FakeAutoReplyRepository implements WhatsAppAutoReplyRepository {
  readonly messageAnalyses: UpdateInboundMessageAnalysisInput[] = [];
  readonly outboundMessages: InsertOutboundMessageInput[] = [];
  readonly outboxJobs: EnqueueOutboundMessageInput[] = [];
  readonly usageIncrements: Array<{
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
    aiCostCentsDelta?: number;
  }> = [];

  async getTenantMessagingConfig(): Promise<TenantMessagingConfig> {
    return {
      assistantName: 'Ambrogio',
      aiDisclosureEnabled: true,
      autoReplyEnabled: true,
      defaultLocale: 'it-IT',
    };
  }

  async updateInboundMessageAnalysis(input: UpdateInboundMessageAnalysisInput): Promise<void> {
    this.messageAnalyses.push(input);
  }

  async isCustomerOptedOut(): Promise<boolean> {
    return false;
  }

  async insertOutboundMessage(
    input: InsertOutboundMessageInput,
  ): Promise<InsertOutboundMessageResult> {
    this.outboundMessages.push(input);

    return {
      messageId: `auto_reply_${this.outboundMessages.length}`,
      created: true,
    };
  }

  async enqueueOutboundMessage(
    input: EnqueueOutboundMessageInput,
  ): Promise<EnqueueOutboundMessageResult> {
    this.outboxJobs.push(input);

    return {
      jobId: `auto_reply_job_${this.outboxJobs.length}`,
      created: true,
    };
  }

  async incrementUsage(input: {
    tenantId: string;
    metricMonth: string;
    messagesDelta: number;
    aiCostCentsDelta?: number;
  }): Promise<void> {
    this.usageIncrements.push(input);
  }
}
