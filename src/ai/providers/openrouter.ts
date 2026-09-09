/**
 * OpenRouter provider — OpenAI-compatible gateway to hundreds of models.
 * Includes FreeLLMAPI-compatible HTTP-Referer and X-Title headers.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class OpenRouterProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      modelEnv: 'OPENROUTER_MODEL',
      defaultModel: 'meta-llama/llama-3.1-8b-instruct:free',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.8,
      extraHeaders: {
        'HTTP-Referer': 'https://github.com/Ashbound/Ashbound',
        'X-Title': 'Ashbound',
      },
    }, apiKey);
  }
}
