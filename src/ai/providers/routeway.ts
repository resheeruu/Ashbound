/**
 * Routeway provider — OpenAI-compatible endpoint.
 * Free :free suffix models.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class RoutewayProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'routeway',
      baseUrl: 'https://api.routeway.ai/v1',
      apiKeyEnv: 'ROUTEWAY_API_KEY',
      modelEnv: 'ROUTEWAY_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
      extraHeaders: {
        'User-Agent': 'Mozilla/5.0 Ashbound/1.0',
      },
    }, apiKey);
  }
}
