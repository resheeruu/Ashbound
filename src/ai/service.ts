/** Shared AI facade. Every conversational entry point uses this service. */
import type { AICompletionOptions, AIResponse, AIStreamChunk, AIMessage, ToolDefinition } from './types.js';
import { router } from './router.js';

class AIService {
  async chat(messages: AIMessage[], opts?: Partial<AICompletionOptions>): Promise<AIResponse> {
    return router.chat({ messages, ...opts, stream: false });
  }

  async stream(
    messages: AIMessage[],
    onChunk: (chunk: AIStreamChunk) => void,
    opts?: Partial<AICompletionOptions>,
  ): Promise<void> {
    await router.stream({ messages, ...opts, stream: true }, onChunk);
  }

  async say(prompt: string, system?: string, opts?: Partial<AICompletionOptions>): Promise<string> {
    const messages: AIMessage[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    return (await this.chat(messages, opts)).content;
  }

  /**
   * Chat with tool calling support.
   * Returns the response and any tool calls the model wants to make.
   */
  async chatWithTools(
    messages: AIMessage[],
    tools: ToolDefinition[],
    opts?: Partial<AICompletionOptions>,
  ): Promise<AIResponse> {
    return router.chat({ messages, tools, ...opts, stream: false });
  }
}

export const ai = new AIService();
export { router } from './router.js';
