/**
 * OrcaRouter provider — OpenAI-compatible endpoint.
 * Free *-free routes and orcarouter/free auto route.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class OrcaRouterProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'orcarouter',
      baseUrl: 'https://api.orcarouter.ai/v1',
      apiKeyEnv: 'ORCAROUTER_API_KEY',
      modelEnv: 'ORCAROUTER_MODEL',
      defaultModel: 'orcarouter/free',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
