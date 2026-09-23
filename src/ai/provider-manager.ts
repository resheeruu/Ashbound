import { log } from "../logger";
import { ProviderRegistry } from "./registry";
import { ProviderRouter } from "./router";
import { ProviderQuotaManager } from "./quota-manager";
import { ProviderHealthMonitor } from "./health-monitor";
import { CircuitBreaker } from "./circuit-breaker";
import { ProviderFallbackManager } from "./fallback-manager";
import { ProviderHealth } from "../events/types";
import { AIProvider, GenerateRequest, GenerateResponse, ModelInfo, ProviderRegistration } from "./interfaces";

const comp = "ai/provider-manager";

export class ProviderManager {
  private static instance: ProviderManager;
  registry: ProviderRegistry;
  router: ProviderRouter;
  quotaManager: ProviderQuotaManager;
  healthMonitor: ProviderHealthMonitor;
  circuitBreaker: CircuitBreaker;
  fallbackManager: ProviderFallbackManager;
  private initialized = false;
  private providerInstances: Map<string, AIProvider> = new Map();

  private constructor() { this.registry = ProviderRegistry.getInstance(); this.router = ProviderRouter.getInstance(); this.quotaManager = ProviderQuotaManager.getInstance(); this.healthMonitor = ProviderHealthMonitor.getInstance(); this.circuitBreaker = CircuitBreaker.getInstance(); this.fallbackManager = ProviderFallbackManager.getInstance(); }

  static getInstance(): ProviderManager { if (!ProviderManager.instance) ProviderManager.instance = new ProviderManager(); return ProviderManager.instance; }

  async initialize(): Promise<void> { if (this.initialized) return; log.info(comp, "initialize", "Initializing ProviderManager"); this.healthMonitor.startPeriodicCheck(); this.initialized = true; log.info(comp, "initialized", "ProviderManager initialized successfully"); }

  registerProvider(provider: AIProvider, priority = 1, status = "UNKNOWN"): void { this.providerInstances.set(provider.id, provider); this.registry.register(provider, { name: provider.name, status, priority, endpoint: undefined, config: {}, free: false }); log.info(comp, "provider_registered", `Provider ${provider.id} registered`); }

  getProvider(providerId: string): AIProvider | undefined { return this.providerInstances.get(providerId); }

  async generate(request: GenerateRequest, guildId: string, userId: string): Promise<GenerateResponse> { await this.ensureInitialized(); const providerId = this.getPreferredProviderId(request); if (!providerId) throw new Error("No providers available"); const provider = this.providerInstances.get(providerId); if (!provider) throw new Error(`Provider ${providerId} not found`); return this.router.route(provider, request, guildId, userId); }

  async generateStructured<T>(request: any, guildId: string, userId: string): Promise<T> { const response = await this.generate(request, guildId, userId); try { return JSON.parse(response.content) as T; } catch { return response.content as unknown as T; } }

  async checkHealth(providerId: string) { const provider = this.registry.getById(providerId); if (!provider) throw new Error(`Provider ${providerId} not found`); return { healthy: true, latencyMs: 0, status: ProviderHealth.HEALTHY, message: "OK", timestamp: Date.now() }; }

  getHealthMetrics() { return this.healthMonitor.getAllMetrics().map((m) => ({ providerId: m.providerId, status: m.status, latencyMs: m.latencyMs, consecutiveFailures: m.consecutiveFailures })); }
  getAvailableProviders(): string[] { return this.healthMonitor.getHealthyProviders(); }
  getQuotaStatus(guildId: string, userId: string) { return this.quotaManager.getUsage(guildId, userId); }
  getFallbackChain(requestType: string) { return this.fallbackManager.getFallbackChain(requestType); }
  setFallbackChain(requestType: string, chain: any[]) { this.fallbackManager.setFallbackChain(requestType, chain); }
  shutdown(): void { this.healthMonitor.stopPeriodicCheck(); log.info(comp, "shutdown", "ProviderManager shut down"); }

  private async ensureInitialized(): Promise<void> { if (!this.initialized) await this.initialize(); }
  private getPreferredProviderId(request: any): string | null { const healthy = this.getAvailableProviders(); if (healthy.length === 0) return null; return healthy[0]; }
}
