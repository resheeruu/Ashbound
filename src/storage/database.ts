import Database from "better-sqlite3";
import { log } from "../logger";
import { config } from "../config/env";
import path from "path";
import fs from "fs";
const comp = "database";
export class DatabaseManager {
  private db: Database.Database | null = null;
  getDb(): Database.Database {
    if (!this.db) {
      const dbPath = config.database.url.replace("file:", "");
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      this.db = new Database(dbPath);
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");
    }
    return this.db;
  }
  async migrate(): Promise<void> {
    const db = this.getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, host TEXT NOT NULL, port INTEGER NOT NULL, username TEXT NOT NULL, minecraftVersion TEXT NOT NULL, connectionState TEXT NOT NULL DEFAULT 'CREATED', agentState TEXT NOT NULL DEFAULT 'IDLE', autonomy TEXT NOT NULL DEFAULT 'ASSISTED', currentGoalId TEXT, createdAt TEXT NOT NULL, connectedAt TEXT, lastActivityAt TEXT NOT NULL); CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, description TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'CREATED', progress REAL NOT NULL DEFAULT 0, constraints TEXT, parentGoalId TEXT, createdAt TEXT NOT NULL, startedAt TEXT, completedAt TEXT, failureReason TEXT); CREATE TABLE IF NOT EXISTS episodic_memory (id TEXT PRIMARY KEY, sessionId TEXT, content TEXT NOT NULL, timestamp TEXT NOT NULL, metadata TEXT); CREATE TABLE IF NOT EXISTS semantic_memory (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 1.0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL); CREATE TABLE IF NOT EXISTS world_memory (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, location TEXT NOT NULL, value TEXT NOT NULL, createdAt TEXT NOT NULL);`);
  }
  close(): void { if (this.db) { this.db.close(); this.db = null; } }
}
export const databaseManager = new DatabaseManager();
