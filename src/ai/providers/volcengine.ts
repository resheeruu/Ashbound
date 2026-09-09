/**
 * Volcengine Ark (火山方舟, ByteDance) provider — OpenAI-compatible endpoint.
 * Doubao models on recurring daily per-model free quota.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class VolcengineProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'volcengine',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      apiKeyEnv: 'VOLCENGINE_API_KEY',
      modelEnv: 'VOLCENGINE_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
