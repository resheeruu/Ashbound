/**
 * Smart AI Router — intelligent request routing across providers.
 *
 * Routes based on:
 * - Provider health and state (HEALTHY, COOLDOWN, RATE_LIMITED, etc.)
 * - Capability (vision, streaming, tools, context window, tool calling)
 * - Cost (cheap for simple tasks, premium for complex)
 * - Latency (round-trip pings)
 * - Model availability
 * - Rate limit headroom (RPM/RPD/TPM/TPD)
 * - Automatic fallback with exponential backoff
 * - Permanent failure detection (invalid creds, no credits)
 * - Temporary failure recovery
 * - Usage tracking
 * - Model weight overrides
 *
 * Inspired by FreeLLMAPI's router.ts architecture.
 */

import { getPrimaryProvider, getFallbackProvider, getProvider, listAvailableProviders } from './providers/index.js';
import type { AICompletionOptions, AIResponse, AIStreamChunk, AIMessage, ToolDefinition, ProviderFailureKind, ProviderState } from './types.js';
import { SecretRedactor } from '../security/SecretRedactor.js';
import { MODEL_CATALOG, lookupModel } from './modelCatalog.js';
import { canMakeRequest, canUseTokens, modelWindowUsedFraction, recordRequest, recordTokens, acquireLease, releaseLease, type ProviderModelLimits } from './rateLimit.js';
import { recordSuccess as healthRecordSuccess, recordFailure as healthRecordFailure, getHealth, type ProviderHealth } from './health.js';

// ─── Provider cooldown state ────────────────────────────────────────────────

interface CooldownEntry {
  until: number;
  failures: number;
}

const _cooldowns = new Map<string, CooldownEntry>();
const _unavailable = new Map<string, string>();

// ─── Error classification ────────────────────────────────────────────────────

export function classifyProviderFailure(error: unknown): ProviderFailureKind {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const status = typeof record.status === 'number' ? record.status : undefined;
  const details = [
    error instanceof Error ? error.message : String(error),
    typeof record.code === 'string' ? record.code : '',
    typeof record.type === 'string' ? record.type : '',
    record.error && typeof record.error === 'object' ? JSON.stringify(record.error) : '',
  ].join(' ').toLowerCase();

  // Authentication / authorization failures — never retry
  if (/(invalid.?api.?key|invalid.?key|authentication|unauthori[sz]ed|forbidden|billing|identity-linked|workspace.?id)/.test(details)
    || status === 401 || status === 403) return 'invalid_credentials';

  // Quota / credit exhaustion — do not retry until manually refreshed
  if (/(credit_balance_exhausted|insufficient_quota|insufficient.?balance|insufficient.?credits|payment.?required|no.?credits)/.test(details)
    || status === 402) return 'no_credits';

  // Model-specific failures — may resolve if model is changed
  if (/(model.?not.?found|not.?found|does.?not.?exist|unavailable|deprecated|not.?available)/.test(details)
    || status === 404) return 'model_unavailable';

  // Rate limiting — will recover
  if (status === 429 || /rate.?limit|too many requests/.test(details)) return 'rate_limit';

  // Context too large
  if (/(context.?length|context.?too.?large|maximum.?context|token.?limit|max.?tokens?.?exceeded)/.test(details)
    || status === 413) return 'context_too_large';

  // Vision unsupported
  if (/(vision|image|multimodal).?unsupported|no.?vision|cannot.?process.?image/.test(details)) return 'vision_unsupported';

  // Tool calling unsupported
  if (/(tool.?call|function.?call).?unsupported|no.?tool|tools?.?not.?supported/.test(details)) return 'tools_unsupported';

  // Invalid request
  if (/(invalid.?request|bad.?request|malformed|invalid.?parameter)/.test(details)
    || status === 400) return 'invalid_request';

  // Server errors
  if (status && status >= 500) return 'server_error';

  // Network errors — transient
  if (/(ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network|socket hang up|fetch failed|timeout|aborted)/i.test(details)) return 'network_error';

  return 'transient';
}

// ─── Cooldown management ────────────────────────────────────────────────────

const COOLDOWN_BASE_MS = 5_000;
const COOLDOWN_MAX_MS = 300_000;
const COOLDOWN_JITTER = 0.3;

function cooldownMs(failures: number): number {
  const base = COOLDOWN_BASE_MS * Math.pow(2, failures - 1);
  const jitter = base * COOLDOWN_JITTER * (Math.random() * 2 - 1);
  return Math.min(base + jitter, COOLDOWN_MAX_MS);
}

function isOnCooldown(name: string): boolean {
  const entry = _cooldowns.get(name);
  if (!entry) return false;
  if (Date.now() >= entry.until) {
    _cooldowns.delete(name);
    return false;
  }
  return true;
}

function recordFailure(name: string): void {
  const prev = _cooldowns.get(name);
  const failures = (prev?.failures ?? 0) + 1;
  const delay = cooldownMs(failures);
  _cooldowns.set(name, { until: Date.now() + delay, failures });
  console.warn(`[Router] ${name} cooldown: ${Math.round(delay / 1000)}s (failure #${failures})`);
}

function recordSuccess(name: string): void {
  if (_cooldowns.has(name)) {
    _cooldowns.delete(name);
  }
}

export function getCooldownStatus(): Record<string, { until: number; failures: number }> {
  const result: Record<string, { until: number; failures: number }> = {};
  for (const [name, entry] of _cooldowns) {
    if (isOnCooldown(name)) result[name] = { until: entry.until, failures: entry.failures };
  }
  return result;
}

export function _resetRouterState(): void {
  _cooldowns.clear();
  _unavailable.clear();
  _perf.clear();
  _modelWeightOverrides.clear();
}

export function getUnavailableProviders(): Record<string, string> {
  return Object.fromEntries(_unavailable);
}

// ─── Performance tracking ────────────────────────────────────────────────────

export interface ProviderPerf {
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  avgLatencyMs: number;
  lastLatencyMs: number;
}

const _perf = new Map<string, ProviderPerf>();

export function getProviderPerf(name: string): ProviderPerf {
  return _perf.get(name) ?? { totalCalls: 0, successCalls: 0, failureCalls: 0, avgLatencyMs: 0, lastLatencyMs: 0 };
}

export function getAllPerf(): Record<string, ProviderPerf> {
  const result: Record<string, ProviderPerf> = {};
  for (const [k, v] of _perf) result[k] = v;
  return result;
}

function recordPerf(name: string, success: boolean, latencyMs: number): void {
  const prev = _perf.get(name) ?? { totalCalls: 0, successCalls: 0, failureCalls: 0, avgLatencyMs: 0, lastLatencyMs: 0 };
  const total = prev.totalCalls + 1;
  prev.totalCalls = total;
  prev.successCalls += success ? 1 : 0;
  prev.failureCalls += success ? 0 : 1;
  prev.avgLatencyMs = (prev.avgLatencyMs * (total - 1) + latencyMs) / total;
  prev.lastLatencyMs = latencyMs;
  _perf.set(name, prev);
}

// ─── Model weight overrides ─────────────────────────────────────────────────

const _modelWeightOverrides = new Map<string, number>(); // modelId -> weight multiplier

export function setModelWeightOverride(modelId: string, weight: number): void {
  if (weight < 0 || weight > 10) throw new Error('Weight must be between 0 and 10');
  if (weight === 1) { _modelWeightOverrides.delete(modelId); return; }
  _modelWeightOverrides.set(modelId, weight);
}

export function getModelWeightOverride(modelId: string): number | undefined {
  return _modelWeightOverrides.get(modelId);
}

function applyModelWeightOverride(score: number, modelId: string): number {
  const weight = _modelWeightOverrides.get(modelId);
  return weight !== undefined ? score * weight : score;
}

// ─── Cleanup timer ──────────────────────────────────────────────────────────

const MAX_COOLDOWN_AGE_MS = 3_600_000;
const cooldownCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [name, entry] of _cooldowns) {
    if (now - (entry.until - cooldownMs(entry.failures)) > MAX_COOLDOWN_AGE_MS) {
      _cooldowns.delete(name);
    }
  }
}, 600_000);
cooldownCleanupTimer.unref();

// ─── Routing context and scoring ────────────────────────────────────────────

export interface RouteContext {
  intent?: string;
  urgent?: boolean;
  costSensitive?: boolean;
  hasVision?: boolean;
  requiresTools?: boolean;
  preferredProvider?: string;
  fallbackChain?: string[];
  maxCostPerM?: number;
  /** Maximum context length needed */
  contextNeeded?: number;
}

interface ProviderMeta {
  name: string;
  provider: {
    name: string;
    complete: (o: AICompletionOptions) => Promise<AIResponse>;
    stream: (o: AICompletionOptions, c: (x: AIStreamChunk) => void, d?: (m: Record<string, unknown>) => void) => Promise<void>;
  };
  costPerM: number;
  latencyMs: number;
  supportsVision: boolean;
  supportsSystemLong: boolean;
  supportsStreaming: boolean;
  supportsTools: boolean;
  contextLength: number;
  model: string;
}

const PROVIDER_CATALOG: Record<string, Omit<ProviderMeta, 'provider'>> = {
  // Paid providers
  openai:       { name: 'openai',       costPerM: 2.0,   latencyMs: 0, supportsVision: true,  supportsSystemLong: true,  supportsStreaming: true,  supportsTools: true,  contextLength: 128000, model: process.env.OPENAI_MODEL      ?? 'gpt-4o-mini' },
  anthropic:    { name: 'anthropic',    costPerM: 3.0,   latencyMs: 0, supportsVision: true,  supportsSystemLong: true,  supportsStreaming: true,  supportsTools: true,  contextLength: 200000, model: process.env.ANTHROPIC_MODEL   ?? 'claude-sonnet-4-20250514' },
  deepseek:     { name: 'deepseek',     costPerM: 0.14,  latencyMs: 0, supportsVision: false, supportsSystemLong: true,  supportsStreaming: true,  supportsTools: true,  contextLength: 65536,  model: process.env.DEEPSEEK_MODEL    ?? 'deepseek-chat' },
  xai:          { name: 'xai',          costPerM: 5.0,   latencyMs: 0, supportsVision: true,  supportsSystemLong: true,  supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.XAI_MODEL         ?? 'grok-3-mini' },

  // Free tier providers — Google/Gemini
  gemini:       { name: 'gemini',       costPerM: 0.0,   latencyMs: 0, supportsVision: true,  supportsSystemLong: true,  supportsStreaming: true,  supportsTools: true,  contextLength: 1048576, model: process.env.GEMINI_MODEL      ?? 'gemini-2.0-flash' },

  // Free tier providers — Groq
  groq:         { name: 'groq',         costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.GROQ_MODEL        ?? 'llama-3.1-8b-instant' },

  // Free tier providers — Mistral
  mistral:      { name: 'mistral',      costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: true,  supportsStreaming: true,  supportsTools: true,  contextLength: 32768,  model: process.env.MISTRAL_MODEL     ?? 'mistral-small-latest' },

  // Free tier providers — Cohere
  cohere:       { name: 'cohere',       costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: true,  supportsStreaming: true,  supportsTools: true,  contextLength: 128000, model: process.env.COHERE_MODEL      ?? 'command-a-03-2025' },

  // Free tier providers — OpenRouter
  openrouter:   { name: 'openrouter',   costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: true,  supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.OPENROUTER_MODEL  ?? 'meta-llama/llama-3.1-8b-instruct:free' },

  // Free tier providers — Cerebras
  cerebras:     { name: 'cerebras',     costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 8192,   model: process.env.CEREBRAS_MODEL    ?? 'llama-3.3-70b' },

  // Free tier providers — NVIDIA NIM
  nvidia:       { name: 'nvidia',       costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: true,  supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.NVIDIA_MODEL      ?? 'nvidia/llama-3.1-nemotron-70b-instruct' },

  // Free tier providers — GitHub Models
  github:       { name: 'github',       costPerM: 0.0,   latencyMs: 0, supportsVision: true,  supportsSystemLong: true,  supportsStreaming: true,  supportsTools: true,  contextLength: 128000, model: process.env.GITHUB_MODEL      ?? 'gpt-4o-mini' },

  // Free tier providers — Cloudflare Workers AI
  cloudflare:   { name: 'cloudflare',   costPerM: 0.0,   latencyMs: 0, supportsVision: true,  supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.CLOUDFLARE_MODEL  ?? '@cf/meta/llama-3.1-8b-instruct' },

  // Free tier providers — HuggingFace
  huggingface:  { name: 'huggingface',  costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.HF_MODEL          ?? 'meta-llama/Llama-3.1-8B-Instruct' },

  // Free tier providers — Pollinations (keyless)
  pollinations: { name: 'pollinations', costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: false, contextLength: 32768,  model: process.env.POLLINATIONS_MODEL ?? 'openai' },

  // Free tier providers — FreeLLMAPI gateway
  freellmapi:   { name: 'freellmapi',   costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: true,  supportsStreaming: true,  supportsTools: false, contextLength: 131072, model: process.env.FREELLMAPI_MODEL  ?? 'auto' },

  // Free tier providers — OpenCode Zen
  opencodezen:  { name: 'opencodezen',  costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 8192,   model: process.env.OPENCODEZEN_MODEL ?? 'auto' },

  // Free tier providers — Zhipu AI
  zhipu:        { name: 'zhipu',        costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 128000, model: process.env.ZHIPU_MODEL       ?? 'glm-4-flash' },

  // Free tier providers — Ollama (local)
  ollama:       { name: 'ollama',       costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: false, contextLength: 131072, model: process.env.OLLAMA_MODEL      ?? 'llama3.1' },

  // Free tier providers — B.AI
  bai:          { name: 'bai',          costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 32768,  model: process.env.BAI_MODEL         ?? 'auto' },

  // Free tier providers — AnyAPI (100K tokens/day)
  anyapi:       { name: 'anyapi',       costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.ANYAPI_MODEL      ?? 'auto' },

  // Free tier providers — AI Horde (keyless, volunteer)
  aihorde:      { name: 'aihorde',      costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: false, contextLength: 32768,  model: process.env.AI_HORDE_MODEL    ?? 'auto' },

  // Free tier providers — Ollama Cloud
  ollamacloud:  { name: 'ollamacloud',  costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.OLLAMACLOUD_MODEL ?? 'auto' },

  // Free tier providers — Kilo Gateway (keyless, 200 req/hr)
  kilo:         { name: 'kilo',         costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.KILO_MODEL        ?? 'auto' },

  // Free tier providers — LLM7 (100 req/hr)
  llm7:         { name: 'llm7',         costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 32768,  model: process.env.LLM7_MODEL        ?? 'auto' },

  // Free tier providers — OVH AI Endpoints (keyless, 2 req/min per IP)
  ovh:          { name: 'ovh',          costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.OVH_MODEL         ?? 'auto' },

  // Free tier providers — Agnes AI
  agnes:        { name: 'agnes',        costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 32768,  model: process.env.AGNES_MODEL       ?? 'auto' },

  // Free tier providers — Reka (free monthly credits, vision-capable)
  reka:         { name: 'reka',         costPerM: 0.0,   latencyMs: 0, supportsVision: true,  supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.REKA_MODEL        ?? 'auto' },

  // Free tier providers — SiliconFlow
  siliconflow:  { name: 'siliconflow',  costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 32768,  model: process.env.SILICONFLOW_MODEL ?? 'auto' },

  // Free tier providers — Routeway (free :free suffix models)
  routeway:     { name: 'routeway',     costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.ROUTEWAY_MODEL    ?? 'auto' },

  // Free tier providers — BazaarLink (auto:free route)
  bazaarlink:   { name: 'bazaarlink',   costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.BAZAARLINK_MODEL  ?? 'auto:free' },

  // Free tier providers — AINative Studio (~10M tokens/month)
  ainative:     { name: 'ainative',     costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.AINATIVE_MODEL    ?? 'auto' },

  // Free tier providers — Aion Labs
  aion:         { name: 'aion',         costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.AION_MODEL        ?? 'auto' },

  // Free tier providers — Requesty
  requesty:     { name: 'requesty',     costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.REQUESTY_MODEL    ?? 'auto' },

  // Free tier providers — NavyAI (150K tokens/day, 20 RPM)
  navy:         { name: 'navy',         costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.NAVY_MODEL        ?? 'auto' },

  // Free tier providers — NaraRouter
  nara:         { name: 'nara',         costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.NARA_MODEL        ?? 'auto' },

  // Free tier providers — SEA-LION (AI Singapore, 10 RPM)
  sealion:      { name: 'sealion',      costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.SEALION_MODEL     ?? 'auto' },

  // Free tier providers — OrcaRouter
  orcarouter:   { name: 'orcarouter',   costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.ORCAROUTER_MODEL  ?? 'orcarouter/free' },

  // Free tier providers — UnoRouter (free :free suffix models)
  unorouter:    { name: 'unorouter',    costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.UNOROUTER_MODEL   ?? 'auto' },

  // Free tier providers — xKiro (5M tokens/day on free models)
  xkiro:        { name: 'xkiro',        costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.XKIRO_MODEL       ?? 'auto' },

  // Free tier providers — ModelScope (2000 req/day)
  modelscope:   { name: 'modelscope',   costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.MODELSCOPE_MODEL  ?? 'auto' },

  // Free tier providers — Baidu Qianfan (ERNIE free models)
  qianfan:      { name: 'qianfan',      costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.QIANFAN_MODEL     ?? 'auto' },

  // Free tier providers — Volcengine Ark (2M tokens/day/model)
  volcengine:   { name: 'volcengine',   costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.VOLCENGINE_MODEL  ?? 'auto' },

  // Free tier providers — LongCat (daily quota)
  longcat:      { name: 'longcat',      costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.LONGCAT_MODEL     ?? 'auto' },

  // Free tier providers — iFlytek Spark
  xfyun:        { name: 'xfyun',        costPerM: 0.0,   latencyMs: 0, supportsVision: false, supportsSystemLong: false, supportsStreaming: true,  supportsTools: true,  contextLength: 131072, model: process.env.XFYUN_MODEL       ?? 'auto' },
};

// ─── Intent classification ──────────────────────────────────────────────────

const INTENT_ROUTES: Record<string, string[]> = {
  lore:         ['anthropic', 'openai', 'gemini'],
  creative:     ['anthropic', 'openai', 'gemini'],
  code:         ['anthropic', 'openai', 'groq', 'deepseek'],
  simple:       ['groq', 'deepseek', 'gemini', 'openai'],
  conversation: ['anthropic', 'openai', 'gemini', 'groq'],
  fast:         ['groq', 'deepseek', 'gemini'],
  vision:       ['anthropic', 'openai', 'gemini', 'xai'],
  tools:        ['openai', 'anthropic', 'gemini', 'groq'],
  default:      ['anthropic', 'openai', 'gemini'],
};

function classifyIntent(opts: AICompletionOptions, ctx: RouteContext): string {
  if (ctx.intent) return ctx.intent;
  if (ctx.hasVision) return 'vision';
  if (ctx.requiresTools || (opts.tools && opts.tools.length > 0)) return 'tools';

  const firstUser = opts.messages.find((m) => m.role === 'user');
  const text = (firstUser?.content ?? '').toLowerCase();

  if (text.length < 40) return 'simple';
  if (text.includes('image') || text.includes('screenshot') || text.includes('picture')) return 'vision';
  if (text.includes('code') || text.includes('function') || text.includes('implement')) return 'code';
  if (text.includes('story') || text.includes('lore') || text.includes('legend')) return 'lore';
  if (text.includes('creative') || text.includes('write') || text.includes('poem')) return 'creative';

  return 'default';
}

// ─── Capability-aware scoring ────────────────────────────────────────────────

function scoreProvider(meta: ProviderMeta, intent: string, ctx: RouteContext): number {
  let score = 100;

  // Hard capability filters
  if (ctx.hasVision && !meta.supportsVision) return -1;
  if ((ctx.requiresTools || (ctx as Record<string, unknown>).toolsRequired) && !meta.supportsTools) return -1;
  if (ctx.costSensitive && ctx.maxCostPerM !== undefined && meta.costPerM > ctx.maxCostPerM) return -1;
  if (ctx.contextNeeded && ctx.contextNeeded > meta.contextLength) return -1;

  // Intent ranking
  const ranked = INTENT_ROUTES[intent] ?? INTENT_ROUTES.default;
  const pos = ranked.indexOf(meta.name);
  if (pos >= 0) score -= pos * 15;

  // Cost preference
  if (ctx.costSensitive) score -= meta.costPerM * 5;

  // Speed preference
  if (ctx.urgent) score -= meta.latencyMs * 0.5;

  // Streaming requirement
  if (!meta.supportsStreaming) return -1;

  // Health-based penalty
  const health = getHealth(meta.name);
  if (health.status === 'degraded') score -= 10;
  if (health.status === 'unhealthy') score -= 30;

  // Rate limit headroom penalty
  const modelEntry = lookupModel(meta.name, meta.model);
  if (modelEntry) {
    const limits: ProviderModelLimits = {
      rpm: null, rpd: null, tpm: null, tpd: null,
    };
    const fraction = modelWindowUsedFraction(meta.name, meta.model, limits);
    if (fraction !== null && fraction > 0.8) {
      score -= 20; // Demote when near rate limit
    }
  }

  // Apply model weight override
  score = applyModelWeightOverride(score, meta.model);

  return score;
}

// ─── Candidate building ─────────────────────────────────────────────────────

function buildCandidates(ctx: RouteContext): ProviderMeta[] {
  const primary = getPrimaryProvider();
  const fallback = getFallbackProvider();
  const available = typeof listAvailableProviders === 'function' ? listAvailableProviders() : [];

  const candidates: ProviderMeta[] = [];

  if (ctx.fallbackChain?.length) {
    for (const name of ctx.fallbackChain) {
      const catalog = PROVIDER_CATALOG[name];
      if (!catalog) continue;
      const provider = name === primary?.name ? primary : name === fallback?.name ? fallback : null;
      if (provider && !candidates.find((c) => c.name === name)) {
        candidates.push({ ...catalog, provider: provider as ProviderMeta['provider'] });
      }
    }
  }

  if (ctx.preferredProvider) {
    const cat = PROVIDER_CATALOG[ctx.preferredProvider];
    const p = ctx.preferredProvider === primary?.name ? primary : ctx.preferredProvider === fallback?.name ? fallback : null;
    if (cat && p && !candidates.find((c) => c.name === ctx.preferredProvider)) {
      candidates.unshift({ ...cat, provider: p as ProviderMeta['provider'] });
    }
  }

  if (primary && !candidates.find((c) => c.name === primary.name)) {
    const cat = PROVIDER_CATALOG[primary.name];
    if (cat) candidates.push({ ...cat, provider: primary as ProviderMeta['provider'] });
  }

  if (fallback && !candidates.find((c) => c.name === fallback.name)) {
    const cat = PROVIDER_CATALOG[fallback.name];
    if (cat) candidates.push({ ...cat, provider: fallback as ProviderMeta['provider'] });
  }

  for (const name of available) {
    if (candidates.find((c) => c.name === name)) continue;
    const cat = PROVIDER_CATALOG[name];
    const prov = typeof getProvider === 'function' ? getProvider(name) : null;
    if (cat && prov) candidates.push({ ...cat, provider: prov as ProviderMeta['provider'] });
  }

  return candidates;
}

// ─── Main router class ─────────────────────────────────────────────────────

class AIRouter {
  async chat(
    opts: AICompletionOptions,
    ctx: RouteContext = {},
  ): Promise<AIResponse> {
    const intent = classifyIntent(opts, ctx);
    const candidates = buildCandidates(ctx);

    const ranked = candidates
      .map((c) => ({ ...c, score: scoreProvider(c, intent, ctx) }))
      .filter((c) => c.score >= 0);

    if (ranked.length === 0) {
      throw new Error('[Router] No providers available that meet requirements.');
    }

    const lastError = { e: null as unknown | null };

    for (const candidate of ranked) {
      if (_unavailable.has(candidate.name)) {
        console.warn(`[Router] Skipping ${candidate.name} — unavailable (${_unavailable.get(candidate.name)}).`);
        continue;
      }
      if (isOnCooldown(candidate.name)) {
        console.warn(`[Router] Skipping ${candidate.name} — on cooldown.`);
        continue;
      }

      // Rate limit check
      if (!canMakeRequest(candidate.name, candidate.model, { rpm: null, rpd: null, tpm: null, tpd: null })) {
        console.warn(`[Router] Skipping ${candidate.name} — rate limited.`);
        continue;
      }

      const leaseId = acquireLease(candidate.name, candidate.model, opts.maxTokens ?? 1000);
      try {
        const resolvedOpts = { ...opts, model: candidate.model };
        const start = Date.now();

        // Request timeout via AI_REQUEST_TIMEOUT_MS
        const requestTimeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? '60000', 10) || 60_000;
        const result = await Promise.race([
          candidate.provider.complete(resolvedOpts),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), requestTimeoutMs),
          ),
        ]);

        const latency = Date.now() - start;

        // Record success
        recordPerf(candidate.name, true, latency);
        recordSuccess(candidate.name);
        healthRecordSuccess(candidate.name, latency, result.meta.usage ? (result.meta.usage as Record<string, number>).total_tokens ?? 0 : 0);
        recordRequest(candidate.name, candidate.model);
        if (result.meta.usage) {
          const usage = result.meta.usage as Record<string, number>;
          if (usage.total_tokens) recordTokens(candidate.name, candidate.model, usage.total_tokens);
        }

        return result;
      } catch (err) {
        recordPerf(candidate.name, false, 0);
        healthRecordFailure(candidate.name, err);
        const failureKind = classifyProviderFailure(err);

        if (failureKind === 'invalid_credentials' || failureKind === 'no_credits') {
          _unavailable.set(candidate.name, failureKind);
          console.warn(`[Router] ${candidate.name} marked unavailable (${failureKind}).`);
        } else if (failureKind === 'model_unavailable') {
          _unavailable.set(candidate.name, failureKind);
          console.warn(`[Router] ${candidate.name} model unavailable (${failureKind}).`);
        } else {
          recordFailure(candidate.name);
        }
        lastError.e = err;
        console.warn(`[Router] ${candidate.name} failed [${failureKind}] (${SecretRedactor.redactString(String(err))}), trying next...`);
      } finally {
        releaseLease(leaseId);
      }
    }

    throw lastError.e ?? new Error('[Router] All providers failed.');
  }

  async stream(
    opts: AICompletionOptions,
    onChunk: (chunk: AIStreamChunk) => void,
    ctx: RouteContext = {},
  ): Promise<void> {
    const intent = classifyIntent(opts, ctx);
    const candidates = buildCandidates(ctx);

    const ranked = candidates
      .map((c) => ({ ...c, score: scoreProvider({ ...c, provider: null as unknown as ProviderMeta['provider'] }, intent, ctx) }))
      .filter((c) => c.score >= 0);

    let lastError: unknown = null;
    for (const candidate of ranked) {
      if (_unavailable.has(candidate.name)) {
        console.warn(`[Router] Skipping ${candidate.name} — unavailable (${_unavailable.get(candidate.name)}).`);
        continue;
      }
      if (isOnCooldown(candidate.name)) {
        console.warn(`[Router] Skipping ${candidate.name} — on cooldown.`);
        continue;
      }
      if (!canMakeRequest(candidate.name, candidate.model, { rpm: null, rpd: null, tpm: null, tpd: null })) {
        console.warn(`[Router] Skipping ${candidate.name} — rate limited.`);
        continue;
      }

      const leaseId = acquireLease(candidate.name, candidate.model, opts.maxTokens ?? 1000);
      try {
        const resolvedOpts = { ...opts, model: candidate.model };
        const start = Date.now();

        // Stream with timeout
        const streamPromise = candidate.provider.stream(resolvedOpts, onChunk);
        const timeoutMs = parseInt(process.env.AI_STREAM_TIMEOUT_MS ?? '120000', 10) || 120_000;
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Stream timeout')), timeoutMs)
        );

        await Promise.race([streamPromise, timeoutPromise]);

        const latency = Date.now() - start;
        recordPerf(candidate.name, true, latency);
        recordSuccess(candidate.name);
        healthRecordSuccess(candidate.name, latency);
        recordRequest(candidate.name, candidate.model);
        return;
      } catch (err) {
        recordPerf(candidate.name, false, 0);
        healthRecordFailure(candidate.name, err);
        const failureKind = classifyProviderFailure(err);
        if (failureKind === 'invalid_credentials' || failureKind === 'no_credits') {
          _unavailable.set(candidate.name, failureKind);
        } else if (failureKind === 'model_unavailable') {
          _unavailable.set(candidate.name, failureKind);
        } else {
          recordFailure(candidate.name);
        }
        lastError = err;
        console.warn(`[Router] ${candidate.name} stream failed [${failureKind}], trying next...`);
      } finally {
        releaseLease(leaseId);
      }
    }

    throw lastError ?? new Error('[Router] All streaming providers failed.');
  }

  async say(
    prompt: string,
    system?: string,
    ctx: RouteContext = {},
    opts: Partial<AICompletionOptions> = {},
  ): Promise<string> {
    const messages: AIMessage[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    const { content } = await this.chat({ messages, ...opts }, ctx);
    return content;
  }
}

export const router = new AIRouter();
