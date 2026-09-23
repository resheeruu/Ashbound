import { log } from "../logger";
import { eventBus } from "../events/bus";
import { ProviderHealthMonitor } from "./health-monitor";
import { ProviderHealth } from "../events/types";

const comp = "ai/fallback-manager";

export class ProviderFallbackManager {
  private static instance: ProviderFallbackManager;
  fallbackChains: Map<string, FallbackChainEntry[]> = new Map();
  private healthMonitor: ProviderHealthMonitor;

  private constructor() { this.healthMonitor = ProviderHealthMonitor.getInstance(); }

  static getInstance(): ProviderFallbackManager { if (!ProviderFallbackManager.instance) ProviderFallbackManager.instance = new ProviderFallbackManager(); return ProviderFallbackManager.instance; }

  setFallbackChain(requestType: string, chain: FallbackChainEntry[]): void { this.fallbackChains.set(requestType, chain.sort((a, b) => a.priority - b.priority)); log.info(comp, "fallback_set", `Fallback chain for ${requestType}: ${chain.map((c) => c.providerId).join(" -> ")}`); }

  getFallbackChain(requestType: string): FallbackChainEntry[] { return this.fallbackChains.get(requestType) ?? this.getDefaultChain(requestType); }

  getNextProvider(failedProviderId: string, requestType: string): string | null { const chain = this.getFallbackChain(requestType); const failedIndex = chain.findIndex((c) => c.providerId === failedProviderId); for (let i = failedIndex + 1; i < chain.length; i++) { const next = chain[i]; const metrics = this.healthMonitor.getStatus(next.providerId); if (metrics.status === ProviderHealth.HEALTHY || metrics.status === ProviderHealth.DEGRADED) { log.info(comp, "fallback", `Falling back from ${failedProviderId} to ${next.providerId}`); eventBus.emit("AIFallbackTriggered", { fromProvider: failedProviderId, toProvider: next.providerId, reason: next.reason }); return next.providerId; } } log.warn(comp, "no_fallback", `No healthy fallback available for ${requestType} after ${failedProviderId} failed`); return null; }

  addToChain(requestType: string, providerId: string, priority: number, reason: string): void { const chain = this.fallbackChains.get(requestType) ?? []; chain.push({ providerId, priority, reason }); chain.sort((a, b) => a.priority - b.priority); this.fallbackChains.set(requestType, chain); log.info(comp, "chain_updated", `Added ${providerId} to ${requestType} fallback chain at priority ${priority}`); }

  removeFromChain(requestType: string, providerId: string): void { const chain = this.fallbackChains.get(requestType); if (chain) this.fallbackChains.set(requestType, chain.filter((c) => c.providerId !== providerId)); }

  private getDefaultChain(requestType: string): FallbackChainEntry[] { const defaults: Record<string, FallbackChainEntry[]> = { planning: [{ providerId: "openai", priority: 1, reason: "Primary planning provider" }, { providerId: "anthropic", priority: 2, reason: "Fallback planning provider" }], conversation: [{ providerId: "openai", priority: 1, reason: "Primary conversation provider" }, { providerId: "anthropic", priority: 2, reason: "Fallback conversation provider" }], evaluation: [{ providerId: "openai", priority: 1, reason: "Primary evaluation provider" }, { providerId: "anthropic", priority: 2, reason: "Fallback evaluation provider" }], }; const chain = defaults[requestType] ?? defaults.conversation; this.fallbackChains.set(requestType, chain); return chain; }
}

export interface FallbackChainEntry { providerId: string; priority: number; reason: string; }
