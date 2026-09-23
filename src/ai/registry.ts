import { log } from "../logger";
import { eventBus } from "../events/bus";
import { databaseManager } from "../storage/database";
import { ProviderHealth, ModelInfo, ProviderRegistration } from "./interfaces";

const comp = "ai/registry";

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, { id: string; name: string; status: string; priority: number; endpoint: string | undefined; config: Record<string, unknown>; free: boolean; latency: number | null; models: ModelInfo[]; circuitState: string; failures: number; lastVerified: number }> = new Map();
  private models: Map<string, ModelInfo[]> = new Map();
  private db: ReturnType<typeof databaseManager.getDb>;

  private constructor() { this.db = databaseManager.getDb(); this.loadFromDatabase(); }

  static getInstance(): ProviderRegistry { if (!ProviderRegistry.instance) ProviderRegistry.instance = new ProviderRegistry(); return ProviderRegistry.instance; }

  private loadFromDatabase(): void { try { const rows = this.db.prepare("SELECT * FROM provider_registry").all() as Array<{ id: string; name: string; status: string; endpoint: string | null; free: number; priority: number; latency: number | null; models: string | null; circuit_state: string; failures: number; last_verified: number; config: string }>; for (const row of rows) { this.providers.set(row.id, { id: row.id, name: row.name, status: row.status, priority: row.priority, endpoint: row.endpoint, config: JSON.parse(row.config || "{}"), free: row.free === 1, latency: row.latency, models: [], circuitState: row.circuit_state, failures: row.failures, lastVerified: row.last_verified }); if (row.models) { try { this.models.set(row.id, JSON.parse(row.models)); } catch {} } } log.info(comp, "registry_loaded", `Loaded ${this.providers.size} providers from database`); } catch (e) { log.error(comp, "load_error", `Failed to load registry: ${e}`); } }

  register(provider: { id: string; name: string }, registration: ProviderRegistration): void { const entry = { ...registration, id: provider.id }; this.providers.set(provider.id, entry); this.saveToDatabase(entry); eventBus.emit("AIProviderRegistered", { providerId: provider.id, name: provider.name, models: [] }); log.info(comp, "registered", `Provider ${provider.id} registered as ${provider.name}`); }

  unregister(providerId: string): void { this.providers.delete(providerId); this.models.delete(providerId); this.db.prepare("DELETE FROM provider_registry WHERE id = ?").run(providerId); eventBus.emit("AIProviderUnregistered", { providerId }); log.info(comp, "unregistered", `Provider ${providerId} unregistered`); }

  getById(providerId: string) { return this.providers.get(providerId); }
  getByName(name: string) { return Array.from(this.providers.values()).find((p) => p.name === name); }
  getAll() { return Array.from(this.providers.values()); }
  getModels(providerId: string): ModelInfo[] { return this.models.get(providerId) ?? []; }
  setModels(providerId: string, models: ModelInfo[]): void { this.models.set(providerId, models); this.db.prepare("UPDATE provider_registry SET models = ? WHERE id = ?").run(JSON.stringify(models), providerId); }
  updateHealth(providerId: string, health: ProviderHealth): void { const registration = this.providers.get(providerId); if (!registration) return; this.db.prepare("UPDATE provider_registry SET health = ? WHERE id = ?").run(health, providerId); eventBus.emit("AIProviderHealthChanged", { providerId, health }); }

  private saveToDatabase(entry: { id: string; name: string; status: string; priority: number; endpoint: string | undefined; config: Record<string, unknown>; free: boolean; latency: number | null; circuitState: string; failures: number; lastVerified: number }): void { this.db.prepare(`INSERT OR REPLACE INTO provider_registry (id, name, status, health, endpoint, free, priority, latency, models, circuit_state, failures, last_verified, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(entry.id, entry.name, entry.status, entry.status === "HEALTHY" ? "HEALTHY" : "UNKNOWN", entry.endpoint, entry.free ? 1 : 0, entry.priority, entry.latency, "[]", entry.circuitState, entry.failures, entry.lastVerified, JSON.stringify(entry.config)); }
}
