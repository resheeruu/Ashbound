import { log } from "../logger";
import { databaseManager } from "../storage/database";
import { eventBus } from "../events/bus";
const comp = "memory";
export interface EpisodicMemoryEntry { id: string; sessionId: string | null; content: string; timestamp: string; metadata: Record<string, unknown> | null; }
export class MemoryManager {
  async saveEpisodic(sessionId: string | null, content: string, metadata?: Record<string, unknown>): Promise<void> {
    const db = databaseManager.getDb();
    db.prepare("INSERT INTO episodic_memory (id, sessionId, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?)").run(crypto.randomUUID(), sessionId, content, new Date().toISOString(), JSON.stringify(metadata || {}));
  }
  async getEpisodic(sessionId?: string): Promise<EpisodicMemoryEntry[]> {
    const db = databaseManager.getDb();
    return db.prepare(sessionId ? "SELECT * FROM episodic_memory WHERE sessionId = ? ORDER BY timestamp DESC" : "SELECT * FROM episodic_memory ORDER BY timestamp DESC").all(sessionId) as EpisodicMemoryEntry[];
  }
  async saveMemory(content: string): Promise<void> { await this.saveEpisodic(null, content); log.info(comp, "memory", "Saved: " + content.slice(0, 80)); }
}
export const memoryManager = new MemoryManager();
