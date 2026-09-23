import Database from "better-sqlite3";
import { config } from "../../config/env";
import path from "path";
import fs from "fs";
let dbInstance: Database.Database | null = null;
function getDb(): Database.Database {
  if (!dbInstance) {
    const dbPath = config.database.url.replace("file:", "");
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    dbInstance = new Database(dbPath);
    dbInstance.pragma("journal_mode = WAL");
    dbInstance.pragma("foreign_keys = ON");
  }
  return dbInstance;
}
export interface Session { id: string; ownerId: string; host: string; port: number; username: string; minecraftVersion: string; connectionState: string; agentState: string; autonomy: string; currentGoalId: string | null; createdAt: string; connectedAt: string | null; lastActivityAt: string; }
export interface CreateSessionData { ownerId: string; host: string; port: number; username: string; minecraftVersion: string; }
export class SessionRepository {
  create(data: CreateSessionData): Session {
    const db = getDb();
    const s: Session = { ...data, id: crypto.randomUUID(), connectionState: "CREATED", agentState: "IDLE", autonomy: "ASSISTED", currentGoalId: null, createdAt: new Date().toISOString(), connectedAt: null, lastActivityAt: new Date().toISOString() };
    db.prepare(`INSERT INTO sessions (id, ownerId, host, port, username, minecraftVersion, connectionState, agentState, autonomy, currentGoalId, createdAt, connectedAt, lastActivityAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(s.id, s.ownerId, s.host, s.port, s.username, s.minecraftVersion, s.connectionState, s.agentState, s.autonomy, s.currentGoalId, s.createdAt, s.connectedAt, s.lastActivityAt);
    return s;
  }
  getById(id: string): Session | undefined { return getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Session | undefined; }
  updateState(id: string, updates: Partial<Session>): void {
    const db = getDb();
    const fields = Object.keys(updates).filter((k) => k !== "id");
    const values = fields.map((f) => updates[f as keyof Session]);
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    db.prepare(`UPDATE sessions SET ${setClause} WHERE id = ?`).run(...values, id);
  }
  getAll(): Session[] { return getDb().prepare("SELECT * FROM sessions ORDER BY createdAt DESC").all() as Session[]; }
}
export const sessionRepository = new SessionRepository();
