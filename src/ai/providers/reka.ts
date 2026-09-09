/**
 * Reka provider — OpenAI-compatible endpoint.
 * Free monthly credit grant.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class RekaProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'reka',
      baseUrl: 'https://api.reka.ai/v1',
      apiKeyEnv: 'REKA_API_KEY',
      modelEnv: 'REKA_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
