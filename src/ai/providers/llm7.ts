/**
 * LLM7 provider — OpenAI-compatible endpoint.
 * 100 req/hr free tier.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class LLM7Provider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'llm7',
      baseUrl: 'https://api.llm7.io/v1',
      apiKeyEnv: 'LLM7_API_KEY',
      modelEnv: 'LLM7_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
