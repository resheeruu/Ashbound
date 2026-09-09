/**
 * Rate limiting — multi-layer rate limits and usage tracking.
 *
 * Layers:
 *   1. Per-user request cooldown (Discord-level)
 *   2. Per-provider/model/key RPM/RPD/TPM/TPD tracking (FreeLLMAPI-style)
 *   3. In-flight leases to prevent check-then-act races
 *
 * Inspired by FreeLLMAPI's sliding-window rate limit tracker.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// ─── Per-user rate limiting ──────────────────────────────────────────────────

interface UserRateLimit {
  userId: string;
  requests: number;
  windowStart: number;
  resetAt: number;
}

const _rateLimits = new Map<string, UserRateLimit>();
const RATE_LIMIT_MAX_REQ = 10;
const RATE_LIMIT_WINDOW_MS = 30_000;

export function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = _rateLimits.get(userId);
  if (!entry) {
    _rateLimits.set(userId, { userId, requests: 1, windowStart: now, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (now > entry.resetAt) {
    _rateLimits.set(userId, { userId, requests: 1, windowStart: now, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.requests >= RATE_LIMIT_MAX_REQ) {
    return true;
  }
  entry.requests += 1;
  return false;
}

export function getRateLimitStatus(userId: string): { requests: number; resetAt: number; remainingMs: number } {
  const entry = _rateLimits.get(userId);
  if (!entry) return { requests: 0, resetAt: Date.now(), remainingMs: 0 };
  return { requests: entry.requests, resetAt: entry.resetAt, remainingMs: Math.max(0, entry.resetAt - Date.now()) };
}

// ─── Provider/model/key level rate limiting ──────────────────────────────────

export interface ProviderModelLimits {
  rpm: number | null;
  rpd: number | null;
  tpm: number | null;
  tpd: number | null;
}

interface WindowEntry {
  timestamps: number[];
  tokenTimestamps: Array<{ ts: number; tokens: number }>;
}

function getWindow(key: string): WindowEntry {
  let w = _windows.get(key);
  if (!w) {
    w = { timestamps: [], tokenTimestamps: [] };
    _windows.set(key, w);
  }
  return w;
}

function pruneTimestamps(timestamps: number[], windowMs: number, now: number): number[] {
  const cutoff = now - windowMs;
  return timestamps.filter(ts => ts > cutoff);
}

const _windows = new Map<string, WindowEntry>();

// ─── In-flight leases ────────────────────────────────────────────────────────
// Prevents check-then-act race where multiple simultaneous requests all see
// the same available quota and collectively blow through the limit.

interface Lease {
  platform: string;
  modelId: string;
  tokens: number;
  createdAt: number;
}

const _leases = new Map<number, Lease>();
let _nextLeaseId = 1;
const LEASE_MAX_AGE_MS = 2 * MINUTE;

function pruneLeases(now: number): void {
  for (const [id, lease] of _leases) {
    if (now - lease.createdAt > LEASE_MAX_AGE_MS) _leases.delete(id);
  }
}

function provisionalRequests(platform: string, modelId: string, now: number): number {
  pruneLeases(now);
  let count = 0;
  for (const lease of _leases.values()) {
    if (lease.platform === platform && lease.modelId === modelId) count++;
  }
  return count;
}

function provisionalTokens(platform: string, modelId: string, now: number): number {
  pruneLeases(now);
  let total = 0;
  for (const lease of _leases.values()) {
    if (lease.platform === platform && lease.modelId === modelId) total += lease.tokens;
  }
  return total;
}

export function acquireLease(platform: string, modelId: string, tokens: number): number {
  pruneLeases(Date.now());
  const id = _nextLeaseId++;
  _leases.set(id, { platform, modelId, tokens, createdAt: Date.now() });
  return id;
}

export function releaseLease(leaseId: number): void {
  _leases.delete(leaseId);
}

export function _resetLeases(): void {
  _leases.clear();
}

// ─── Check functions ─────────────────────────────────────────────────────────

function requestCount(platform: string, modelId: string, windowMs: number, now: number): number {
  const key = `${platform}:${modelId}`;
  const type = windowMs === MINUTE ? 'rpm' : 'rpd';
  const w = getWindow(`${key}:${type}`);
  w.timestamps = pruneTimestamps(w.timestamps, windowMs, now);
  return w.timestamps.length;
}

function tokenCount(platform: string, modelId: string, windowMs: number, now: number): number {
  const key = `${platform}:${modelId}`;
  const type = windowMs === MINUTE ? 'tpm' : 'tpd';
  const w = getWindow(`${key}:${type}`);
  w.tokenTimestamps = w.tokenTimestamps.filter(t => t.ts > now - windowMs);
  return w.tokenTimestamps.reduce((sum, t) => sum + t.tokens, 0);
}

export function canMakeRequest(
  platform: string,
  modelId: string,
  limits: ProviderModelLimits,
): boolean {
  const now = Date.now();
  const inFlight = provisionalRequests(platform, modelId, now);

  if (limits.rpm !== null) {
    if (requestCount(platform, modelId, MINUTE, now) + inFlight >= limits.rpm) return false;
  }
  if (limits.rpd !== null) {
    if (requestCount(platform, modelId, DAY, now) + inFlight >= limits.rpd) return false;
  }
  return true;
}

export function canUseTokens(
  platform: string,
  modelId: string,
  estimatedTokens: number,
  limits: ProviderModelLimits,
): boolean {
  const now = Date.now();
  const inFlight = provisionalTokens(platform, modelId, now);

  if (limits.tpm !== null) {
    const used = tokenCount(platform, modelId, MINUTE, now);
    if (used + inFlight + estimatedTokens > limits.tpm) return false;
  }
  if (limits.tpd !== null) {
    const used = tokenCount(platform, modelId, DAY, now);
    if (used + inFlight + estimatedTokens > limits.tpd) return false;
  }
  return true;
}

export function recordRequest(platform: string, modelId: string): void {
  const now = Date.now();
  const rpmKey = `${platform}:${modelId}:rpm`;
  const rpdKey = `${platform}:${modelId}:rpd`;
  const rpmWindow = getWindow(rpmKey);
  rpmWindow.timestamps = pruneTimestamps(rpmWindow.timestamps, MINUTE, now);
  rpmWindow.timestamps.push(now);
  const rpdWindow = getWindow(rpdKey);
  rpdWindow.timestamps = pruneTimestamps(rpdWindow.timestamps, DAY, now);
  rpdWindow.timestamps.push(now);
}

export function recordTokens(platform: string, modelId: string, tokens: number): void {
  const now = Date.now();
  const tpmKey = `${platform}:${modelId}:tpm`;
  const tpdKey = `${platform}:${modelId}:tpd`;
  const tpmWindow = getWindow(tpmKey);
  tpmWindow.tokenTimestamps = tpmWindow.tokenTimestamps.filter(t => t.ts > now - MINUTE);
  tpmWindow.tokenTimestamps.push({ ts: now, tokens });
  const tpdWindow = getWindow(tpdKey);
  tpdWindow.tokenTimestamps = tpdWindow.tokenTimestamps.filter(t => t.ts > now - DAY);
  tpdWindow.tokenTimestamps.push({ ts: now, tokens });
}

// ─── Cooldown system ─────────────────────────────────────────────────────────

const _cooldowns = new Map<string, number>(); // key -> expiry timestamp

export function setCooldown(platform: string, modelId: string, durationMs: number): void {
  _cooldowns.set(`${platform}:${modelId}:cooldown`, Date.now() + durationMs);
}

export function isOnCooldown(platform: string, modelId: string): boolean {
  const key = `${platform}:${modelId}:cooldown`;
  const expiry = _cooldowns.get(key);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    _cooldowns.delete(key);
    return false;
  }
  return true;
}

// ─── Window utilization for routing guardrail ────────────────────────────────

export function modelWindowUsedFraction(
  platform: string,
  modelId: string,
  limits: ProviderModelLimits,
): number | null {
  if (limits.rpm == null && limits.rpd == null && limits.tpm == null && limits.tpd == null) return null;
  const now = Date.now();
  let worst = 0;

  if (limits.rpm != null && limits.rpm > 0) {
    const used = requestCount(platform, modelId, MINUTE, now) + provisionalRequests(platform, modelId, now);
    worst = Math.max(worst, used / limits.rpm);
  }
  if (limits.rpd != null && limits.rpd > 0) {
    const used = requestCount(platform, modelId, DAY, now) + provisionalRequests(platform, modelId, now);
    worst = Math.max(worst, used / limits.rpd);
  }
  if (limits.tpm != null && limits.tpm > 0) {
    const used = tokenCount(platform, modelId, MINUTE, now) + provisionalTokens(platform, modelId, now);
    worst = Math.max(worst, used / limits.tpm);
  }
  if (limits.tpd != null && limits.tpd > 0) {
    const used = tokenCount(platform, modelId, DAY, now) + provisionalTokens(platform, modelId, now);
    worst = Math.max(worst, used / limits.tpd);
  }

  return Math.min(1, worst);
}

// ─── Usage reset (for testing) ──────────────────────────────────────────────

export function _resetRateLimitState(): void {
  _rateLimits.clear();
  _windows.clear();
  _cooldowns.clear();
  _leases.clear();
}
