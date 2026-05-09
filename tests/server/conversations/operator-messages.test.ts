// Fatto da Claude Code il 27 aprile 2026.
//
// Test per l'invio manuale operatore: ruolo, opt-out, finestra 24h, channel
// non WhatsApp, lunghezza testo, audit log.

import { describe, expect, it } from 'vitest';

import type { AuthSession } from '@/lib/auth/session';
import {
  OperatorMessagesService,
  type OperatorAuditLogInput,
  type OperatorConversationSnapshot,
  type OperatorMessageInsertInput,
  type OperatorMessageInsertResult,
  type OperatorMessagesRepository,
  type OperatorOutboxEnqueueInput,
  type OperatorOutboxEnqueueResult,
} from '@/server/conversations/operator-messages';

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-04-27T12:00:00.000Z');
const RECENT_LAST_MESSAGE = new Date('2026-04-27T11:00:00.000Z'); // 1h ago
const STALE_LAST_MESSAGE = new Date('2026-04-26T05:00:00.000Z'); // >24h ago

describe('OperatorMessagesService.sendMessage', () => {
  it('inserts manual outbound message and enqueues outbox job inside the 24h window', async () => {
    const repository = makeRepository({
      conversation: {
        conversationId: CONVERSATION_ID,
        tenantId: TENANT_ID,
        channel: 'whatsapp',
        customerIdentifier: '393331112233',
        lastMessageAt: RECENT_LAST_MESSAGE.toISOString(),
      },
    });
    const service = new OperatorMessagesService(repository);

    const result = await service.sendMessage({
      session: ownerSession(),
      conversationId: CONVERSATION_ID,
      content: '  Ciao Mario, confermo l appuntamento  ',
      ipAddress: '203.0.113.10',
      userAgent: 'Vitest',
      now: NOW,
    });

    expect(result.conversationId).toBe(CONVERSATION_ID);
    expect(result.messageId).toBe('msg_1');
    expect(result.externalId).toMatch(/^manual:/);
    expect(repository.insertedMessages).toEqual([
      expect.objectContaining({
        tenantId: TENANT_ID,
        conversationId: CONVERSATION_ID,
        content: 'Ciao Mario, confermo l appuntamento',
        metadata: expect.objectContaining({
          source: 'manual_operator',
        }),
      }),
    ]);
    expect(repository.enqueuedJobs).toEqual([
      expect.objectContaining({
        tenantId: TENANT_ID,
        messageId: 'msg_1',
        recipientIdentifier: '393331112233',
        payload: expect.objectContaining({
          type: 'text',
          text: { body: 'Ciao Mario, confermo l appuntamento' },
          metadata: expect.objectContaining({
            source: 'manual_operator',
            conversationId: CONVERSATION_ID,
          }),
        }),
      }),
    ]);
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'conversations.message.sent',
        resourceType: 'message',
        resourceId: 'msg_1',
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
        metadata: expect.objectContaining({
          conversationId: CONVERSATION_ID,
          senderType: 'human',
          channel: 'whatsapp',
        }),
      }),
    ]);
  });

  it('rejects member role with forbidden', async () => {
    const repository = makeRepository({
      conversation: {
        conversationId: CONVERSATION_ID,
        tenantId: TENANT_ID,
        channel: 'whatsapp',
        customerIdentifier: '393331112233',
        lastMessageAt: RECENT_LAST_MESSAGE.toISOString(),
      },
    });
    const service = new OperatorMessagesService(repository);

    await expect(
      service.sendMessage({
        session: memberSession(),
        conversationId: CONVERSATION_ID,
        content: 'Ciao',
        ipAddress: null,
        userAgent: null,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(repository.insertedMessages).toHaveLength(0);
  });

  it('rejects when conversation is missing', async () => {
    const repository = makeRepository({ conversation: null });
    const service = new OperatorMessagesService(repository);

    await expect(
      service.sendMessage({
        session: ownerSession(),
        conversationId: 'unknown',
        content: 'Ciao',
        ipAddress: null,
        userAgent: null,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejects when channel is not whatsapp', async () => {
    const repository = makeRepository({
      conversation: {
        conversationId: CONVERSATION_ID,
        tenantId: TENANT_ID,
        channel: 'instagram_dm',
        customerIdentifier: '393331112233',
        lastMessageAt: RECENT_LAST_MESSAGE.toISOString(),
      },
    });
    const service = new OperatorMessagesService(repository);

    await expect(
      service.sendMessage({
        session: ownerSession(),
        conversationId: CONVERSATION_ID,
        content: 'Ciao',
        ipAddress: null,
        userAgent: null,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'bad_request' });
  });

  it('rejects when customer is opted out and never accodes outbox', async () => {
    const repository = makeRepository({
      conversation: {
        conversationId: CONVERSATION_ID,
        tenantId: TENANT_ID,
        channel: 'whatsapp',
        customerIdentifier: '393331112233',
        lastMessageAt: RECENT_LAST_MESSAGE.toISOString(),
      },
      optedOut: true,
    });
    const service = new OperatorMessagesService(repository);

    await expect(
      service.sendMessage({
        session: ownerSession(),
        conversationId: CONVERSATION_ID,
        content: 'Ciao',
        ipAddress: null,
        userAgent: null,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(repository.insertedMessages).toHaveLength(0);
    expect(repository.enqueuedJobs).toHaveLength(0);
  });

  it('rejects free-form when customer service window is closed', async () => {
    const repository = makeRepository({
      conversation: {
        conversationId: CONVERSATION_ID,
        tenantId: TENANT_ID,
        channel: 'whatsapp',
        customerIdentifier: '393331112233',
        lastMessageAt: STALE_LAST_MESSAGE.toISOString(),
      },
    });
    const service = new OperatorMessagesService(repository);

    await expect(
      service.sendMessage({
        session: ownerSession(),
        conversationId: CONVERSATION_ID,
        content: 'Ciao',
        ipAddress: null,
        userAgent: null,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(repository.insertedMessages).toHaveLength(0);
    expect(repository.enqueuedJobs).toHaveLength(0);
  });

  it('rejects empty or whitespace-only content', async () => {
    const repository = makeRepository({
      conversation: {
        conversationId: CONVERSATION_ID,
        tenantId: TENANT_ID,
        channel: 'whatsapp',
        customerIdentifier: '393331112233',
        lastMessageAt: RECENT_LAST_MESSAGE.toISOString(),
      },
    });
    const service = new OperatorMessagesService(repository);

    await expect(
      service.sendMessage({
        session: ownerSession(),
        conversationId: CONVERSATION_ID,
        content: '   ',
        ipAddress: null,
        userAgent: null,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'bad_request' });
  });
});

function ownerSession(): AuthSession {
  return {
    userId: '00000000-0000-4000-8000-000000000099',
    tenantId: TENANT_ID,
    role: 'owner',
  };
}

function memberSession(): AuthSession {
  return { ...ownerSession(), role: 'member' };
}

function makeRepository(input: {
  conversation: OperatorConversationSnapshot | null;
  optedOut?: boolean;
}): FakeOperatorMessagesRepository {
  return new FakeOperatorMessagesRepository(input.conversation, input.optedOut ?? false);
}

class FakeOperatorMessagesRepository implements OperatorMessagesRepository {
  insertedMessages: OperatorMessageInsertInput[] = [];
  enqueuedJobs: OperatorOutboxEnqueueInput[] = [];
  auditLogs: OperatorAuditLogInput[] = [];

  constructor(
    private readonly conversation: OperatorConversationSnapshot | null,
    private readonly optedOut: boolean,
  ) {}

  async getConversation(): Promise<OperatorConversationSnapshot | null> {
    return this.conversation;
  }

  async isCustomerOptedOut(): Promise<boolean> {
    return this.optedOut;
  }

  async insertOperatorMessage(
    input: OperatorMessageInsertInput,
  ): Promise<OperatorMessageInsertResult> {
    this.insertedMessages.push(input);
    return {
      messageId: `msg_${this.insertedMessages.length}`,
      created: true,
    };
  }

  async enqueueOutboundMessage(
    input: OperatorOutboxEnqueueInput,
  ): Promise<OperatorOutboxEnqueueResult> {
    this.enqueuedJobs.push(input);
    return {
      jobId: `job_${this.enqueuedJobs.length}`,
      created: true,
    };
  }

  async recordAuditLog(input: OperatorAuditLogInput): Promise<void> {
    this.auditLogs.push(input);
  }
}
