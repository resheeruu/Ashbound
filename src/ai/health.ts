/**
 * Provider Health System.
 *
 * Tracks per-provider health: success rate, latency, cooldown, rate limits.
 * Used by the router to skip unhealthy providers and exposed for monitoring.
 *
 * Enhanced with:
 *   - Transport-error vs invalid-credential distinction
 *   - Periodic health checks
 *   - Cooldown recovery
 *   - Consecutive-failure tracking with automatic temporary exclusion
 *   - Successful live request restoring degraded keys
 *
 * Inspired by FreeLLMAPI's health.ts architecture.
 */

import { SecretRedactor } from '../security/SecretRedactor.js';

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastError: string | null;
  cooldownUntil: number | null;
  cooldownRemainingMs: number;
  rateLimitHits: number;
  tokensUsed: number;
  estimatedCost: number;
  /** Whether last failure was a transport error (not invalid credentials). */
  lastFailureIsTransport: boolean;
}

const _health = new Map<string, ProviderHealth>();
const _latencies = new Map<string, number[]>();
const _cooldowns = new Map<string, { until: number; reason: string }>();

const LATENCY_WINDOW = 50;
const P95_PERCENTILE = 0.95;

const DEGRADED_FAILURE_THRESHOLD = 2;
const UNHEALTHY_FAILURE_THRESHOLD = 5;
const DEGRADED_P95_MS = 5000;
const UNHEALTHY_P95_MS = 15000;
const COOLDOWN_BASE_MS = 5_000;
const COOLDOWN_MAX_MS = 600_000;
const COOLDOWN_JITTER = 0.3;
const RATE_LIMIT_BACKOFF_MS = 60_000;

const COST_PER_1K: Record<string, number> = {
  openai: 0.00015,
  anthropic: 0.0006,
  gemini: 0.0,
  groq: 0.0,
  openrouter: 0.0,
  mistral: 0.0,
  deepseek: 0.00007,
  xai: 0.0003,
  cohere: 0.0,
  freellmapi: 0.0,
  cerebras: 0.0,
  nvidia: 0.0,
  github: 0.0,
  cloudflare: 0.0,
  huggingface: 0.0,
  pollinations: 0.0,
  opencodezen: 0.0,
  zhipu: 0.0,
  ollama: 0.0,
  custom: 0.0,
  bai: 0.0,
  anyapi: 0.0,
  aihorde: 0.0,
  ollamacloud: 0.0,
  kilo: 0.0,
  llm7: 0.0,
  ovh: 0.0,
  agnes: 0.0,
  reka: 0.0,
  siliconflow: 0.0,
  routeway: 0.0,
  bazaarlink: 0.0,
  ainative: 0.0,
  aion: 0.0,
  requesty: 0.0,
  navy: 0.0,
  nara: 0.0,
  sealion: 0.0,
  orcarouter: 0.0,
  unorouter: 0.0,
  xkiro: 0.0,
  modelscope: 0.0,
  qianfan: 0.0,
  volcengine: 0.0,
  longcat: 0.0,
  xfyun: 0.0,
};

function getOrInit(name: string): ProviderHealth {
  let h = _health.get(name);
  if (!h) {
    h = {
      status: 'unknown',
      consecutiveFailures: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      successRate: 1,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
      cooldownUntil: null,
      cooldownRemainingMs: 0,
      rateLimitHits: 0,
      tokensUsed: 0,
      estimatedCost: 0,
      lastFailureIsTransport: false,
    };
    _health.set(name, h);
  }
  return h;
}

function recompute(h: ProviderHealth, name: string): void {
  const total = h.totalSuccesses + h.totalFailures;
  h.successRate = total > 0 ? h.totalSuccesses / total : 1;

  const lats = _latencies.get(name) ?? [];
  if (lats.length > 0) {
    const sorted = [...lats].sort((a, b) => a - b);
    h.avgLatencyMs = lats.reduce((s, x) => s + x, 0) / lats.length;
    const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * P95_PERCENTILE));
    h.p95LatencyMs = sorted[p95Idx];
  }

  if (h.cooldownUntil && Date.now() < h.cooldownUntil) {
    h.cooldownRemainingMs = h.cooldownUntil - Date.now();
    h.status = 'unhealthy';
  } else {
    h.cooldownUntil = null;
    h.cooldownRemainingMs = 0;
    if (h.consecutiveFailures >= UNHEALTHY_FAILURE_THRESHOLD) h.status = 'unhealthy';
    else if (h.consecutiveFailures >= DEGRADED_FAILURE_THRESHOLD) h.status = 'degraded';
    else if (h.totalSuccesses + h.totalFailures > 0) h.status = 'healthy';
    else h.status = 'unknown';
  }
}

function recordLatency(name: string, ms: number): void {
  const arr = _latencies.get(name) ?? [];
  arr.push(ms);
  if (arr.length > LATENCY_WINDOW) arr.shift();
  _latencies.set(name, arr);
}

function backoffMs(failures: number): number {
  const base = COOLDOWN_BASE_MS * Math.pow(2, failures - 1);
  const jitter = base * COOLDOWN_JITTER * (Math.random() * 2 - 1);
  return Math.min(base + jitter, COOLDOWN_MAX_MS);
}

// ─── Error classification helpers ────────────────────────────────────────────

function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) return (err as { status: number }).status === 429;
  return /429|rate limit|too many requests/i.test(String(err));
}

function isTimeoutError(err: unknown): boolean {
  return /timeout|ETIMEDOUT|aborted/i.test(String(err));
}

/** True when the error is a transport/DNS/TLS failure, not a credential issue. */
function isTransportError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    // 401/403 = credential issue, not transport
    if (status === 401 || status === 403) return false;
    // 5xx = server/transport issue
    if (status >= 500) return true;
  }
  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network|socket hang up|fetch failed|timeout|aborted|DNS/i.test(String(err));
}

// ─── Core recording functions ────────────────────────────────────────────────

export function recordSuccess(name: string, latencyMs: number, tokens = 0): void {
  const h = getOrInit(name);
  h.consecutiveFailures = 0;
  h.totalSuccesses += 1;
  h.lastSuccessAt = Date.now();
  h.tokensUsed += tokens;
  h.estimatedCost += (tokens / 1000) * (COST_PER_1K[name] ?? 0);
  recordLatency(name, latencyMs);
  _cooldowns.delete(name);
  recompute(h, name);
}

export function recordFailure(name: string, err: unknown): void {
  const h = getOrInit(name);
  h.consecutiveFailures += 1;
  h.totalFailures += 1;
  h.lastFailureAt = Date.now();
  h.lastError = String(err).slice(0, 200);
  h.lastFailureIsTransport = isTransportError(err);

  if (isRateLimitError(err)) h.rateLimitHits += 1;

  const failures = h.consecutiveFailures;
  let delay: number;

  if (isRateLimitError(err)) {
    delay = RATE_LIMIT_BACKOFF_MS;
  } else if (isTimeoutError(err)) {
    delay = 30_000;
  } else {
    delay = backoffMs(failures);
  }

  const until = Date.now() + delay;
  h.cooldownUntil = until;
  h.cooldownRemainingMs = delay;
  _cooldowns.set(name, { until, reason: String(err).slice(0, 80) });

  recompute(h, name);
  console.warn(`[Health] ${name} cooldown: ${Math.round(delay / 1000)}s (consec=${failures})`);
}

export function isOnCooldown(name: string): boolean {
  const entry = _cooldowns.get(name);
  if (!entry) return false;
  if (Date.now() >= entry.until) {
    _cooldowns.delete(name);
    return false;
  }
  return true;
}

export function getHealth(name: string): ProviderHealth {
  const h = getOrInit(name);
  recompute(h, name);
  return { ...h };
}

export function getAllHealth(): Record<string, ProviderHealth> {
  const result: Record<string, ProviderHealth> = {};
  for (const name of _health.keys()) result[name] = getHealth(name);
  return result;
}

export function getCooldowns(): Record<string, { until: number; reason: string; remainingMs: number }> {
  const result: Record<string, { until: number; reason: string; remainingMs: number }> = {};
  for (const [name, entry] of _cooldowns) {
    if (Date.now() < entry.until) {
      result[name] = { until: entry.until, reason: entry.reason, remainingMs: entry.until - Date.now() };
    }
  }
  return result;
}

export function clearCooldown(name: string): void {
  _cooldowns.delete(name);
  const h = _health.get(name);
  if (h) {
    h.cooldownUntil = null;
    h.cooldownRemainingMs = 0;
    recompute(h, name);
  }
}

export function clearAllCooldowns(): void {
  _cooldowns.clear();
  for (const name of _health.keys()) {
    const h = _health.get(name)!;
    h.cooldownUntil = null;
    h.cooldownRemainingMs = 0;
    recompute(h, name);
  }
}

// ─── Periodic health checker ─────────────────────────────────────────────────

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let _healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let _healthCheckRunning = false;

export type HealthCheckFn = (providerName: string) => Promise<boolean>;

let _checkFn: HealthCheckFn | null = null;

/**
 * Register a health check function. The router or bootstrap should call this
 * to provide a probe that tests whether a provider's credentials are valid.
 */
export function registerHealthCheck(fn: HealthCheckFn): void {
  _checkFn = fn;
}

/**
 * Run a single-pass health check across all known providers.
 * Skips providers on cooldown. Does not duplicate overlapping checks.
 */
export async function runHealthCheck(): Promise<{ checked: string[]; skipped: string[] }> {
  if (_healthCheckRunning) {
    console.log('[Health] Health check already in progress, skipping.');
    return { checked: [], skipped: [] };
  }

  _healthCheckRunning = true;
  const checked: string[] = [];
  const skipped: string[] = [];

  try {
    for (const [name, h] of _health) {
      if (isOnCooldown(name)) {
        skipped.push(name);
        continue;
      }

      if (_checkFn) {
        try {
          const ok = await _checkFn(name);
          if (ok) {
            recordSuccess(name, 0);
          } else {
            recordFailure(name, new Error('Health check failed'));
          }
          checked.push(name);
        } catch {
          // Transport error during health check — do not penalize
          skipped.push(name);
        }
      }
    }
  } finally {
    _healthCheckRunning = false;
  }

  return { checked, skipped };
}

/**
 * Start the periodic health checker.
 */
export function startHealthChecker(): void {
  if (_healthCheckTimer) return;
  _healthCheckTimer = setInterval(async () => {
    try {
      await runHealthCheck();
    } catch (err) {
      console.error('[Health] Periodic check failed:', SecretRedactor.redactString(String(err)));
    }
  }, HEALTH_CHECK_INTERVAL_MS);
  _healthCheckTimer.unref();
  console.log(`[Health] Periodic checker started (every ${HEALTH_CHECK_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the periodic health checker.
 */
export function stopHealthChecker(): void {
  if (_healthCheckTimer) {
    clearInterval(_healthCheckTimer);
    _healthCheckTimer = null;
  }
}

// ─── Reset (for testing) ────────────────────────────────────────────────────

export function _resetHealthState(): void {
  _health.clear();
  _latencies.clear();
  _cooldowns.clear();
  _healthCheckRunning = false;
}

export { listAvailableProviders } from './providers/index.js';
