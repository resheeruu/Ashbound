import { log } from "../logger";
import { ProviderHealth, ModelInfo } from "./types";
type Handler<T = unknown> = (data: T) => void | Promise<void>;
export interface EventMap {
  "DiscordConnected": { guildId: string }; "DiscordDisconnected": { reason: string };
  "MinecraftConnecting": { host: string; port: number; username: string };
  "MinecraftConnected": { sessionId: string; host: string; port: number };
  "MinecraftDisconnected": { sessionId: string; reason: string };
  "MinecraftReconnecting": { sessionId: string; attempt: number };
  "GoalCreated": { goalId: string; description: string }; "GoalStarted": { goalId: string };
  "GoalCompleted": { goalId: string }; "GoalFailed": { goalId: string; reason: string };
  "GoalCancelled": { goalId: string }; "GoalProgressed": { goalId: string; progress: number };
  "AgentActionStarted": { actionId: string; tool: string; args: unknown };
  "AgentActionCompleted": { actionId: string; result: unknown }; "AgentActionFailed": { actionId: string; error: string };
  "SessionCreated": { sessionId: string; ownerId: string }; "SessionStopped": { sessionId: string };
  "SessionConnected": { sessionId: string }; "SessionDisconnected": { sessionId: string; reason: string };
  "SessionReconnecting": { sessionId: string; attempt: number };
  "AIProviderFailed": { providerId: string; error: string };
  "AIProviderHealthChanged": { providerId: string; health: ProviderHealth };
  "AIFallbackTriggered": { fromProvider: string; toProvider: string; reason: string };
  "AIProviderRegistered": { providerId: string; name: string; models: ModelInfo[] };
  "AIProviderUnregistered": { providerId: string };
  "AIRequestStarted": { providerId: string; model: string };
  "AIRequestCompleted": { providerId: string; model: string; duration: number; tokensUsed: number };
  "ResourceWarning": { resource: string; percent: number; level: ResourceLevel };
  "ResourceCritical": { resource: string; percent: number; level: ResourceLevel };
  "PermissionChanged": { guildId: string; userId: string; role: GuildRole };
  "SettingChanged": { guildId: string; key: string; value: unknown };
  "Shutdown": { reason: string }; "ServerStarted": { port: number };
}
export class EventBus {
  private handlers: Map<string, Set<Handler>> = new Map();
  private readonly c = "events";
  on<K extends keyof EventMap>(event: K, handler: Handler): void { if (!this.handlers.has(event)) this.handlers.set(event, new Set()); this.handlers.get(event)!.add(handler as Handler); log.debug(this.c, "handler_registered", `Handler for ${event}`); }
  off<K extends keyof EventMap>(event: K, handler: Handler): void { const s = this.handlers.get(event); if (s) { s.delete(handler as Handler); if (s.size === 0) this.handlers.delete(event); } }
  async emit<K extends keyof EventMap>(event: K, data: EventMap[K]): Promise<void> { const h = this.handlers.get(event); if (!h) return; await Promise.allSettled([...h].map((fn) => Promise.resolve(fn(data)))); }
  removeAllListeners(): void { this.handlers.clear(); log.info(this.c, "all_listeners_removed", "Removed all listeners"); }
  listenerCount(event: string): number { return this.handlers.get(event)?.size ?? 0; }
}
export const eventBus = new EventBus();
