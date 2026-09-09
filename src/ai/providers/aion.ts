/**
 * Aion Labs provider — OpenAI-compatible endpoint.
 * Recurring free availability.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class AionProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'aion',
      baseUrl: 'https://api.aionlabs.ai/v1',
      apiKeyEnv: 'AION_API_KEY',
      modelEnv: 'AION_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
