import { describe, expect, it } from 'vitest';

import { extractJsonObject } from '@/server/ai/llm';

describe('extractJsonObject', () => {
  it('parses a clean JSON object that is the entire input', () => {
    // Arrange
    const input = '{"intent":"booking","confidence":0.92}';

    // Act
    const result = extractJsonObject(input);

    // Assert
    expect(result).toEqual({ intent: 'booking', confidence: 0.92 });
  });

  it('strips surrounding whitespace before parsing a clean JSON object', () => {
    // Arrange — typical "padded" LLM output
    const input = '   \n\t{"a":1,"b":[1,2,3]}\n  ';

    // Act
    const result = extractJsonObject(input);

    // Assert
    expect(result).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it('extracts a JSON object embedded between prose text', () => {
    // Arrange — LLM frequently wraps output in explanation text
    const input = 'Sure, here is the JSON you requested:\n{"name":"Mario","ok":true}\nLet me know!';

    // Act
    const result = extractJsonObject(input);

    // Assert
    expect(result).toEqual({ name: 'Mario', ok: true });
  });

  it('extracts a JSON object inside a fenced markdown block', () => {
    // Arrange — Claude/Anthropic style
    const input = 'Result:\n```json\n{"slot":"morning"}\n```\nDone.';

    // Act
    const result = extractJsonObject(input);

    // Assert
    expect(result).toEqual({ slot: 'morning' });
  });

  it('handles nested objects and arrays', () => {
    // Arrange
    const input =
      'Output:\n{"booking":{"date":"2026-05-01","slots":["09:00","10:00"]},"status":"ok"}';

    // Act
    const result = extractJsonObject(input);

    // Assert
    expect(result).toEqual({
      booking: { date: '2026-05-01', slots: ['09:00', '10:00'] },
      status: 'ok',
    });
  });

  it('throws when the input contains no JSON object at all', () => {
    // Arrange
    const input = 'I am sorry, I cannot answer right now.';

    // Act + Assert
    expect(() => extractJsonObject(input)).toThrowError(
      'LLM response did not contain a JSON object',
    );
  });

  it('throws when input is empty or whitespace only', () => {
    // Act + Assert
    expect(() => extractJsonObject('')).toThrowError('LLM response did not contain a JSON object');
    expect(() => extractJsonObject('   \n\n   ')).toThrowError(
      'LLM response did not contain a JSON object',
    );
  });

  it('throws SyntaxError when the embedded JSON is malformed', () => {
    // Arrange — looks like JSON but has a trailing comma / unbalanced quote
    const input = 'Here: {"intent":"booking",}';

    // Act + Assert — JSON.parse throws SyntaxError, which is propagated
    expect(() => extractJsonObject(input)).toThrowError(SyntaxError);
  });

  it('throws when only an opening or closing brace is present', () => {
    // Arrange — only `{` with no `}` (lastBrace === -1)
    expect(() => extractJsonObject('partial {')).toThrowError(
      'LLM response did not contain a JSON object',
    );
    // Only `}` with no `{` (firstBrace === -1)
    expect(() => extractJsonObject('partial }')).toThrowError(
      'LLM response did not contain a JSON object',
    );
  });
});
