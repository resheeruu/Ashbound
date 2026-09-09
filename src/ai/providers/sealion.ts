/**
 * SEA-LION provider — OpenAI-compatible endpoint.
 * Free tier at 10 RPM.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class SeaLionProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'sealion',
      baseUrl: 'https://api.sea-lion.ai/v1',
      apiKeyEnv: 'SEALION_API_KEY',
      modelEnv: 'SEALION_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
