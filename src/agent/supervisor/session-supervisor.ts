import { log } from "../../logger";
import { eventBus } from "../../events/bus";
import { config } from "../../config/env";
import { sessionManager } from "../../sessions/session-manager";
import type { Session } from "../../sessions/session-model";

const comp = "session-supervisor";

export type SupervisorAction = "create" | "start" | "stop" | "pause" | "resume" | "restart" | "reconnect" | "destroy";

export interface SupervisorResult {
  success: boolean;
  sessionId: string;
  action: SupervisorAction;
  message: string;
}

export class SessionSupervisor {
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 5000;

  async createSession(data: { ownerId: string; host: string; port: number; username: string; guildId: string }): Promise<SupervisorResult> {
    if (sessionManager.hasActiveSession(data.guildId)) {
      const existing = sessionManager.getByGuild(data.guildId);
      if (existing) {
        await this.stopSession(existing.id);
      }
    }
    try {
      const session = sessionManager.create(data);
      return { success: true, sessionId: session.id, action: "create", message: "Session created" };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      log.error(comp, "create_failed", error);
      return { success: false, sessionId: "", action: "create", message: error };
    }
  }

  async stopSession(sessionId: string): Promise<SupervisorResult> {
    const session = sessionManager.get(sessionId);
    if (!session) return { success: false, sessionId, action: "stop", message: "Session not found" };
    sessionManager.stop(sessionId);
    return { success: true, sessionId, action: "stop", message: "Session stopped" };
  }

  async restartSession(sessionId: string): Promise<SupervisorResult> {
    const session = sessionManager.get(sessionId);
    if (!session) return { success: false, sessionId, action: "restart", message: "Session not found" };
    await this.stopSession(sessionId);
    await new Promise((r) => setTimeout(r, this.retryDelayMs));
    const restarted = sessionManager.create({
      ownerId: session.ownerId, host: session.host, port: session.port,
      username: session.username, guildId: session.guildId,
    });
    return { success: true, sessionId: restarted.id, action: "restart", message: "Session restarted" };
  }

  async reconnectSession(sessionId: string): Promise<SupervisorResult> {
    const session = sessionManager.get(sessionId);
    if (!session) return { success: false, sessionId, action: "reconnect", message: "Session not found" };
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        sessionManager.connect(sessionId, session.host, session.port);
        sessionManager.connected(sessionId);
        return { success: true, sessionId, action: "reconnect", message: "Reconnected" };
      } catch {
        attempt++;
        if (attempt >= this.maxRetries) break;
        await new Promise((r) => setTimeout(r, this.retryDelayMs));
      }
    }
    return { success: false, sessionId, action: "reconnect", message: "Max retries exceeded" };
  }

  getSession(sessionId: string): Session | undefined { return sessionManager.get(sessionId); }
  getAllSessions(): Session[] { return sessionManager.getAll(); }
}

export const sessionSupervisor = new SessionSupervisor();
