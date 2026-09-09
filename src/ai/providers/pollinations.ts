/**
 * Pollinations — keyless, free, OpenAI-compatible endpoint.
 * No API key required. Uses community models.
 *
 * Custom validation endpoint: /account/key
 */
import OpenAI, { type ClientOptions } from 'openai';
import { normalizeBaseUrl } from './openai-compat.js';
import type { AIProvider, AICompletionOptions, AIResponse, AIStreamChunk } from '../types.js';

export class PollinationsProvider implements AIProvider {
  readonly name = 'pollinations';
  private client: OpenAI;
  private readonly defaultModel: string;

  constructor(apiKey?: string) {
    const baseUrl = 'https://gen.pollinations.ai/v1';
    const normalizedUrl = normalizeBaseUrl(baseUrl);

    const clientOpts: ClientOptions = {
      baseURL: normalizedUrl,
      apiKey: '', // keyless
    };

    this.client = new OpenAI(clientOpts);
    this.defaultModel = process.env['POLLINATIONS_MODEL'] ?? 'openai';
  }

  /** Validate using the /account/key endpoint. */
  async validateCredentials(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch('https://gen.pollinations.ai/account/key', {
          signal: controller.signal,
          headers: { 'User-Agent': 'Ashbound/1.0' },
        });
        return response.ok;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return false;
    }
  }

  private resolveModel(model?: string): string {
    return model ?? process.env['POLLINATIONS_MODEL'] ?? this.defaultModel;
  }

  async complete(opts: AICompletionOptions): Promise<AIResponse> {
    const model = this.resolveModel(opts.model);
    const messages = opts.messages.map((m) => ({ role: m.role, content: m.content }));

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages,
      max_tokens: opts.maxTokens || 1024,
      temperature: opts.temperature ?? 0.7,
      top_p: opts.topP ?? undefined,
      stop: opts.stop ?? undefined,
    };

    const c = await this.client.chat.completions.create(params);
    const choice = c.choices[0];
    return {
      content: choice.message.content ?? '',
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
      max_tokens: opts.maxTokens || 1024,
      temperature: opts.temperature ?? 0.7,
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
