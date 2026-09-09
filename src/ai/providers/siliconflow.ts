/**
 * SiliconFlow provider — OpenAI-compatible endpoint.
 * Free generative media models.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class SiliconFlowProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'siliconflow',
      baseUrl: 'https://api.siliconflow.com/v1',
      apiKeyEnv: 'SILICONFLOW_API_KEY',
      modelEnv: 'SILICONFLOW_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
