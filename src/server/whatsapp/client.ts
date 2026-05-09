import { AppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';

export type SendWhatsAppTextInput = {
  to: string;
  body: string;
  previewUrl?: boolean;
};

export type SendWhatsAppTextResult = {
  providerMessageId: string;
  rawResponse: unknown;
};

export type WhatsAppTemplateTextParameter = {
  type: 'text';
  text: string;
};

export type WhatsAppTemplateParameter = WhatsAppTemplateTextParameter;

export type WhatsAppTemplateComponent = {
  type: 'header' | 'body' | 'button';
  subType?: 'quick_reply' | 'url';
  index?: string | number;
  parameters?: WhatsAppTemplateParameter[];
};

export type SendWhatsAppTemplateInput = {
  to: string;
  name: string;
  languageCode: string;
  components?: WhatsAppTemplateComponent[];
};

export type SendWhatsAppTemplateResult = SendWhatsAppTextResult;

export interface WhatsAppMessageSender {
  sendText(input: SendWhatsAppTextInput): Promise<SendWhatsAppTextResult>;
  sendTemplate(input: SendWhatsAppTemplateInput): Promise<SendWhatsAppTemplateResult>;
}

type FetchLike = typeof fetch;

export class Dialog360WhatsAppClient implements WhatsAppMessageSender {
  constructor(
    private readonly config: {
      apiUrl?: string;
      apiKey?: string;
      fetcher?: FetchLike;
    } = {},
  ) {}

  async sendText(input: SendWhatsAppTextInput): Promise<SendWhatsAppTextResult> {
    return this.sendMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to,
      type: 'text',
      text: {
        body: input.body,
        preview_url: input.previewUrl ?? false,
      },
    });
  }

  async sendTemplate(input: SendWhatsAppTemplateInput): Promise<SendWhatsAppTemplateResult> {
    return this.sendMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to,
      type: 'template',
      template: {
        name: input.name,
        language: {
          code: input.languageCode,
        },
        ...(input.components && input.components.length > 0
          ? { components: toProviderTemplateComponents(input.components) }
          : {}),
      },
    });
  }

  private async sendMessage(body: Record<string, unknown>): Promise<SendWhatsAppTextResult> {
    const apiKey = this.config.apiKey ?? env.WHATSAPP_API_KEY;

    if (!apiKey) {
      throw new AppError('internal', 'WhatsApp API key is not configured', {
        expose: false,
      });
    }

    const response = await (this.config.fetcher ?? fetch)(
      new URL('/messages', this.config.apiUrl ?? env.WHATSAPP_API_URL),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'D360-API-KEY': apiKey,
        },
        body: JSON.stringify(body),
      },
    );

    const rawResponse = await readJsonResponse(response);

    if (!response.ok) {
      throw new AppError('upstream_error', 'WhatsApp send failed', {
        cause: {
          status: response.status,
          body: rawResponse,
        },
        expose: false,
      });
    }

    const providerMessageId = extractProviderMessageId(rawResponse);

    if (!providerMessageId) {
      throw new AppError('upstream_error', 'WhatsApp send response did not include a message id', {
        cause: rawResponse,
        expose: false,
      });
    }

    return {
      providerMessageId,
      rawResponse,
    };
  }
}

export function createWhatsAppMessageSender(): WhatsAppMessageSender {
  return new Dialog360WhatsAppClient();
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractProviderMessageId(rawResponse: unknown): string | null {
  if (
    typeof rawResponse !== 'object' ||
    rawResponse === null ||
    !('messages' in rawResponse) ||
    !Array.isArray(rawResponse.messages)
  ) {
    return null;
  }

  const firstMessage = rawResponse.messages[0];

  if (
    typeof firstMessage !== 'object' ||
    firstMessage === null ||
    !('id' in firstMessage) ||
    typeof firstMessage.id !== 'string'
  ) {
    return null;
  }

  return firstMessage.id;
}

function toProviderTemplateComponents(
  components: WhatsAppTemplateComponent[],
): Array<Record<string, unknown>> {
  return components.map((component) => ({
    type: component.type,
    ...(component.subType ? { sub_type: component.subType } : {}),
    ...(component.index !== undefined ? { index: component.index } : {}),
    ...(component.parameters && component.parameters.length > 0
      ? { parameters: component.parameters }
      : {}),
  }));
}
