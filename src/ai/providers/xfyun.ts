/**
 * iFlytek Spark (讯飞星火) provider — OpenAI-compatible endpoint.
 * Lite model is free.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class XFyunProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'xfyun',
      baseUrl: 'https://spark-api-open.xf-yun.com/v1',
      apiKeyEnv: 'XFYUN_API_KEY',
      modelEnv: 'XFYUN_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
