import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';

export type EmbeddingInput = {
  text: string;
  metadata?: Record<string, string>;
};

export interface EmbeddingClient {
  embed(input: EmbeddingInput): Promise<number[]>;
}

type OpenAIEmbeddingResponse = {
  data?: Array<{
    embedding?: unknown;
  }>;
  error?: {
    message?: string;
  };
};

export class OpenAIEmbeddingClient implements EmbeddingClient {
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      dimensions?: number;
      apiBaseUrl?: string;
      fetcher?: typeof fetch;
    },
  ) {}

  async embed(input: EmbeddingInput): Promise<number[]> {
    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(
      `${this.options.apiBaseUrl ?? 'https://api.openai.com/v1'}/embeddings`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model,
          input: input.text,
          dimensions: this.options.dimensions ?? 1536,
          encoding_format: 'float',
          user: input.metadata?.tenantId,
        }),
      },
    );
    const body = (await readJson(response)) as OpenAIEmbeddingResponse;

    if (!response.ok) {
      throw new AppError(
        'upstream_error',
        body.error?.message ?? 'OpenAI embedding request failed',
        {
          cause: {
            status: response.status,
            body,
          },
          expose: false,
        },
      );
    }

    const embedding = body.data?.[0]?.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new AppError(
        'upstream_error',
        'OpenAI embedding response did not include an embedding',
        { cause: body, expose: false },
      );
    }

    return embedding.map((value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new AppError('upstream_error', 'OpenAI embedding contained NaN', {
          cause: body,
          expose: false,
        });
      }

      return value;
    });
  }
}

export function createEmbeddingClient(): EmbeddingClient | null {
  if (!env.OPENAI_API_KEY || !env.OPENAI_EMBEDDING_MODEL) {
    return null;
  }

  return new OpenAIEmbeddingClient({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_EMBEDDING_MODEL,
    dimensions: 1536,
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
