/**
 * AINative Studio provider — OpenAI-compatible endpoint.
 * ~10M tokens/month free.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class AINativeProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'ainative',
      baseUrl: 'https://api.ainative.studio/api/v1',
      apiKeyEnv: 'AINATIVE_API_KEY',
      modelEnv: 'AINATIVE_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
