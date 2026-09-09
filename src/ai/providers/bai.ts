/**
 * B.AI provider — OpenAI-compatible endpoint.
 * Promo $0/credit tier available.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class BAIProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'bai',
      baseUrl: 'https://api.b.ai/v1',
      apiKeyEnv: 'BAI_API_KEY',
      modelEnv: 'BAI_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
