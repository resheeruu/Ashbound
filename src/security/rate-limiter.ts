import { log } from "../logger";
import { config } from "../config/env";

const comp = "rate-limiter";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private windows: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.windows.get(key) || { count: 0, windowStart: now };

    if (now - entry.windowStart > this.windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }

    entry.count++;
    this.windows.set(key, entry);

    const remaining = Math.max(0, this.maxRequests - entry.count);
    const resetAt = entry.windowStart + this.windowMs;

    return { allowed: entry.count <= this.maxRequests, remaining, resetAt };
  }

  getStatus(key: string): { count: number; max: number; resetAt: number } {
    const entry = this.windows.get(key) || { count: 0, windowStart: Date.now() };
    return { count: entry.count, max: this.maxRequests, resetAt: entry.windowStart + this.windowMs };
  }
}

export const globalRateLimiter = new RateLimiter(20, 60000);
export const userRateLimiter = new RateLimiter(5, 60000);
export const aiRateLimiter = new RateLimiter(config.ai.maxConcurrentRequests, 60000);
