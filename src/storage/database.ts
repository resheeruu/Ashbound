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
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, host TEXT NOT NULL, port INTEGER NOT NULL, username TEXT NOT NULL, minecraftVersion TEXT NOT NULL, connectionState TEXT NOT NULL DEFAULT 'CREATED', agentState TEXT NOT NULL DEFAULT 'IDLE', autonomy TEXT NOT NULL DEFAULT 'ASSISTED', currentGoalId TEXT, createdAt TEXT NOT NULL, connectedAt TEXT, lastActivityAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, description TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'CREATED', progress REAL NOT NULL DEFAULT 0, constraints TEXT, parentGoalId TEXT, createdAt TEXT NOT NULL, startedAt TEXT, completedAt TEXT, failureReason TEXT);
      CREATE TABLE IF NOT EXISTS episodic_memory (id TEXT PRIMARY KEY, sessionId TEXT, content TEXT NOT NULL, timestamp TEXT NOT NULL, metadata TEXT);
      CREATE TABLE IF NOT EXISTS semantic_memory (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 1.0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS world_memory (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, location TEXT NOT NULL, value TEXT NOT NULL, createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS provider_registry (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL, health TEXT, endpoint TEXT, free INTEGER NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 1, latency INTEGER, models TEXT, circuit_state TEXT NOT NULL DEFAULT 'CLOSED', failures INTEGER NOT NULL DEFAULT 0, last_verified INTEGER NOT NULL, config TEXT NOT NULL DEFAULT '{}');
      CREATE TABLE IF NOT EXISTS circuit_breaker (provider_id TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'CLOSED', failure_count INTEGER NOT NULL DEFAULT 0, success_count INTEGER NOT NULL DEFAULT 0, last_failure_time INTEGER NOT NULL DEFAULT 0, next_try_time INTEGER NOT NULL DEFAULT 0, cooldown_ms INTEGER NOT NULL DEFAULT 30000, threshold INTEGER NOT NULL DEFAULT 5, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS provider_health (provider_id TEXT PRIMARY KEY, status TEXT NOT NULL, latency_ms INTEGER NOT NULL DEFAULT 0, failure_count INTEGER NOT NULL DEFAULT 0, success_count INTEGER NOT NULL DEFAULT 0, total_requests INTEGER NOT NULL DEFAULT 0, last_check INTEGER NOT NULL DEFAULT 0, consecutive_failures INTEGER NOT NULL DEFAULT 0, avg_latency_ms INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ai_quota (id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, user_id TEXT NOT NULL, requests_minute INTEGER NOT NULL DEFAULT 0, requests_hour INTEGER NOT NULL DEFAULT 0, tokens_day INTEGER NOT NULL DEFAULT 0, planning_requests INTEGER NOT NULL DEFAULT 0, conversation_requests INTEGER NOT NULL DEFAULT 0, evaluation_requests INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS quota_limits (guild_id TEXT PRIMARY KEY, requests_per_minute INTEGER NOT NULL DEFAULT 60, requests_per_hour INTEGER NOT NULL DEFAULT 1000, tokens_per_day INTEGER NOT NULL DEFAULT 100000);
      CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, guild_id TEXT, session_id TEXT, action TEXT NOT NULL, authorization_result INTEGER NOT NULL DEFAULT 0, result TEXT, provider TEXT, timestamp INTEGER NOT NULL, details TEXT);
      CREATE TABLE IF NOT EXISTS guilds (guild_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, members TEXT NOT NULL DEFAULT '[]', permissions TEXT NOT NULL DEFAULT '{}', settings TEXT NOT NULL DEFAULT '{}', session_id TEXT, response_mode TEXT NOT NULL DEFAULT 'MENTION_ONLY', logging_preference TEXT NOT NULL DEFAULT 'INFO', allowed_channels TEXT NOT NULL DEFAULT '[]', allowed_roles TEXT NOT NULL DEFAULT '[]', autonomy_mode TEXT NOT NULL DEFAULT 'ASSISTED', created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY, key_type TEXT NOT NULL, key_value TEXT NOT NULL, limit INTEGER NOT NULL, window_ms INTEGER NOT NULL, requests TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL);
    `);
  }
  close(): void { if (this.db) { this.db.close(); this.db = null; } }
}
export const databaseManager = new DatabaseManager();
