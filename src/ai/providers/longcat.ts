/**
 * LongCat (Meituan / 美团) provider — OpenAI-compatible endpoint.
 * Daily free quota.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class LongCatProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'longcat',
      baseUrl: 'https://api.longcat.chat/openai/v1',
      apiKeyEnv: 'LONGCAT_API_KEY',
      modelEnv: 'LONGCAT_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
