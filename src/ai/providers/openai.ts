import { log } from "../../logger";
import { config } from "../../config/env";
import { eventBus } from "../../events/bus";
import { ProviderHealth } from "../../events/types";
import { AIProvider, GenerateRequest, GenerateResponse, ModelInfo, ProviderHealthResult } from "../interfaces";

const comp = "ai/openai";

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly name = "OpenAI";
  private baseUrl = "https://api.openai.com/v1";

  async listModels(): Promise<ModelInfo[]> {
    log.info(comp, "list_models", "Fetching OpenAI models");
    try {
      const response = await fetch(this.baseUrl + "/models", { headers: { Authorization: `Bearer ${config.ai.apiKey}` } });
      if (!response.ok) throw new Error(`Failed to fetch models: ${response.status}`);
      const data = await response.json();
      const models: ModelInfo[] = (data.data || []).map((m: { id: string }) => ({
        id: m.id, name: m.id, providerId: this.id, supportsStructuredOutput: true, supportsTools: true, supportsStreaming: true, supportsVision: m.id.includes("gpt-4") || m.id.includes("claude"), free: false, role: m.id.includes("gpt-4o-mini") || m.id.includes("gpt-3.5") ? "conversation" : "conversation",
      }));
      log.info(comp, "models_listed", `Found ${models.length} models`);
      return models;
    } catch (e) { const error = e instanceof Error ? e.message : String(e); log.error(comp, "models_error", `Failed to list models: ${error}`); throw new Error(`MODEL_LIST_ERROR: ${error}`); }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startTime = Date.now();
    log.info(comp, "generate_start", `Generating with model ${request.model}`);
    try {
      const body: Record<string, unknown> = { model: request.model, messages: request.messages, max_tokens: request.maxTokens ?? 1000, temperature: request.temperature ?? 0.7, stream: request.stream ?? false };
      if (request.tools && request.tools.length > 0) { body.tools = request.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.schema } })); }
      const response = await fetch(this.baseUrl + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.ai.apiKey}` }, body: JSON.stringify(body) });
      if (!response.ok) { const errorBody = await response.json().catch(() => ({})); throw new Error(`OpenAI API error: ${response.status} - ${errorBody.error?.message || "Unknown error"}`); }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const usage = data.usage ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens } : undefined;
      const duration = Date.now() - startTime;
      await eventBus.emit("AIRequestCompleted", { providerId: this.id, model: request.model, duration, tokensUsed: usage?.totalTokens ?? 0 });
      log.info(comp, "generate_complete", `Generated in ${duration}ms`);
      return { content, usage, model: request.model, providerId: this.id };
    } catch (e) { const error = e instanceof Error ? e.message : String(e); const duration = Date.now() - startTime; await eventBus.emit("AIRequestFailed", { providerId: this.id, error }); log.error(comp, "generate_error", `Generation failed after ${duration}ms: ${error}`); throw new Error(`OPENAI_GENERATE_ERROR: ${error}`); }
  }

  async generateStructured<T>(request: GenerateRequest): Promise<T> { const response = await this.generate(request); try { return JSON.parse(response.content) as T; } catch { return response.content as unknown as T; } }

  async healthCheck(): Promise<ProviderHealthResult> {
    const startTime = Date.now();
    try { const response = await fetch(this.baseUrl + "/models", { method: "HEAD", headers: { Authorization: `Bearer ${config.ai.apiKey}` } }); const latencyMs = Date.now() - startTime; const healthy = response.ok; const status = healthy ? ProviderHealth.HEALTHY : ProviderHealth.DEGRADED; await eventBus.emit("AIProviderHealthChanged", { providerId: this.id, health: status }); return { healthy, latencyMs, status, message: healthy ? "Provider is healthy" : "Provider returned non-OK status", timestamp: Date.now() }; } catch (e) { const latencyMs = Date.now() - startTime; const error = e instanceof Error ? e.message : String(e); await eventBus.emit("AIProviderHealthChanged", { providerId: this.id, health: ProviderHealth.TIMEOUT }); return { healthy: false, latencyMs, status: ProviderHealth.TIMEOUT, message: error, timestamp: Date.now() }; }
  }
}
