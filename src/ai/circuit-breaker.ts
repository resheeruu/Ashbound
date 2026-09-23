import { log } from "../logger";
import { eventBus } from "../events/bus";
import { databaseManager } from "../storage/database";
import { ProviderHealth } from "../events/types";

const comp = "ai/circuit-breaker";

export class CircuitBreaker {
  private static instance: CircuitBreaker;
  private states: Map<string, CircuitState> = new Map();
  private db: ReturnType<typeof databaseManager.getDb>;

  private constructor() { this.db = databaseManager.getDb(); this.loadFromDatabase(); }

  static getInstance(): CircuitBreaker { if (!CircuitBreaker.instance) CircuitBreaker.instance = new CircuitBreaker(); return CircuitBreaker.instance; }

  private loadFromDatabase(): void { try { const rows = this.db.prepare("SELECT * FROM circuit_breaker").all() as Array<{ provider_id: string; state: string; failure_count: number; success_count: number; last_failure_time: number; next_try_time: number; cooldown_ms: number; threshold: number; updated_at: number }>; for (const row of rows) { this.states.set(row.provider_id, { providerId: row.provider_id, state: row.state as CircuitState["state"], failureCount: row.failure_count, successCount: row.success_count, lastFailureTime: row.last_failure_time, nextTryTime: row.next_try_time, cooldownMs: row.cooldown_ms, threshold: row.threshold, updatedAt: row.updated_at }); } log.info(comp, "cb_loaded", `Loaded ${this.states.size} circuit breaker states`); } catch (e) { log.error(comp, "load_error", `Failed to load circuit breaker: ${e}`); } }

  canExecute(providerId: string): boolean { const data = this.getState(providerId); if (data.state === "CLOSED") return true; if (data.state === "OPEN") { if (Date.now() >= data.nextTryTime) { data.state = "HALF_OPEN"; this.saveToDatabase(providerId, data); log.info(comp, "half_open", `Provider ${providerId} transitioning to HALF_OPEN`); return true; } return false; } if (data.state === "HALF_OPEN") return true; return false; }

  recordSuccess(providerId: string): void { const data = this.getState(providerId); data.successCount++; data.failureCount = 0; if (data.state === "HALF_OPEN" && data.successCount >= 2) { data.state = "CLOSED"; data.failureCount = 0; data.successCount = 0; log.info(comp, "closed", `Provider ${providerId} circuit closed`); eventBus.emit("AIProviderHealthChanged", { providerId, health: ProviderHealth.HEALTHY }); } data.updatedAt = Date.now(); this.saveToDatabase(providerId, data); }

  recordFailure(providerId: string): void { const data = this.getState(providerId); data.failureCount++; data.successCount = 0; data.lastFailureTime = Date.now(); if (data.failureCount >= data.threshold) { data.state = "OPEN"; data.nextTryTime = Date.now() + data.cooldownMs; log.warn(comp, "opened", `Provider ${providerId} circuit OPENED after ${data.failureCount} failures`); eventBus.emit("AIProviderHealthChanged", { providerId, health: ProviderHealth.TIMEOUT }); eventBus.emit("AIProviderFailed", { providerId, error: "Circuit breaker opened after threshold failures" }); } data.updatedAt = Date.now(); this.saveToDatabase(providerId, data); }

  getState(providerId: string): CircuitState { let data = this.states.get(providerId); if (!data) { data = { providerId, state: "CLOSED", failureCount: 0, successCount: 0, lastFailureTime: 0, nextTryTime: 0, cooldownMs: 30000, threshold: 5, updatedAt: Date.now() }; this.states.set(providerId, data); this.saveToDatabase(providerId, data); } return data; }

  reset(providerId: string): void { const data = this.getState(providerId); data.state = "CLOSED"; data.failureCount = 0; data.successCount = 0; data.updatedAt = Date.now(); this.saveToDatabase(providerId, data); log.info(comp, "reset", `Circuit breaker for ${providerId} reset to CLOSED`); }

  getStateString(providerId: string): string { return this.getState(providerId).state; }

  private saveToDatabase(providerId: string, data: CircuitState): void { this.db.prepare(`INSERT OR REPLACE INTO circuit_breaker (provider_id, state, failure_count, success_count, last_failure_time, next_try_time, cooldown_ms, threshold, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(providerId, data.state, data.failureCount, data.successCount, data.lastFailureTime, data.nextTryTime, data.cooldownMs, data.threshold, data.updatedAt); }
}

interface CircuitState { providerId: string; state: "CLOSED" | "OPEN" | "HALF_OPEN"; failureCount: number; successCount: number; lastFailureTime: number; nextTryTime: number; cooldownMs: number; threshold: number; updatedAt: number; }
