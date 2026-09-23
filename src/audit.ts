import { log } from "./logger";
import { databaseManager } from "./storage/database";
import { eventBus } from "./events/bus";
import { AuditEventType } from "./events/types";

const comp = "audit";

export class AuditLogger {
  private static instance: AuditLogger;

  private constructor() {}

  static getInstance(): AuditLogger { if (!AuditLogger.instance) AuditLogger.instance = new AuditLogger(); return AuditLogger.instance; }

  log(eventType: AuditEventType, userId: string | null, guildId: string | null, sessionId: string | null, action: string, authorizationResult: boolean, result: string, provider: string | null, details: Record<string, unknown> | null): void {
    const entry = { id: crypto.randomUUID(), eventType, userId, guildId, sessionId, action, authorizationResult, result, provider: provider ?? null, timestamp: Date.now(), details };
    try { const db = databaseManager.getDb(); db.prepare(`INSERT INTO audit_log (id, event_type, user_id, guild_id, session_id, action, authorization_result, result, provider, timestamp, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(entry.id, entry.eventType, entry.userId, entry.guildId, entry.sessionId, entry.action, entry.authorizationResult ? 1 : 0, entry.result, entry.provider, entry.timestamp, JSON.stringify(entry.details ?? {})); } catch (e) { log.error(comp, "log", `Failed to write audit entry: ${e}`); }
    if (eventType === AuditEventType.SECURITY_ALERT) { eventBus.emit("ResourceCritical", { resource: "security", eventType, userId, action }); }
  }

  getAuditLog(guildId: string | null, filter: AuditEventType | null, limit = 100): any[] {
    try { const db = databaseManager.getDb(); let query = "SELECT * FROM audit_log WHERE 1=1"; const params: any[] = []; if (guildId) { query += " AND guild_id = ?"; params.push(guildId); } if (filter) { query += " AND event_type = ?"; params.push(filter); } query += " ORDER BY timestamp DESC LIMIT ?"; params.push(limit); return db.prepare(query).all(...params); } catch (e) { log.error(comp, "getAuditLog", `Failed to retrieve audit log: ${e}`); return []; }
  }

  exportAuditLog(guildId: string | null, limit = 10000): string { const entries = this.getAuditLog(guildId, null, limit); const header = "id,eventType,userId,guildId,sessionId,action,authorizationResult,result,provider,timestamp,details\n"; return entries.map((e: any) => [e.id, e.eventType, e.userId ?? "", e.guildId ?? "", e.sessionId ?? "", e.action, e.authorization_result, e.result, e.provider ?? "", e.timestamp, (e.details ?? "").replace(/"/g, '""')].join(",")).join("\n"); }
}

export const auditLogger = AuditLogger.getInstance();
