/**
 * Requesty provider — OpenAI-compatible endpoint.
 * Free models/credits via catalog.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class RequestyProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'requesty',
      baseUrl: 'https://router.requesty.ai/v1',
      apiKeyEnv: 'REQUESTY_API_KEY',
      modelEnv: 'REQUESTY_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
