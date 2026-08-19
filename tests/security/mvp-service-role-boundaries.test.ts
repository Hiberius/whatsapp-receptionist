import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

type BoundaryContract = {
  file: string;
  className: string;
  methodName: string;
  requiredGuards: string[];
};

const contracts: BoundaryContract[] = [
  {
    file: 'src/server/appointments/booking.ts',
    className: 'SupabaseAppointmentBookingRepository',
    methodName: 'getBookingContext',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.serviceId)"],
  },
  {
    file: 'src/server/appointments/booking.ts',
    className: 'SupabaseAppointmentBookingRepository',
    methodName: 'getAppointmentForChange',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.appointmentId)"],
  },
  {
    file: 'src/server/appointments/booking.ts',
    className: 'SupabaseAppointmentBookingRepository',
    methodName: 'updateAppointmentSchedule',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.appointmentId)"],
  },
  {
    file: 'src/server/appointments/booking.ts',
    className: 'SupabaseAppointmentBookingRepository',
    methodName: 'cancelAppointmentRecord',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.appointmentId)"],
  },
  {
    file: 'src/server/appointments/booking.ts',
    className: 'SupabaseAppointmentBookingRepository',
    methodName: 'updateGoogleCalendarAccessToken',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.integrationId)"],
  },
  {
    file: 'src/server/ai/booking-bridge.ts',
    className: 'SupabaseBookingBridgeRepository',
    methodName: 'listCustomerAppointments',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('customer_identifier'"],
  },
  {
    file: 'src/server/ai/booking-bridge.ts',
    className: 'SupabaseBookingBridgeRepository',
    methodName: 'readConversationMetadata',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.conversationId)"],
  },
  {
    file: 'src/server/ai/booking-bridge.ts',
    className: 'SupabaseBookingBridgeRepository',
    methodName: 'writeConversationMetadata',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.conversationId)"],
  },
  {
    file: 'src/server/ai/context.ts',
    className: 'SupabaseAiContextRepository',
    methodName: 'listConversationMessages',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('conversation_id'"],
  },
  {
    file: 'src/server/ai/context.ts',
    className: 'SupabaseAiContextRepository',
    methodName: 'listActivePrompts',
    requiredGuards: ['tenant_id.is.null,tenant_id.eq.${input.tenantId}'],
  },
  {
    file: 'src/server/ai/context.ts',
    className: 'SupabaseAiContextRepository',
    methodName: 'listKnowledgeBaseEntries',
    requiredGuards: [".eq('tenant_id', input.tenantId)"],
  },
  {
    file: 'src/server/ai/context.ts',
    className: 'SupabaseAiContextRepository',
    methodName: 'matchKnowledgeBaseByEmbedding',
    requiredGuards: ['p_tenant_id: input.tenantId'],
  },
  {
    file: 'src/server/knowledge-base/documents.ts',
    className: 'SupabaseKnowledgeBaseRepository',
    methodName: 'getDocument',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.documentId)"],
  },
  {
    file: 'src/server/knowledge-base/documents.ts',
    className: 'SupabaseKnowledgeBaseRepository',
    methodName: 'updateDocument',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.documentId)"],
  },
  {
    file: 'src/server/conversations/inbox.ts',
    className: 'SupabaseConversationInboxRepository',
    methodName: 'getConversation',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.conversationId)"],
  },
  {
    file: 'src/server/conversations/inbox.ts',
    className: 'SupabaseConversationInboxRepository',
    methodName: 'listMessages',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('conversation_id'"],
  },
  {
    file: 'src/server/conversations/operator-messages.ts',
    className: 'SupabaseOperatorMessagesRepository',
    methodName: 'getConversation',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.conversationId)"],
  },
  {
    file: 'src/server/conversations/operator-messages.ts',
    className: 'SupabaseOperatorMessagesRepository',
    methodName: 'insertOperatorMessage',
    requiredGuards: ['tenant_id: input.tenantId', 'conversation_id: input.conversationId'],
  },
  {
    file: 'src/server/conversations/operator-messages.ts',
    className: 'SupabaseOperatorMessagesRepository',
    methodName: 'enqueueOutboundMessage',
    requiredGuards: ['tenant_id: input.tenantId', 'message_id: input.messageId'],
  },
  {
    file: 'src/server/conversations/escalation.ts',
    className: 'SupabaseEscalationRepository',
    methodName: 'getConversation',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.conversationId)"],
  },
  {
    file: 'src/server/conversations/escalation.ts',
    className: 'SupabaseEscalationRepository',
    methodName: 'markConversationEscalated',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.conversationId)"],
  },
  {
    file: 'src/server/integrations/google-calendar-oauth.ts',
    className: 'SupabaseGoogleCalendarOAuthRepository',
    methodName: 'getGoogleCalendarIntegration',
    requiredGuards: [".eq('tenant_id', tenantId)", ".eq('provider', 'google_calendar')"],
  },
  {
    file: 'src/server/integrations/google-calendar-oauth.ts',
    className: 'SupabaseGoogleCalendarOAuthRepository',
    methodName: 'markGoogleCalendarDisconnected',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.integrationId)"],
  },
  {
    file: 'src/server/whatsapp/repository.ts',
    className: 'SupabaseWhatsAppWebhookRepository',
    methodName: 'upsertConversation',
    requiredGuards: [".eq('tenant_id', input.tenantId)", 'tenant_id: input.tenantId'],
  },
  {
    file: 'src/server/whatsapp/repository.ts',
    className: 'SupabaseWhatsAppWebhookRepository',
    methodName: 'updateInboundMessageAnalysis',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('id', input.messageId)"],
  },
  {
    file: 'src/server/whatsapp/repository.ts',
    className: 'SupabaseWhatsAppWebhookRepository',
    methodName: 'insertOutboundMessage',
    requiredGuards: ['tenant_id: input.tenantId', 'conversation_id: input.conversationId'],
  },
  {
    file: 'src/server/whatsapp/repository.ts',
    className: 'SupabaseWhatsAppWebhookRepository',
    methodName: 'enqueueOutboundMessage',
    requiredGuards: ['tenant_id: input.tenantId', 'message_id: input.messageId'],
  },
  {
    file: 'src/server/whatsapp/repository.ts',
    className: 'SupabaseWhatsAppWebhookRepository',
    methodName: 'updateOutboundMessageStatus',
    requiredGuards: [".eq('tenant_id', input.tenantId)", ".eq('direction', 'outbound')"],
  },
];

async function readMethod(contract: BoundaryContract): Promise<string> {
  const source = await readFile(join(process.cwd(), contract.file), 'utf8');
  const classMarker = `class ${contract.className}`;
  const classStart = source.indexOf(classMarker);
  expect(classStart, `${contract.file}: ${contract.className}`).toBeGreaterThanOrEqual(0);

  const nextClass = source.indexOf('\nexport class ', classStart + classMarker.length);
  const classSource = source.slice(classStart, nextClass === -1 ? undefined : nextClass);
  const methodPattern = new RegExp(`\\n  (?:private )?async ${contract.methodName}\\b`);
  const methodMatch = methodPattern.exec(classSource);
  expect(methodMatch, `${contract.file}: ${contract.methodName}`).not.toBeNull();

  const methodStart = methodMatch!.index;
  const nextMethodPattern = /\n  (?:private )?async [A-Za-z]/g;
  nextMethodPattern.lastIndex = methodStart + methodMatch![0].length;
  const nextMethod = nextMethodPattern.exec(classSource);

  return classSource.slice(methodStart, nextMethod?.index);
}

describe('MVP service-role tenant boundary contracts', () => {
  it.each(contracts)(
    '$className.$methodName keeps its tenant/resource boundary',
    async (contract) => {
      const method = await readMethod(contract);

      for (const guard of contract.requiredGuards) {
        expect(method, `${contract.file}: missing ${guard}`).toContain(guard);
      }
    },
  );
});
