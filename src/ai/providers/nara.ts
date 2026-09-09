/**
 * NaraRouter provider — OpenAI-compatible endpoint.
 * Free plan via Telegram verification.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class NaraProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'nara',
      baseUrl: 'https://router.bynara.id/v1',
      apiKeyEnv: 'NARA_API_KEY',
      modelEnv: 'NARA_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
