/**
 * Cloudflare Workers AI provider — OpenAI-compatible endpoint.
 * Free tier: 10,000 neurons/day.
 *
 * Supports the "account_id:api_token" credential format.
 * Dynamically constructs the Cloudflare Workers AI endpoint using the account ID.
 * Credentials are never logged.
 */
import OpenAI, { type ClientOptions } from 'openai';
import { normalizeBaseUrl } from './openai-compat.js';
import type { AIProvider, AICompletionOptions, AIResponse, AIStreamChunk } from '../types.js';

export class CloudflareProvider implements AIProvider {
  readonly name = 'cloudflare';
  private client: OpenAI;
  private readonly accountToken: string;
  private readonly defaultModel: string;

  constructor(apiKey?: string) {
    const resolvedKey = apiKey ?? process.env['CLOUDFLARE_API_TOKEN'];

    if (!resolvedKey) {
      throw new Error('Cloudflare requires CLOUDFLARE_API_TOKEN to be configured.');
    }

    // Parse "account_id:api_token" format
    let accountId: string;
    let apiToken: string;

    if (resolvedKey.includes(':')) {
      const colonIdx = resolvedKey.indexOf(':');
      accountId = resolvedKey.substring(0, colonIdx);
      apiToken = resolvedKey.substring(colonIdx + 1);
    } else {
      // Fallback: treat entire value as API token, account ID from env
      accountId = process.env['CLOUDFLARE_ACCOUNT_ID'] ?? '';
      apiToken = resolvedKey;
    }

    this.accountToken = resolvedKey;

    // Build endpoint dynamically: /accounts/{account_id}/ai
    const baseUrl = accountId
      ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai`
      : 'https://api.cloudflare.com/client/v4/accounts';

    const normalizedUrl = normalizeBaseUrl(baseUrl);

    const clientOpts: ClientOptions = {
      baseURL: normalizedUrl,
      apiKey: apiToken,
    };

    const timeoutMs = process.env['CLOUDFLARE_TIMEOUT_MS'];
    if (timeoutMs) {
      const parsed = parseInt(timeoutMs, 10);
      if (!isNaN(parsed) && parsed > 0) {
        clientOpts.timeout = parsed;
      }
    }

    this.client = new OpenAI(clientOpts);
    this.defaultModel = process.env['CLOUDFLARE_MODEL'] ?? '@cf/meta/llama-3.1-8b-instruct';
  }

  private resolveModel(model?: string): string {
    return model ?? process.env['CLOUDFLARE_MODEL'] ?? this.defaultModel;
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
