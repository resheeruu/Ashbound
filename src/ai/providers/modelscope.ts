/**
 * ModelScope (Alibaba) provider — OpenAI-compatible endpoint.
 * 2000 requests/day, requires Alibaba Cloud CN-site binding.
 *
 * Custom validation: performs a one-token chat probe rather than
 * treating a generic /v1/models response as proof of credentials.
 */
import OpenAI, { type ClientOptions } from 'openai';
import { normalizeBaseUrl } from './openai-compat.js';
import type { AIProvider, AICompletionOptions, AIResponse, AIStreamChunk } from '../types.js';

export class ModelScopeProvider implements AIProvider {
  readonly name = 'modelscope';
  private client: OpenAI;
  private readonly timeoutMs: number;

  constructor(apiKey?: string) {
    const resolvedKey = apiKey ?? process.env['MODELSCOPE_API_KEY'];
    if (!resolvedKey) {
      throw new Error('ModelScope requires MODELSCOPE_API_KEY to be configured.');
    }

    const baseUrl = 'https://api-inference.modelscope.cn/v1';
    const normalizedUrl = normalizeBaseUrl(baseUrl);

    const clientOpts: ClientOptions = {
      baseURL: normalizedUrl,
      apiKey: resolvedKey,
      defaultHeaders: {
        'X-ModelScope-Async': 'true',
      },
    };

    this.timeoutMs = 90_000;
    clientOpts.timeout = this.timeoutMs;

    this.client = new OpenAI(clientOpts);
  }

  /** One-token chat probe to validate credentials. */
  async validateCredentials(): Promise<boolean> {
    try {
      const model = process.env['MODELSCOPE_MODEL'] ?? 'auto';
      const c = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      });
      return c.choices && c.choices.length > 0;
    } catch {
      return false;
    }
  }

  private resolveModel(model?: string): string {
    return model ?? process.env['MODELSCOPE_MODEL'] ?? 'auto';
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
