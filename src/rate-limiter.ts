import { log } from "../logger";
import { config } from "../config/env";
import { eventBus } from "../events/bus";

export enum RateLimitBucket { GLOBAL = "global", USER = "user", GUILD = "guild", COMMAND = "command", AI = "ai", MINECRAFT_ACTION = "minecraft_action" }

interface RateLimitEntry { count: number; windowStart: number; }

export class RateLimiter {
  private static instance: RateLimiter;
  private buckets: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 20, windowMs = 60000) { this.maxRequests = maxRequests; this.windowMs = windowMs; }

  static getInstance(): RateLimiter { if (!RateLimiter.instance) RateLimiter.instance = new RateLimiter(20, 60000); return RateLimiter.instance; }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.buckets.get(key) || { count: 0, windowStart: now };
    if (now - entry.windowStart > this.windowMs) { entry.count = 0; entry.windowStart = now; }
    entry.count++; this.buckets.set(key, entry);
    const remaining = Math.max(0, this.maxRequests - entry.count);
    return { allowed: entry.count <= this.maxRequests, remaining, resetAt: entry.windowStart + this.windowMs };
  }

  getStatus(key: string): { count: number; max: number; resetAt: number } {
    const entry = this.buckets.get(key) || { count: 0, windowStart: Date.now() };
    return { count: entry.count, max: this.maxRequests, resetAt: entry.windowStart + this.windowMs };
  }

  getGlobalLimit(): { allowed: boolean } { return this.check("global"); }
  getUserLimit(userId: string): { allowed: boolean } { return this.check(`user:${userId}`); }
  getGuildLimit(guildId: string): { allowed: boolean } { return this.check(`guild:${guildId}`); }
  getCommandLimit(commandName: string): { allowed: boolean } { return this.check(`command:${commandName}`); }
  getAIRateLimit(guildId: string): { allowed: boolean } { return this.check(`ai:${guildId}`); }
  getMinecraftActionLimit(sessionId: string): { allowed: boolean } { return this.check(`minecraft:${sessionId}`); }
}

export const globalRateLimiter = new RateLimiter(20, 60000);
export const userRateLimiter = new RateLimiter(5, 60000);
export const commandRateLimiter = new RateLimiter(10, 60000);
