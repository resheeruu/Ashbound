/**
 * OVHcloud AI Endpoints provider — OpenAI-compatible, keyless endpoint.
 * Anonymous: 2 req/min per IP per model.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class OVHProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'ovh',
      baseUrl: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
      apiKeyEnv: 'OVH_API_KEY',
      modelEnv: 'OVH_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
      keyless: true,
    }, apiKey);
  }
}
