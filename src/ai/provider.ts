import { log } from "../logger";
import { config } from "../config/env";
const comp = "ai";
export interface AIProvider { generate(prompt: string): Promise<string>; generateStructured<T>(prompt: string, schema: Record<string, unknown>): Promise<T>; }
export class OpenAIProvider implements AIProvider {
  private baseUrl = "https://api.openai.com/v1";
  async generate(prompt: string): Promise<string> {
    log.info(comp, "ai_generate", "Calling AI");
    try {
      const response = await fetch(this.baseUrl + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.ai.apiKey}` },
        body: JSON.stringify({ model: config.ai.model, messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 1000 }),
      });
      if (!response.ok) throw new Error(`AI error: ${response.status}`);
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      log.error(comp, "ai_error", `AI failed: ${error}`);
      throw new Error(`AI_PROVIDER_ERROR: ${error}`);
    }
  }
  async generateStructured<T>(prompt: string, _schema: Record<string, unknown>): Promise<T> {
    const response = await this.generate(prompt);
    try { return JSON.parse(response) as T; } catch { return response as unknown as T; }
  }
}
export class AIProviderFactory {
  private static instance: OpenAIProvider | null = null;
  static getProvider(): AIProvider { if (!this.instance) this.instance = new OpenAIProvider(); return this.instance; }
}
export const aiProvider = AIProviderFactory.getProvider();
