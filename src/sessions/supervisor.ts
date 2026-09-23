import { log } from "../logger";
import { eventBus } from "../events/bus";
import { sessionManager } from "./session-manager";
import { guildManager } from "./guild-manager";
import { GuildRole } from "../events/types";

const comp = "session-supervisor";

export class SessionSupervisor {
  private static instance: SessionSupervisor;

  private constructor() {}

  static getInstance(): SessionSupervisor {
    if (!SessionSupervisor.instance) SessionSupervisor.instance = new SessionSupervisor();
    return SessionSupervisor.instance;
  }

  async createSession(data: { ownerId: string; host: string; port: number; username: string; guildId: string }): Promise<{ success: boolean; sessionId: string; message: string }> {
    const guild = guildManager.getGuild(data.guildId);
    if (!guild) return { success: false, sessionId: "", message: "Guild not found" };
    if (!guildManager.hasRole(data.guildId, data.ownerId, GuildRole.OPERATOR)) {
      return { success: false, sessionId: "", message: "Not authorized to create session" };
    }
    try {
      const existing = sessionManager.getByGuild(data.guildId);
      if (existing) {
        await this.stopSession(existing.id);
      }
      const session = sessionManager.create(data);
      log.info(comp, "createSession", `Session ${session.id} created for guild ${data.guildId}`);
      return { success: true, sessionId: session.id, message: "Session created" };
    } catch (e: any) {
      return { success: false, sessionId: "", message: e.message };
    }
  }

  async stopSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    const session = sessionManager.get(sessionId);
    if (!session) return { success: false, message: "Session not found" };
    sessionManager.stop(sessionId);
    return { success: true, message: "Session stopped" };
  }

  async restartSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    const session = sessionManager.get(sessionId);
    if (!session) return { success: false, message: "Session not found" };
    await this.stopSession(sessionId);
    const restarted = sessionManager.create({
      ownerId: session.ownerId, host: session.host, port: session.port,
      username: session.username, guildId: session.guildId,
    });
    return { success: true, message: "Session restarted" };
  }

  async reconnectSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    const session = sessionManager.get(sessionId);
    if (!session) return { success: false, message: "Session not found" };
    try {
      sessionManager.connect(sessionId, session.host, session.port);
      sessionManager.connected(sessionId);
      return { success: true, message: "Reconnected" };
    } catch { return { success: false, message: "Reconnection failed" }; }
  }

  getSession(sessionId: string) { return sessionManager.get(sessionId); }
  getAllSessions() { return sessionManager.getAll(); }
  getSessionByGuild(guildId: string) { return sessionManager.getByGuild(guildId); }
}

export const sessionSupervisor = SessionSupervisor.getInstance();
