/**
 * Agnes AI provider — OpenAI-compatible endpoint.
 * Proprietary models at $0/token (promotional).
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class AgnesProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'agnes',
      baseUrl: 'https://apihub.agnes-ai.com/v1',
      apiKeyEnv: 'AGNES_API_KEY',
      modelEnv: 'AGNES_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
