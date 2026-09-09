/**
 * Ollama Cloud provider — OpenAI-compatible endpoint.
 * Free plan: 1 concurrent model, 5h session caps.
 *
 * Includes reasoning_content normalization to ensure valid reasoning
 * responses do not become empty assistant output.
 */
import OpenAI, { type ClientOptions } from 'openai';
import { normalizeBaseUrl } from './openai-compat.js';
import type { AIProvider, AICompletionOptions, AIResponse, AIStreamChunk } from '../types.js';

/**
 * Normalize reasoning output from Ollama Cloud responses.
 * Some models return reasoning in a `reasoning_content` field.
 * If the main content is empty but reasoning_content exists,
 * combine them to avoid empty assistant output.
 */
export function normalizeReasoningContent(
  content: string,
  rawMeta?: Record<string, unknown>,
): string {
  if (content && content.trim().length > 0) return content;

  const reasoning = rawMeta?.['reasoning_content'];
  if (typeof reasoning === 'string' && reasoning.trim().length > 0) {
    return reasoning;
  }

  return content;
}

export class OllamaCloudProvider implements AIProvider {
  readonly name = 'ollamacloud';
  private client: OpenAI;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;
  private readonly defaultTemperature: number;

  constructor(apiKey?: string) {
    const resolvedKey = apiKey ?? process.env['OLLAMACLOUD_API_KEY'];
    if (!resolvedKey) {
      throw new Error('Ollama Cloud requires OLLAMACLOUD_API_KEY to be configured.');
    }

    const baseUrl = 'https://ollama.com/v1';
    const normalizedUrl = normalizeBaseUrl(baseUrl);

    const clientOpts: ClientOptions = {
      baseURL: normalizedUrl,
      apiKey: resolvedKey,
      timeout: 120_000,
    };

    this.client = new OpenAI(clientOpts);
    this.defaultModel = process.env['OLLAMACLOUD_MODEL'] ?? 'auto';
    this.defaultMaxTokens = 1024;
    this.defaultTemperature = 0.7;
  }

  private resolveModel(model?: string): string {
    return model ?? process.env['OLLAMACLOUD_MODEL'] ?? this.defaultModel;
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

    const rawContent = choice.message.content ?? '';
    const rawMeta = c as unknown as Record<string, unknown>;
    const content = normalizeReasoningContent(rawContent, rawMeta);

    return {
      content,
      meta: { model: c.model, provider: this.name, usage: c.usage, finishReason: choice.finish_reason },
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
