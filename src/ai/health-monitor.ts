import { log } from "../logger";
import { eventBus } from "../events/bus";
import { databaseManager } from "../storage/database";
import { ProviderHealth } from "../events/types";

const comp = "ai/health-monitor";

export class ProviderHealthMonitor {
  private static instance: ProviderHealthMonitor;
  private metrics: Map<string, any> = new Map();
  private db: ReturnType<typeof databaseManager.getDb>;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private readonly CHECK_INTERVAL_MS = 60000;

  private constructor() { this.db = databaseManager.getDb(); this.loadFromDatabase(); }

  static getInstance(): ProviderHealthMonitor { if (!ProviderHealthMonitor.instance) ProviderHealthMonitor.instance = new ProviderHealthMonitor(); return ProviderHealthMonitor.instance; }

  private loadFromDatabase(): void { try { const rows = this.db.prepare("SELECT * FROM provider_health").all(); for (const row of rows as any[]) { this.metrics.set(row.provider_id, { providerId: row.provider_id, status: row.status, latencyMs: row.latency_ms, failureCount: row.failure_count, successCount: row.success_count, totalRequests: row.total_requests, consecutiveFailures: row.consecutive_failures, avgLatencyMs: row.avg_latency_ms, lastCheck: row.last_check, updatedAt: row.updated_at }); } log.info(comp, "loaded", `Loaded health metrics for ${this.metrics.size} providers`); } catch {} }

  recordSuccess(providerId: string, latencyMs: number): void { const existing = this.metrics.get(providerId) ?? this.createDefault(providerId); existing.totalRequests++; existing.successCount++; existing.consecutiveFailures = 0; existing.latencyMs = latencyMs; existing.lastCheck = Date.now(); existing.updatedAt = Date.now(); existing.status = this.calculateStatus(existing); this.metrics.set(providerId, existing); this.saveToDatabase(providerId, existing); }

  recordFailure(providerId: string): void { const existing = this.metrics.get(providerId) ?? this.createDefault(providerId); existing.totalRequests++; existing.failureCount++; existing.consecutiveFailures++; existing.lastCheck = Date.now(); existing.updatedAt = Date.now(); existing.status = this.calculateStatus(existing); this.metrics.set(providerId, existing); this.saveToDatabase(providerId, existing); eventBus.emit("AIProviderFailed", { providerId, error: "Health monitor recorded failure" }); if (existing.consecutiveFailures >= 3) eventBus.emit("AIProviderHealthChanged", { providerId, health: ProviderHealth.TIMEOUT }); }

  getStatus(providerId: string): any { return this.metrics.get(providerId) ?? this.createDefault(providerId); }
  getAllMetrics(): any[] { return Array.from(this.metrics.values()); }
  isHealthy(providerId: string): boolean { const m = this.getStatus(providerId); return m.status === ProviderHealth.HEALTHY && m.consecutiveFailures < 3; }
  getHealthyProviders(): string[] { return this.getAllMetrics().filter((m: any) => m.status === ProviderHealth.HEALTHY).map((m: any) => m.providerId); }

  startPeriodicCheck(): void { if (this.checkInterval) return; this.checkInterval = setInterval(() => this.checkAll(), this.CHECK_INTERVAL_MS); log.info(comp, "monitoring_started", `Periodic health checks every ${this.CHECK_INTERVAL_MS}ms`); }
  stopPeriodicCheck(): void { if (this.checkInterval) { clearInterval(this.checkInterval); this.checkInterval = null; } }

  async checkAll(): Promise<void> { for (const m of this.getAllMetrics()) { m.status = await this.evaluateProviderHealth(m.providerId); m.lastCheck = Date.now(); m.updatedAt = Date.now(); this.metrics.set(m.providerId, m); this.saveToDatabase(m.providerId, m); eventBus.emit("AIProviderHealthChanged", { providerId: m.providerId, health: m.status }); } }

  async evaluateProviderHealth(providerId: string): Promise<ProviderHealth> { const m = this.getStatus(providerId); if (m.consecutiveFailures >= 5) return ProviderHealth.DISABLED; if (m.consecutiveFailures >= 3) return ProviderHealth.TIMEOUT; if (m.failureCount > m.successCount) return ProviderHealth.DEGRADED; if (m.avgLatencyMs > 5000) return ProviderHealth.RATE_LIMITED; return ProviderHealth.HEALTHY; }

  private createDefault(providerId: string): any { const d = { providerId, status: ProviderHealth.UNKNOWN, latencyMs: 0, failureCount: 0, successCount: 0, totalRequests: 0, consecutiveFailures: 0, avgLatencyMs: 0, lastCheck: 0, updatedAt: Date.now() }; this.metrics.set(providerId, d); return d; }

  private calculateStatus(m: any): ProviderHealth { if (m.consecutiveFailures >= 5) return ProviderHealth.DISABLED; if (m.consecutiveFailures >= 3) return ProviderHealth.TIMEOUT; if (m.consecutiveFailures >= 1) return ProviderHealth.DEGRADED; if (m.avgLatencyMs > 5000) return ProviderHealth.RATE_LIMITED; return ProviderHealth.HEALTHY; }

  private saveToDatabase(providerId: string, m: any): void { this.db.prepare(`INSERT OR REPLACE INTO provider_health (provider_id, status, latency_ms, failure_count, success_count, total_requests, last_check, consecutive_failures, avg_latency_ms, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(m.providerId, m.status, m.latencyMs, m.failureCount, m.successCount, m.totalRequests, m.lastCheck, m.consecutiveFailures, m.avgLatencyMs, m.updatedAt); }
}
