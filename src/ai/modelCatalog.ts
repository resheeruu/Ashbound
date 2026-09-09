/**
 * Model Catalog — static registry of provider/model capabilities.
 *
 * The router uses this to select providers based on requirements
 * (vision, streaming, tools, cost, etc.) without requiring runtime
 * model discovery. Safe local defaults; no external dependency.
 *
 * Enhanced with:
 *   - Model aliases/groups
 *   - Endpoint scope support
 *   - Dynamic availability tracking
 *   - Free-tier limits from FreeLLMAPI catalog
 */

import type { ModelEntry, ModelAvailability } from './types.js';

export const MODEL_CATALOG: ModelEntry[] = [
  // ─── Free Tier Providers (priority 1–50) ───────────────────────────────────
  // Groq — free tier, fast inference, OpenAI-compatible
  { provider: 'groq', modelId: 'llama-3.1-8b-instant', displayName: 'Llama 3.1 8B (Groq)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 1, aliases: ['llama-3.1-8b', 'llama-3.1'] },
  { provider: 'groq', modelId: 'gemma2-9b-it', displayName: 'Gemma 2 9B (Groq)', contextLength: 8192, supportsStreaming: true, supportsTools: false, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 2 },
  { provider: 'groq', modelId: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B (Groq)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 3 },
  { provider: 'groq', modelId: 'deepseek-r1-distill-llama-70b', displayName: 'DeepSeek R1 70B (Groq)', contextLength: 131072, supportsStreaming: true, supportsTools: false, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 4 },
  // Cerebras — free tier, fast inference
  { provider: 'cerebras', modelId: 'llama-3.3-70b', displayName: 'Llama 3.3 70B (Cerebras)', contextLength: 8192, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 5 },
  { provider: 'cerebras', modelId: 'llama-3.1-8b', displayName: 'Llama 3.1 8B (Cerebras)', contextLength: 8192, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 6 },
  // Pollinations — keyless, free shared capacity
  { provider: 'pollinations', modelId: 'openai', displayName: 'Pollinations Auto', contextLength: 32768, supportsStreaming: true, supportsTools: false, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 7 },
  // Gemini — free tier (Google AI Studio key)
  { provider: 'gemini', modelId: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', contextLength: 1048576, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: true, costPer1k: 0, freeTier: true, priority: 8, aliases: ['gemini-flash'] },
  { provider: 'gemini', modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', contextLength: 1048576, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: true, costPer1k: 0, freeTier: true, priority: 9 },
  { provider: 'gemini', modelId: 'gemini-2.0-flash-lite', displayName: 'Gemini 2.0 Flash Lite', contextLength: 1048576, supportsStreaming: true, supportsTools: false, supportsVision: true, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 10 },
  // NVIDIA NIM — free tier, tool calling (single)
  { provider: 'nvidia', modelId: 'nvidia/llama-3.1-nemotron-70b-instruct', displayName: 'Nemotron 70B (NVIDIA)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 11 },
  { provider: 'nvidia', modelId: 'nvidia/llama-3.3-70b-instruct', displayName: 'Llama 3.3 70B (NVIDIA)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 12 },
  { provider: 'nvidia', modelId: 'nvidia/deepseek-r1', displayName: 'DeepSeek R1 (NVIDIA)', contextLength: 131072, supportsStreaming: true, supportsTools: false, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 13 },
  // GitHub Models — free tier
  { provider: 'github', modelId: 'gpt-4o-mini', displayName: 'GPT-4o Mini (GitHub)', contextLength: 128000, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 14 },
  { provider: 'github', modelId: 'openai/gpt-4.1', displayName: 'GPT-4.1 (GitHub)', contextLength: 128000, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 15 },
  // HuggingFace — free tier
  { provider: 'huggingface', modelId: 'meta-llama/Llama-3.1-8B-Instruct', displayName: 'Llama 3.1 8B (HF)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 16 },
  // OpenRouter — free models available
  { provider: 'openrouter', modelId: 'meta-llama/llama-3.1-8b-instruct:free', displayName: 'Llama 3.1 8B (OR Free)', contextLength: 131072, supportsStreaming: true, supportsTools: false, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 17 },
  { provider: 'openrouter', modelId: 'qwen/qwen3-coder:free', displayName: 'Qwen3 Coder (OR Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 18 },
  // Cloudflare Workers AI — free tier
  { provider: 'cloudflare', modelId: '@cf/meta/llama-3.1-8b-instruct', displayName: 'Llama 3.1 8B (CF)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 19 },
  { provider: 'cloudflare', modelId: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', displayName: 'DeepSeek R1 32B (CF)', contextLength: 32768, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 20 },
  // Zhipu — free tier
  { provider: 'zhipu', modelId: 'glm-4-flash', displayName: 'GLM-4 Flash (Zhipu)', contextLength: 128000, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 21 },
  { provider: 'zhipu', modelId: 'glm-4.7-flash', displayName: 'GLM-4.7 Flash (Zhipu)', contextLength: 128000, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 22 },
  // Ollama (local) — always free
  { provider: 'ollama', modelId: 'llama3.1', displayName: 'Llama 3.1 (Ollama Local)', contextLength: 131072, supportsStreaming: true, supportsTools: false, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 23 },
  // Kilo Gateway — keyless, free, 200 req/hr
  { provider: 'kilo', modelId: 'auto', displayName: 'Kilo Gateway (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 24 },
  // OVH AI Endpoints — keyless, free, 2 req/min per IP
  { provider: 'ovh', modelId: 'auto', displayName: 'OVH AI Endpoints (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 25 },
  // AI Horde — keyless, volunteer-powered
  { provider: 'aihorde', modelId: 'auto', displayName: 'AI Horde (Free)', contextLength: 32768, supportsStreaming: true, supportsTools: false, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 26 },
  // B.AI — limited free promo
  { provider: 'bai', modelId: 'auto', displayName: 'B.AI (Promo)', contextLength: 32768, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 27 },
  // AnyAPI — free, 100K tokens/day
  { provider: 'anyapi', modelId: 'meta-llama/llama-3.3-70b-instruct:free', displayName: 'Llama 3.3 70B (AnyAPI Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 28 },
  { provider: 'anyapi', modelId: 'qwen/qwen3-coder:free', displayName: 'Qwen3 Coder (AnyAPI Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 29 },
  { provider: 'anyapi', modelId: 'auto', displayName: 'AnyAPI Auto (Free)', contextLength: 32768, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 30 },
  // Ollama Cloud — free tier
  { provider: 'ollamacloud', modelId: 'auto', displayName: 'Ollama Cloud (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 31 },
  // LLM7 — free, 100 req/hr
  { provider: 'llm7', modelId: 'auto', displayName: 'LLM7 (Free)', contextLength: 32768, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 32 },
  // Agnes AI — promotional $0
  { provider: 'agnes', modelId: 'agnes-2.0-flash', displayName: 'Agnes 2.0 Flash', contextLength: 32768, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 33 },
  { provider: 'agnes', modelId: 'auto', displayName: 'Agnes Auto (Free)', contextLength: 32768, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 34 },
  // Reka — free monthly credits
  { provider: 'reka', modelId: 'reka-flash-3', displayName: 'Reka Flash 3', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 35 },
  { provider: 'reka', modelId: 'reka-edge-2603', displayName: 'Reka Edge 2603 (Multimodal)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 36 },
  // SiliconFlow — free image/TTS models
  { provider: 'siliconflow', modelId: 'auto', displayName: 'SiliconFlow (Free)', contextLength: 32768, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 37 },
  // Routeway — free :free suffix models
  { provider: 'routeway', modelId: 'auto', displayName: 'Routeway (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 38 },
  // BazaarLink — auto:free route
  { provider: 'bazaarlink', modelId: 'auto:free', displayName: 'BazaarLink (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 39 },
  // AINative Studio — ~10M tokens/month
  { provider: 'ainative', modelId: 'auto', displayName: 'AINative Studio (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 40 },
  // Aion Labs — free no-card key
  { provider: 'aion', modelId: 'auto', displayName: 'Aion Labs (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 41 },
  // Requesty — free models/credits
  { provider: 'requesty', modelId: 'auto', displayName: 'Requesty (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 42 },
  // NavyAI — 150K tokens/day, 20 RPM
  { provider: 'navy', modelId: 'auto', displayName: 'NavyAI (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 43 },
  // NaraRouter — free models available
  { provider: 'nara', modelId: 'mistral-large', displayName: 'Mistral Large (Nara Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 44 },
  { provider: 'nara', modelId: 'auto', displayName: 'NaraRouter Auto (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 45 },
  // SEA-LION — free, 10 RPM
  { provider: 'sealion', modelId: 'auto', displayName: 'SEA-LION (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 46 },
  // OrcaRouter — free *-free aliases
  { provider: 'orcarouter', modelId: 'orcarouter/free', displayName: 'OrcaRouter Free', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 47 },
  { provider: 'orcarouter', modelId: 'auto', displayName: 'OrcaRouter Auto (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 48 },
  // UnoRouter — free :free suffix models
  { provider: 'unorouter', modelId: 'auto', displayName: 'UnoRouter (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 49 },
  // xKiro — 5M tokens/day on free models
  { provider: 'xkiro', modelId: 'auto', displayName: 'xKiro (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 50 },
  // ModelScope — 2000 req/day
  { provider: 'modelscope', modelId: 'auto', displayName: 'ModelScope (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 51 },
  // Baidu Qianfan — ERNIE free models
  { provider: 'qianfan', modelId: 'ernie-speed-128k', displayName: 'ERNIE Speed 128K (Qianfan)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 52 },
  { provider: 'qianfan', modelId: 'auto', displayName: 'Qianfan Auto (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 53 },
  // Volcengine Ark — 2M tokens/day/model
  { provider: 'volcengine', modelId: 'auto', displayName: 'Volcengine Ark (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 54 },
  // LongCat — daily quota ~100K tokens
  { provider: 'longcat', modelId: 'auto', displayName: 'LongCat (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 55 },
  // iFlytek Spark — Lite model free
  { provider: 'xfyun', modelId: 'auto', displayName: 'iFlytek Spark (Free)', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 56 },
  // OpenCode Zen — promotional free models
  { provider: 'opencodezen', modelId: 'auto', displayName: 'OpenCode Zen (Free)', contextLength: 8192, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 57 },
  // FreeLLMAPI gateway
  { provider: 'freellmapi', modelId: 'auto', displayName: 'FreeLLMAPI Gateway', contextLength: 131072, supportsStreaming: true, supportsTools: false, supportsVision: false, supportsDocuments: false, costPer1k: 0, freeTier: true, priority: 58 },

  // ─── Paid / Credit-Dependent Providers (priority 100+) ─────────────────────
  { provider: 'openai', modelId: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextLength: 128000, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: false, costPer1k: 0.00015, freeTier: false, priority: 100 },
  { provider: 'openai', modelId: 'gpt-4o', displayName: 'GPT-4o', contextLength: 128000, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: false, costPer1k: 0.0025, freeTier: false, priority: 101 },
  { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4', contextLength: 200000, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: true, costPer1k: 0.003, freeTier: false, priority: 102, aliases: ['claude-sonnet', 'claude-4'] },
  { provider: 'anthropic', modelId: 'claude-haiku-3-5-20241022', displayName: 'Claude 3.5 Haiku', contextLength: 200000, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: false, costPer1k: 0.0008, freeTier: false, priority: 103 },
  { provider: 'deepseek', modelId: 'deepseek-chat', displayName: 'DeepSeek Chat', contextLength: 65536, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0.00007, freeTier: false, priority: 104 },
  { provider: 'mistral', modelId: 'mistral-small-latest', displayName: 'Mistral Small', contextLength: 32768, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0.0001, freeTier: false, priority: 105 },
  { provider: 'cohere', modelId: 'command-a-03-2025', displayName: 'Command A', contextLength: 128000, supportsStreaming: true, supportsTools: true, supportsVision: false, supportsDocuments: false, costPer1k: 0.0004, freeTier: false, priority: 106 },
  { provider: 'xai', modelId: 'grok-3-mini', displayName: 'Grok 3 Mini', contextLength: 131072, supportsStreaming: true, supportsTools: true, supportsVision: true, supportsDocuments: false, costPer1k: 0.0003, freeTier: false, priority: 107 },
];

// ─── Dynamic availability state ─────────────────────────────────────────────

const _availability = new Map<string, ModelAvailability>();

function availabilityKey(provider: string, modelId: string): string {
  return `${provider}:${modelId}`;
}

export function getModelAvailability(provider: string, modelId: string): ModelAvailability {
  const key = availabilityKey(provider, modelId);
  const existing = _availability.get(key);
  if (existing) return { ...existing };

  const fresh: ModelAvailability = {
    available: true,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,
    cooldownUntil: null,
    consecutiveFailures: 0,
  };
  _availability.set(key, fresh);
  return { ...fresh };
}

export function recordModelSuccess(provider: string, modelId: string): void {
  const key = availabilityKey(provider, modelId);
  const avail = _availability.get(key) ?? {
    available: true, lastSuccessAt: null, lastFailureAt: null,
    lastError: null, cooldownUntil: null, consecutiveFailures: 0,
  };
  avail.available = true;
  avail.lastSuccessAt = Date.now();
  avail.consecutiveFailures = 0;
  avail.cooldownUntil = null;
  _availability.set(key, avail);
}

export function recordModelFailure(provider: string, modelId: string, error?: string): void {
  const key = availabilityKey(provider, modelId);
  const avail = _availability.get(key) ?? {
    available: true, lastSuccessAt: null, lastFailureAt: null,
    lastError: null, cooldownUntil: null, consecutiveFailures: 0,
  };
  avail.lastFailureAt = Date.now();
  avail.lastError = error?.slice(0, 200) ?? null;
  avail.consecutiveFailures += 1;

  // After 3 consecutive failures, mark as unavailable
  if (avail.consecutiveFailures >= 3) {
    avail.available = false;
    avail.cooldownUntil = Date.now() + 300_000; // 5 minutes
  }

  _availability.set(key, avail);
}

export function setModelAvailable(provider: string, modelId: string, available: boolean): void {
  const key = availabilityKey(provider, modelId);
  const avail = _availability.get(key) ?? {
    available: true, lastSuccessAt: null, lastFailureAt: null,
    lastError: null, cooldownUntil: null, consecutiveFailures: 0,
  };
  avail.available = available;
  if (available) {
    avail.consecutiveFailures = 0;
    avail.cooldownUntil = null;
  }
  _availability.set(key, avail);
}

// ─── Catalog query functions ────────────────────────────────────────────────

export function lookupModel(provider: string, modelId?: string): ModelEntry | undefined {
  if (!modelId) return MODEL_CATALOG.find((m) => m.provider === provider);
  return MODEL_CATALOG.find((m) => m.provider === provider && m.modelId === modelId);
}

export function lookupModelByAlias(alias: string): ModelEntry | undefined {
  return MODEL_CATALOG.find((m) => m.aliases?.includes(alias));
}

export function getModelsForProvider(provider: string): ModelEntry[] {
  return MODEL_CATALOG.filter((m) => m.provider === provider);
}

export function getFreeModels(): ModelEntry[] {
  return MODEL_CATALOG.filter((m) => m.freeTier);
}

export function getVisionCapableProviders(): ModelEntry[] {
  return MODEL_CATALOG.filter((m) => m.supportsVision);
}

export function getToolCapableProviders(): ModelEntry[] {
  return MODEL_CATALOG.filter((m) => m.supportsTools);
}

export function getCatalogProviderNames(): string[] {
  return [...new Set(MODEL_CATALOG.map((m) => m.provider))];
}

/**
 * Find the best model for a given provider that meets requirements.
 */
export function findBestModel(
  provider: string,
  requirements: {
    minContextLength?: number;
    needsVision?: boolean;
    needsTools?: boolean;
    preferFree?: boolean;
  } = {},
): ModelEntry | undefined {
  const models = getModelsForProvider(provider);
  const available = models.filter((m) => {
    const avail = getModelAvailability(provider, m.modelId);
    if (!avail.available) return false;
    if (requirements.minContextLength && m.contextLength < requirements.minContextLength) return false;
    if (requirements.needsVision && !m.supportsVision) return false;
    if (requirements.needsTools && !m.supportsTools) return false;
    if (requirements.preferFree && !m.freeTier) return false;
    return true;
  });

  // Sort by priority (lower = better)
  available.sort((a, b) => a.priority - b.priority);
  return available[0];
}
