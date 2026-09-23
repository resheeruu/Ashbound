import { log } from "../logger";
import { CircuitBreaker } from "./circuit-breaker";
import { ProviderHealthMonitor } from "./health-monitor";
import { ProviderQuotaManager } from "./quota-manager";
import { ProviderFallbackManager } from "./fallback-manager";
import { ProviderHealth } from "../events/types";

const comp = "ai/router";

export class ProviderRouter {
  private static instance: ProviderRouter;
  circuitBreaker: CircuitBreaker;
  healthMonitor: ProviderHealthMonitor;
  quotaManager: ProviderQuotaManager;
  fallbackManager: ProviderFallbackManager;

  private constructor() { this.circuitBreaker = CircuitBreaker.getInstance(); this.healthMonitor = ProviderHealthMonitor.getInstance(); this.quotaManager = ProviderQuotaManager.getInstance(); this.fallbackManager = ProviderFallbackManager.getInstance(); }

  static getInstance(): ProviderRouter { if (!ProviderRouter.instance) ProviderRouter.instance = new ProviderRouter(); return ProviderRouter.instance; }

  async route(provider: { id: string; name: string; generate: (req: any) => Promise<any> }, request: any, guildId: string, userId: string): Promise<any> {
    const role = this.inferRole(request);
    const quota = this.quotaManager.checkQuota(guildId, userId, role);
    if (!quota.allowed) throw new Error(`QUOTA_EXCEEDED: Rate limit exceeded for guild ${guildId}, user ${userId}`);
    if (!this.circuitBreaker.canExecute(provider.id)) throw new Error(`CIRCUIT_OPEN: Provider ${provider.id} circuit is open`);
    if (!this.healthMonitor.isHealthy(provider.id)) throw new Error(`HEALTH_CHECK_FAILED: Provider ${provider.id} is not healthy`);
    const startTime = Date.now();
    try { const response = await provider.generate(request); const duration = Date.now() - startTime; this.quotaManager.recordRequest(guildId, userId, role, response.usage?.totalTokens ?? 0); this.circuitBreaker.recordSuccess(provider.id); this.healthMonitor.recordSuccess(provider.id, duration); return response; } catch (e) { const duration = Date.now() - startTime; const error = e instanceof Error ? e.message : String(e); this.quotaManager.recordRequest(guildId, userId, role); this.circuitBreaker.recordFailure(provider.id); this.healthMonitor.recordFailure(provider.id); throw new Error(`ROUTER_ERROR: ${error}`); }
  }

  async routeWithFallback(provider: any, request: any, guildId: string, userId: string, requestType: string): Promise<any> { let currentProvider = provider; let lastError: Error | null = null; const chain = this.fallbackManager.getFallbackChain(requestType); for (const chainEntry of chain) { try { const p = chainEntry.providerId === currentProvider.id ? currentProvider : { ...currentProvider, id: chainEntry.providerId }; const response = await this.route(p, request, guildId, userId); return response; } catch (e) { lastError = e instanceof Error ? e : new Error(String(e)); const nextProvider = this.fallbackManager.getNextProvider(currentProvider.id, requestType); if (!nextProvider) break; log.info(comp, "fallback_attempt", `Falling back from ${currentProvider.id} to ${nextProvider}`); currentProvider = { ...currentProvider, id: nextProvider }; } } throw lastError ?? new Error("All fallback providers failed"); }

  getAvailableProviders(): string[] { return this.healthMonitor.getHealthyProviders(); }
  inferRole(request: any): string { if (request.tools && request.tools.length > 0) return "planning"; return "conversation"; }
}
