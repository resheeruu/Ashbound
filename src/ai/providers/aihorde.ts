/**
 * AI Horde provider — OpenAI-compatible proxy with divergences.
 * Keyless: anonymous key 0000000000 for lowest priority.
 * No upstream streaming — emits fake SSE for client compatibility.
 * No tool calling support — tools/tool_choice are dropped.
 */
import OpenAI from 'openai';
import type { AIProvider, AICompletionOptions, AIResponse, AIStreamChunk } from '../types.js';

export class AIHordeProvider implements AIProvider {
  readonly name = 'aihorde';
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.AI_HORDE_API_KEY || '0000000000';
    this.client = new OpenAI({
      baseURL: 'https://oai.aihorde.net/v1',
      apiKey: key,
      timeout: 120_000,
    });
  }

  async complete(opts: AICompletionOptions): Promise<AIResponse> {
    const model = opts.model || process.env.AI_HORDE_MODEL || 'auto';
    const messages = opts.messages.map((m) => ({ role: m.role, content: m.content }));

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages,
      max_tokens: Math.max(opts.maxTokens || 1024, 16),
      temperature: opts.temperature ?? 0.7,
    };

    // AI Horde does not support tool calling — drop tools
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
    // AI Horde has no streaming — use blocking call and emit fake SSE
    const result = await this.complete(opts);
    const content = result.content;

    // Emit content as a single chunk
    if (content) {
      onChunk({ content, done: false });
    }
    onChunk({ content: '', done: true });
    onDone?.({ model: result.meta.model, provider: this.name, finishReason: result.meta.finishReason });
  }
}
