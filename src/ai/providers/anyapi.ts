/**
 * AnyAPI provider — OpenAI-compatible endpoint.
 * Free tier: 100K tokens/day.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class AnyAPIProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'anyapi',
      baseUrl: 'https://api.anyapi.ai/v1',
      apiKeyEnv: 'ANYAPI_API_KEY',
      modelEnv: 'ANYAPI_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
