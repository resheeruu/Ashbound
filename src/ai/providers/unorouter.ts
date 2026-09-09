/**
 * UnoRouter provider — OpenAI-compatible endpoint.
 * Free :free suffix models.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class UnoRouterProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'unorouter',
      baseUrl: 'https://api.unorouter.com/v1',
      apiKeyEnv: 'UNOROUTER_API_KEY',
      modelEnv: 'UNOROUTER_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
