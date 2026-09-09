/**
 * Kilo Gateway provider — OpenAI-compatible, keyless endpoint.
 * Anonymous access for :free routes, 200 req/hr per IP.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class KiloProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'kilo',
      baseUrl: 'https://api.kilo.ai/api/gateway/v1',
      apiKeyEnv: 'KILO_API_KEY',
      modelEnv: 'KILO_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
      keyless: true,
    }, apiKey);
  }
}
