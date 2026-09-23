import { log } from "../logger";
import { eventBus } from "../events/bus";
import { databaseManager } from "../storage/database";

const comp = "ai/quota-manager";

export class ProviderQuotaManager {
  private static instance: ProviderQuotaManager;
  private db: ReturnType<typeof databaseManager.getDb>;
  private defaultLimits = { requestsPerMinute: 60, requestsPerHour: 1000, tokensPerDay: 100000 };

  private constructor() { this.db = databaseManager.getDb(); }

  static getInstance(): ProviderQuotaManager { if (!ProviderQuotaManager.instance) ProviderQuotaManager.instance = new ProviderQuotaManager(); return ProviderQuotaManager.instance; }

  checkQuota(guildId: string, userId: string, role = "conversation"): any {
    const now = Date.now();
    const windowStart = Math.floor(now / 60000) * 60000;
    let quota = this.db.prepare("SELECT * FROM ai_quota WHERE guild_id = ? AND user_id = ?").get(guildId, userId) as any;
    if (!quota) { this.db.prepare(`INSERT INTO ai_quota (id, guild_id, user_id, requests_minute, requests_hour, tokens_day, planning_requests, conversation_requests, evaluation_requests, window_start) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, ?)`).run(`${guildId}:${userId}`, guildId, userId, windowStart); quota = this.db.prepare("SELECT * FROM ai_quota WHERE guild_id = ? AND user_id = ?").get(guildId, userId); }
    const currentWindowStart = Math.floor(now / 60000) * 60000;
    if (quota.window_start !== currentWindowStart) { this.db.prepare("UPDATE ai_quota SET requests_minute = 0, requests_hour = ?, window_start = ? WHERE guild_id = ? AND user_id = ?").run(quota.requests_hour, currentWindowStart, guildId, userId); quota.requests_minute = 0; quota.window_start = currentWindowStart; }
    const limits = this.getLimits(guildId);
    const allowed = quota.requests_minute < limits.requestsPerMinute && quota.requests_hour < limits.requestsPerHour && quota.tokens_day < limits.tokensPerDay;
    const status = { guildId, userId, requestsMinute: quota.requests_minute, requestsHour: quota.requests_hour, tokensDay: quota.tokens_day, planningRequests: quota.planning_requests, conversationRequests: quota.conversation_requests, evaluationRequests: quota.evaluation_requests, windowStart: quota.window_start, allowed, resetInMs: Math.max(0, (windowStart + 60000) - now) };
    if (!allowed) eventBus.emit("AIProviderFailed", { providerId: "quota", error: "Quota exceeded" });
    return status;
  }

  recordRequest(guildId: string, userId: string, role = "conversation", tokensUsed = 0): void { const now = Date.now(); const windowStart = Math.floor(now / 60000) * 60000; const quota = this.db.prepare("SELECT * FROM ai_quota WHERE guild_id = ? AND user_id = ?").get(guildId, userId) as any; if (!quota) { this.db.prepare(`INSERT INTO ai_quota (id, guild_id, user_id, requests_minute, requests_hour, tokens_day, planning_requests, conversation_requests, evaluation_requests, window_start) VALUES (?, ?, ?, 1, 1, ?, 0, 1, 0, ?)`).run(`${guildId}:${userId}`, guildId, userId, tokensUsed, windowStart); return; } const currentWindowStart = Math.floor(now / 60000) * 60000; const newMinute = quota.window_start !== currentWindowStart ? 1 : quota.requests_minute + 1; const newHour = quota.window_start !== currentWindowStart ? 1 : quota.requests_hour + 1; const newTokens = quota.window_start !== currentWindowStart ? tokensUsed : quota.tokens_day + tokensUsed; const planningRequests = role === "planning" ? (quota.planning_requests + 1) : quota.planning_requests; const conversationRequests = role === "conversation" ? (quota.conversation_requests + 1) : quota.conversation_requests; const evaluationRequests = role === "evaluation" ? (quota.evaluation_requests + 1) : quota.evaluation_requests; this.db.prepare(`UPDATE ai_quota SET requests_minute = ?, requests_hour = ?, tokens_day = ?, planning_requests = ?, conversation_requests = ?, evaluation_requests = ?, window_start = ? WHERE guild_id = ? AND user_id = ?`).run(newMinute, newHour, newTokens, planningRequests, conversationRequests, evaluationRequests, currentWindowStart, guildId, userId); }

  getUsage(guildId: string, userId: string): any { return this.checkQuota(guildId, userId); }
  setLimits(guildId: string, limits: any): void { this.db.prepare("INSERT OR REPLACE INTO quota_limits (guild_id, requests_per_minute, requests_per_hour, tokens_per_day) VALUES (?, ?, ?, ?)").run(guildId, limits.requestsPerMinute, limits.requestsPerHour, limits.tokensPerDay); }
  getLimits(guildId: string): any { const row = this.db.prepare("SELECT * FROM quota_limits WHERE guild_id = ?").get(guildId); return row ? { requestsPerMinute: row.requests_per_minute, requestsPerHour: row.requests_per_hour, tokensPerDay: row.tokens_per_day } : this.defaultLimits; }
}
