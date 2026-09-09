/**
 * Baidu Qianfan (百度千帆) provider — OpenAI-compatible endpoint.
 * ERNIE-Speed/Lite/Tiny free via pay-as-you-go billing.
 */
import { OpenAICompatProvider } from './openai-compat.js';

export class QianfanProvider extends OpenAICompatProvider {
  constructor(apiKey?: string) {
    super({
      name: 'qianfan',
      baseUrl: 'https://qianfan.baidubce.com/v2',
      apiKeyEnv: 'QIANFAN_API_KEY',
      modelEnv: 'QIANFAN_MODEL',
      defaultModel: 'auto',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);
  }
}
