/**
 * BazaarLink provider — OpenAI-compatible endpoint.
 * Free auto:free route.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class BazaarLinkProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'bazaarlink',
      baseUrl: 'https://bazaarlink.ai/api/v1',
      apiKeyEnv: 'BAZAARLINK_API_KEY',
      modelEnv: 'BAZAARLINK_MODEL',
      defaultModel: 'auto:free',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
