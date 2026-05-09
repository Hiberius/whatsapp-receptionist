import { describe, expect, it } from 'vitest';

import type { AuthSession } from '@/lib/auth/session';
import {
  ConversationInboxService,
  type ConversationInboxRepository,
  type ConversationMessage,
  type ConversationSummary,
} from '@/server/conversations/inbox';

describe('ConversationInboxService', () => {
  it('lists tenant conversations with filters and a cursor', async () => {
    const service = new ConversationInboxService(new FakeConversationInboxRepository());

    await expect(
      service.listConversations({
        session: memberSession(),
        filters: {
          status: 'active',
          channel: 'whatsapp',
          limit: 1,
        },
      }),
    ).resolves.toEqual({
      conversations: [
        expect.objectContaining({
          id: '00000000-0000-4000-8000-000000000101',
          customerIdentifier: '393331112233',
          status: 'active',
        }),
      ],
      nextCursor: '2026-04-26T09:00:00.000Z',
    });
  });

  it('loads conversation detail with normalized message metadata', async () => {
    const service = new ConversationInboxService(new FakeConversationInboxRepository());

    const detail = await service.getConversation({
      session: memberSession(),
      conversationId: '00000000-0000-4000-8000-000000000101',
    });

    expect(detail.conversation.customerName).toBe('Mario Rossi');
    expect(detail.messages).toEqual([
      expect.objectContaining({
        direction: 'inbound',
        senderType: 'customer',
        content: 'Vorrei prenotare una visita',
        intent: 'booking_request',
      }),
      expect.objectContaining({
        direction: 'outbound',
        senderType: 'ai',
        content: 'Ti propongo questi orari.',
        status: 'sent',
      }),
    ]);
  });

  it('updates conversation state for admins and writes audit metadata', async () => {
    const repository = new FakeConversationInboxRepository();
    const service = new ConversationInboxService(repository);

    const updated = await service.updateConversation({
      session: adminSession(),
      conversationId: '00000000-0000-4000-8000-000000000101',
      patch: {
        status: 'escalated',
        aiEnabled: false,
        customerName: ' Mario Studio ',
      },
      ipAddress: '203.0.113.10',
      userAgent: 'Vitest',
    });

    expect(updated).toMatchObject({
      status: 'escalated',
      aiEnabled: false,
      customerName: 'Mario Studio',
    });
    expect(repository.auditLogs).toEqual([
      expect.objectContaining({
        action: 'conversations.conversation.updated',
        resourceType: 'conversation',
        resourceId: '00000000-0000-4000-8000-000000000101',
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
        metadata: {
          fields: ['status', 'aiEnabled', 'customerName'],
          status: 'escalated',
          aiEnabled: false,
        },
      }),
    ]);
  });

  it('blocks members from mutating conversation state', async () => {
    const service = new ConversationInboxService(new FakeConversationInboxRepository());

    await expect(
      service.updateConversation({
        session: memberSession(),
        conversationId: '00000000-0000-4000-8000-000000000101',
        patch: {
          status: 'closed',
        },
      }),
    ).rejects.toMatchObject({
      code: 'forbidden',
    });
  });
});

class FakeConversationInboxRepository implements ConversationInboxRepository {
  readonly conversations: ConversationSummary[] = [
    conversationRecord({
      id: '00000000-0000-4000-8000-000000000101',
      customerIdentifier: '393331112233',
      customerName: 'Mario Rossi',
      status: 'active',
      lastMessageAt: '2026-04-26T09:00:00.000Z',
    }),
    conversationRecord({
      id: '00000000-0000-4000-8000-000000000102',
      customerIdentifier: '393331114455',
      customerName: 'Giulia Bianchi',
      status: 'closed',
      lastMessageAt: '2026-04-26T08:00:00.000Z',
    }),
  ];
  readonly messages: ConversationMessage[] = [
    messageRecord({
      id: '00000000-0000-4000-8000-000000000201',
      conversationId: '00000000-0000-4000-8000-000000000101',
      direction: 'inbound',
      senderType: 'customer',
      content: 'Vorrei prenotare una visita',
      intent: 'booking_request',
    }),
    messageRecord({
      id: '00000000-0000-4000-8000-000000000202',
      conversationId: '00000000-0000-4000-8000-000000000101',
      direction: 'outbound',
      senderType: 'ai',
      content: 'Ti propongo questi orari.',
      status: 'sent',
    }),
  ];
  readonly auditLogs: Array<Parameters<ConversationInboxRepository['recordAuditLog']>[0]> = [];

  async listConversations(input: {
    tenantId: string;
    filters: Parameters<ConversationInboxRepository['listConversations']>[0]['filters'];
  }): Promise<ConversationSummary[]> {
    return this.conversations
      .filter((conversation) =>
        input.filters.status ? conversation.status === input.filters.status : true,
      )
      .filter((conversation) =>
        input.filters.channel ? conversation.channel === input.filters.channel : true,
      )
      .filter((conversation) =>
        input.filters.before
          ? conversation.lastMessageAt < input.filters.before.toISOString()
          : true,
      )
      .slice(0, input.filters.limit)
      .map((conversation) => ({ ...conversation }));
  }

  async getConversation(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<ConversationSummary | null> {
    return (
      this.conversations.find((conversation) => conversation.id === input.conversationId) ?? null
    );
  }

  async listMessages(input: {
    tenantId: string;
    conversationId: string;
    limit: number;
  }): Promise<ConversationMessage[]> {
    return this.messages
      .filter((message) => message.metadata.conversationId === input.conversationId)
      .slice(0, input.limit)
      .map((message) => ({ ...message, metadata: { ...message.metadata } }));
  }

  async updateConversation(input: {
    tenantId: string;
    conversationId: string;
    patch: Parameters<ConversationInboxRepository['updateConversation']>[0]['patch'];
  }): Promise<ConversationSummary | null> {
    const index = this.conversations.findIndex(
      (conversation) => conversation.id === input.conversationId,
    );

    if (index === -1) {
      return null;
    }

    const current = this.conversations[index];

    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      ...input.patch,
      updatedAt: '2026-04-26T12:00:00.000Z',
    };
    this.conversations[index] = updated;

    return { ...updated };
  }

  async recordAuditLog(
    input: Parameters<ConversationInboxRepository['recordAuditLog']>[0],
  ): Promise<void> {
    this.auditLogs.push(input);
  }
}

function adminSession(): AuthSession {
  return {
    userId: '00000000-0000-4000-8000-000000000099',
    tenantId: '00000000-0000-4000-8000-000000000001',
    role: 'admin',
  };
}

function memberSession(): AuthSession {
  return {
    ...adminSession(),
    role: 'member',
  };
}

function conversationRecord(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: '00000000-0000-4000-8000-000000000101',
    channel: 'whatsapp',
    customerIdentifier: '393331112233',
    customerName: null,
    status: 'active',
    aiEnabled: true,
    lastMessageAt: '2026-04-26T09:00:00.000Z',
    metadata: {},
    createdAt: '2026-04-26T08:00:00.000Z',
    updatedAt: '2026-04-26T09:00:00.000Z',
    ...overrides,
  };
}

function messageRecord(
  overrides: Partial<ConversationMessage> & { conversationId: string },
): ConversationMessage {
  return {
    id: '00000000-0000-4000-8000-000000000201',
    direction: 'inbound',
    senderType: 'customer',
    content: 'Ciao',
    mediaUrls: [],
    messageType: 'text',
    status: 'received',
    transcriptText: null,
    transcriptLanguage: null,
    audioDurationSecs: null,
    generatedAudioUrl: null,
    voiceId: null,
    voiceModelId: null,
    intent: null,
    confidence: null,
    tokensUsed: null,
    costCents: null,
    metadata: {
      conversationId: overrides.conversationId,
    },
    createdAt: '2026-04-26T08:30:00.000Z',
    updatedAt: '2026-04-26T08:30:00.000Z',
    ...overrides,
  };
}
