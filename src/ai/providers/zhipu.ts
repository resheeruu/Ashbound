/**
 * Zhipu (Z.ai/GLM) provider — OpenAI-compatible endpoint.
 * Free tier: GLM-4-Flash available free.
 *
 * Supports dual-console autodetection:
 *   - bigmodel.cn (legacy/console endpoint)
 *   - z.ai (newer Z.AI endpoint)
 *
 * Endpoint selection is based on the credential/configuration.
 * Both use the same OpenAI-compatible API format.
 */
import { OpenAICompatProvider, normalizeBaseUrl } from './openai-compat.js';
import type { AICompletionOptions, AIResponse, AIStreamChunk } from '../types.js';
import OpenAI, { type ClientOptions } from 'openai';

const ZHIPU_CONSOLE_URL = 'https://open.bigmodel.cn/api/paas/v4';
const ZHIPU_ZAI_URL = 'https://open.z.ai/api/paas/v4';

export class ZhipuProvider extends OpenAICompatProvider {
  private readonly selectedBaseUrl: string;

  constructor(apiKey?: string) {
    const resolvedKey = apiKey ?? process.env['ZHIPU_API_KEY'];

    // Dual-console autodetection: check credential prefix or env hint
    const consoleHint = process.env['ZHIPU_CONSOLE'];
    let selectedUrl = ZHIPU_CONSOLE_URL;

    if (consoleHint) {
      const hint = consoleHint.toLowerCase();
      if (hint === 'zai' || hint === 'z.ai' || hint === 'z') {
        selectedUrl = ZHIPU_ZAI_URL;
      } else if (hint === 'console' || hint === 'bigmodel') {
        selectedUrl = ZHIPU_CONSOLE_URL;
      }
    } else if (resolvedKey && resolvedKey.startsWith('zai-')) {
      selectedUrl = ZHIPU_ZAI_URL;
    }

    super({
      name: 'zhipu',
      baseUrl: selectedUrl,
      apiKeyEnv: 'ZHIPU_API_KEY',
      modelEnv: 'ZHIPU_MODEL',
      defaultModel: 'glm-4-flash',
      defaultMaxTokens: 1024,
      defaultTemperature: 0.7,
    }, apiKey);

    this.selectedBaseUrl = selectedUrl;
  }

  /** Expose the resolved base URL for validation. */
  getResolvedBaseUrl(): string {
    return normalizeBaseUrl(this.selectedBaseUrl);
  }
}
