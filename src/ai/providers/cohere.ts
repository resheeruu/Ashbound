/**
 * Cohere adapter (OpenAI-compatible endpoint).
 * Includes schema sanitization to remove unsupported fields (additionalProperties, $schema)
 * from tool definitions before sending requests.
 */
import OpenAI from 'openai';
import type { AICompletionOptions, AIResponse, AIStreamChunk } from '../types.js';
import { OpenAICompatProvider, type OpenAICompatOptions } from './openai-compat.js';

/** Remove unsupported schema fields for Cohere's tool calling API. */
export function sanitizeSchemaForCohere(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return schema;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'additionalProperties' || key === '$schema') continue;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeSchemaForCohere(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        item && typeof item === 'object' ? sanitizeSchemaForCohere(item as Record<string, unknown>) : item,
      );
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/** Sanitize tool definitions for Cohere compatibility. */
export function sanitizeToolsForCohere(tools: AICompletionOptions['tools']): AICompletionOptions['tools'] {
  if (!tools || tools.length === 0) return tools;
  return tools.map((tool) => ({
    ...tool,
    function: {
      ...tool.function,
      parameters: sanitizeSchemaForCohere(tool.function.parameters),
    },
  }));
}

export class CohereProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'cohere',
      baseUrl: 'https://api.cohere.com/compatibility/v1',
      apiKeyEnv: 'COHERE_API_KEY',
      modelEnv: 'COHERE_MODEL',
      defaultModel: 'command-a-03-2025',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }

  async complete(opts: AICompletionOptions): Promise<AIResponse> {
    const sanitized = { ...opts, tools: sanitizeToolsForCohere(opts.tools) };
    return super.complete(sanitized);
  }

  async stream(
    opts: AICompletionOptions,
    onChunk: (chunk: AIStreamChunk) => void,
    onDone?: (meta: Record<string, unknown>) => void,
  ): Promise<void> {
    const sanitized = { ...opts, tools: sanitizeToolsForCohere(opts.tools) };
    return super.stream(sanitized, onChunk, onDone);
  }
}
