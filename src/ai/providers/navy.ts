/**
 * NavyAI provider — OpenAI-compatible endpoint.
 * Free plan: 150K tokens/day, 20 RPM.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class NavyProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'navy',
      baseUrl: 'https://api.navy/v1',
      apiKeyEnv: 'NAVY_API_KEY',
      modelEnv: 'NAVY_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
      extraHeaders: {
        'User-Agent': 'Ashbound/1.0',
      },
    }, apiKey);
  }
}
