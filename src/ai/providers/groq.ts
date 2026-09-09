/**
 * Groq provider — OpenAI-compatible endpoint.
 * Fast inference, free tier available.
 *
 * Includes inline tool-call recovery for malformed/failed tool call responses.
 */
import OpenAI, { type ClientOptions } from 'openai';
import { normalizeBaseUrl } from './openai-compat.js';
import type { AIProvider, AICompletionOptions, AIResponse, AIStreamChunk } from '../types.js';

/**
 * Attempt to recover inline tool calls from malformed response text.
 * Some Groq models embed tool-call-like JSON in the response text instead
 * of using proper tool_call objects. This extracts and normalizes them.
 */
export function recoverInlineToolCalls(content: string): { content: string; toolCalls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> } {
  if (!content) return { content };

  const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g;
  const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];
  let cleanedContent = content;

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.name && typeof parsed.name === 'string') {
        const args = parsed.arguments ?? parsed.parameters ?? {};
        toolCalls.push({
          id: `recovered_${toolCalls.length}`,
          type: 'function',
          function: {
            name: parsed.name,
            arguments: typeof args === 'string' ? args : JSON.stringify(args),
          },
        });
        cleanedContent = cleanedContent.replace(match[0], '');
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  const bareJsonRegex = /\{"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]*\})\s*\}/g;
  while ((match = bareJsonRegex.exec(cleanedContent)) !== null) {
    try {
      const name = match[1];
      const args = JSON.parse(match[2]);
      toolCalls.push({
        id: `recovered_${toolCalls.length}`,
        type: 'function',
        function: {
          name,
          arguments: JSON.stringify(args),
        },
      });
      cleanedContent = cleanedContent.replace(match[0], '');
    } catch {
      // Not valid, skip
    }
  }

  cleanedContent = cleanedContent.trim();
  return {
    content: cleanedContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

export class GroqProvider implements AIProvider {
  readonly name = 'groq';
  private client: OpenAI;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;
  private readonly defaultTemperature: number;

  constructor(apiKey?: string) {
    const resolvedKey = apiKey ?? process.env['GROQ_API_KEY'];
    if (!resolvedKey) {
      throw new Error('Groq requires GROQ_API_KEY to be configured.');
    }

    const baseUrl = 'https://api.groq.com/openai/v1';
    const normalizedUrl = normalizeBaseUrl(baseUrl);

    const clientOpts: ClientOptions = {
      baseURL: normalizedUrl,
      apiKey: resolvedKey,
    };

    const timeoutMs = process.env['GROQ_TIMEOUT_MS'];
    if (timeoutMs) {
      const parsed = parseInt(timeoutMs, 10);
      if (!isNaN(parsed) && parsed > 0) {
        clientOpts.timeout = parsed;
      }
    }

    this.client = new OpenAI(clientOpts);
    this.defaultModel = process.env['GROQ_MODEL'] ?? 'llama-3.1-8b-instant';
    this.defaultMaxTokens = 1024;
    this.defaultTemperature = 0.7;
  }

  private resolveModel(model?: string): string {
    return model ?? process.env['GROQ_MODEL'] ?? this.defaultModel;
  }

  async complete(opts: AICompletionOptions): Promise<AIResponse> {
    const model = this.resolveModel(opts.model);
    const messages = opts.messages.map((m) => ({ role: m.role, content: m.content }));

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages,
      max_tokens: opts.maxTokens || this.defaultMaxTokens,
      temperature: opts.temperature ?? this.defaultTemperature,
      top_p: opts.topP ?? undefined,
      stop: opts.stop ?? undefined,
    };

    const c = await this.client.chat.completions.create(params);
    const choice = c.choices[0];

    let content = choice.message.content ?? '';
    let toolCalls = choice.message.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      const recovered = recoverInlineToolCalls(content);
      if (recovered.toolCalls) {
        content = recovered.content;
        toolCalls = recovered.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }
    }

    return {
      content,
      meta: { model: c.model, provider: this.name, usage: c.usage, finishReason: choice.finish_reason },
      toolCalls: toolCalls && toolCalls.length > 0
        ? toolCalls.map((tc) => ({ id: tc.id, type: tc.type, function: tc.function }))
        : undefined,
    };
  }

  async stream(
    opts: AICompletionOptions,
    onChunk: (chunk: AIStreamChunk) => void,
    onDone?: (meta: Record<string, unknown>) => void,
  ): Promise<void> {
    const model = this.resolveModel(opts.model);
    const messages = opts.messages.map((m) => ({ role: m.role, content: m.content }));

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages,
      max_tokens: opts.maxTokens || this.defaultMaxTokens,
      temperature: opts.temperature ?? this.defaultTemperature,
      top_p: opts.topP ?? undefined,
      stop: opts.stop ?? undefined,
      stream: true,
    };

    const stream = await this.client.chat.completions.create(params);
    let fullMeta: Record<string, unknown> = {};
    let done = false;

    for await (const event of stream) {
      const delta = event.choices[0]?.delta?.content ?? '';
      if (delta) onChunk({ content: delta, done: false });
      if (event.choices[0]?.finish_reason) {
        done = true;
        fullMeta = { model: event.model, provider: this.name, finishReason: event.choices[0].finish_reason };
        onChunk({ content: '', done: true });
      }
    }

    if (!done) {
      onChunk({ content: '', done: true });
    }
    onDone?.(fullMeta);
  }
}
