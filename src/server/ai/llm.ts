export type LlmMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type LlmCompletionInput = {
  system: string;
  messages: LlmMessage[];
  maxTokens: number;
  temperature?: number;
  metadata?: Record<string, string>;
};

export type LlmCompletionResult = {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string | null;
  raw: unknown;
};

export interface LlmClient {
  complete(input: LlmCompletionInput): Promise<LlmCompletionResult>;
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    // JSON.parse ritorna `any`; la firma di extractJsonObject è `unknown`,
    // quindi i chiamanti devono fare narrowing prima di leggere campi.
    const parsed: unknown = JSON.parse(trimmed);
    return parsed;
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('LLM response did not contain a JSON object');
  }

  const parsed: unknown = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  return parsed;
}
