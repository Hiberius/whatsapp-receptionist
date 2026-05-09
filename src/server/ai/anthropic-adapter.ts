import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';
import type { LlmClient, LlmCompletionInput, LlmCompletionResult } from '@/server/ai/llm';

type Fetcher = typeof fetch;

type AnthropicMessagesClientOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetcher?: Fetcher;
};

type AnthropicMessageResponse = {
  id?: string;
  type?: string;
  role?: string;
  model?: string;
  stop_reason?: string | null;
  content?: Array<{ type?: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    type?: string;
    message?: string;
  };
};

export class AnthropicMessagesClient implements LlmClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;

  constructor(options: AnthropicMessagesClientOptions = {}) {
    this.apiKey = options.apiKey ?? env.ANTHROPIC_API_KEY;
    this.model = options.model ?? env.ANTHROPIC_MODEL_PRIMARY;
    this.baseUrl = options.baseUrl ?? 'https://api.anthropic.com';
    this.fetcher = options.fetcher ?? fetch;
  }

  async complete(input: LlmCompletionInput): Promise<LlmCompletionResult> {
    if (!this.apiKey || !this.model) {
      throw new AppError('internal', 'Anthropic API key or model is not configured', {
        expose: false,
      });
    }

    const response = await this.fetcher(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({
        model: this.model,
        system: input.system,
        messages: input.messages,
        max_tokens: input.maxTokens,
        temperature: input.temperature ?? 0.2,
        metadata: input.metadata,
      }),
    });
    const body = (await readJson(response)) as AnthropicMessageResponse;

    if (!response.ok) {
      throw new AppError('upstream_error', 'Anthropic messages API failed', {
        cause: {
          status: response.status,
          body,
        },
        expose: false,
      });
    }

    const text = (body.content ?? [])
      .filter((item) => item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('\n')
      .trim();

    if (!text) {
      throw new AppError('upstream_error', 'Anthropic returned an empty response', {
        cause: body,
        expose: false,
      });
    }

    return {
      text,
      model: body.model ?? this.model,
      inputTokens: body.usage?.input_tokens ?? null,
      outputTokens: body.usage?.output_tokens ?? null,
      stopReason: body.stop_reason ?? null,
      raw: body,
    };
  }
}

export function createAnthropicClientForModel(model: string): AnthropicMessagesClient | null {
  if (!env.ANTHROPIC_API_KEY || !model) {
    return null;
  }

  return new AnthropicMessagesClient({
    model,
  });
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    // JSON.parse ritorna `any`; lo trattiamo come `unknown` per forzare
    // narrowing nei chiamanti (Zod parse o type guards).
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    return { raw: text };
  }
}
