/**
 * xKiro provider — OpenAI-compatible endpoint.
 * Free plan: 5M tokens/day.
 *
 * Uses /v1/usage for credential validation (not /v1/models).
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class XKiroProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'xkiro',
      baseUrl: 'https://api.xkiro.com/v1',
      apiKeyEnv: 'XKIRO_API_KEY',
      modelEnv: 'XKIRO_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
      validateUrl: '/v1/usage',
    }, apiKey);
  }
}
