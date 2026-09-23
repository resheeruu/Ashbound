import { log } from "../logger";
import { eventBus } from "../events/bus";
import { config } from "../config/env";
import { ConnectionState } from "../events/types";
import type { Session } from "./session-model";

const comp = "session-manager";

interface SessionCreateData {
  ownerId: string;
  host: string;
  port: number;
  username: string;
  guildId: string;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private activeMinecraftSessions: Map<string, string> = new Map();

  create(data: SessionCreateData): Session {
    const sessionId = crypto.randomUUID();
    if (this.activeMinecraftSessions.has(data.guildId)) {
      throw new Error("SESSION_EXISTS: Guild already has an active session. Stop it first.");
    }
    if (this.sessions.size >= config.minecraft.maxSessions) {
      throw new Error("GLOBAL_LIMIT_REACHED: Maximum Minecraft sessions exceeded.");
    }
    const session: Session = {
      id: sessionId,
      ownerId: data.ownerId,
      host: data.host,
      port: data.port,
      username: data.username,
      guildId: data.guildId,
      minecraftVersion: config.minecraft.defaultVersion,
      connectionState: ConnectionState.CREATED,
      agentState: "IDLE",
      autonomy: config.autonomy,
      currentGoalId: null,
      createdAt: new Date().toISOString(),
      connectedAt: null,
      lastActivityAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, session);
    this.activeMinecraftSessions.set(data.guildId, sessionId);
    log.info(comp, "session_created", `Session ${sessionId} for guild ${data.guildId}`);
    eventBus.emit("SessionCreated", { sessionId, ownerId: data.ownerId, guildId: data.guildId } as any);
    return session;
  }

  get(id: string): Session | undefined { return this.sessions.get(id); }
  getAll(): Session[] { return [...this.sessions.values()]; }
  getByGuild(guildId: string): Session | undefined {
    const sessionId = this.activeMinecraftSessions.get(guildId);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  connect(sessionId: string, host: string, port: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.connectionState === ConnectionState.CONNECTED) {
      throw new Error("SESSION_ALREADY_CONNECTED");
    }
    session.connectionState = ConnectionState.CONNECTING;
    session.lastActivityAt = new Date().toISOString();
    eventBus.emit("MinecraftConnecting", { sessionId, host, port } as any);
  }

  connected(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.connectionState = ConnectionState.CONNECTED;
    session.connectedAt = new Date().toISOString();
    session.lastActivityAt = new Date().toISOString();
    eventBus.emit("MinecraftConnected", { sessionId } as any);
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.connectionState = ConnectionState.DISCONNECTED;
    session.connectedAt = null;
    session.lastActivityAt = new Date().toISOString();
    eventBus.emit("MinecraftDisconnected", { sessionId, reason: "manual" } as any);
  }

  stop(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.connectionState = ConnectionState.STOPPED;
    this.activeMinecraftSessions.delete(session.guildId);
    eventBus.emit("MinecraftDisconnected", { sessionId, reason: "stopped" } as any);
    log.info(comp, "session_stopped", `Session ${sessionId} stopped`);
  }

  hasActiveSession(guildId: string): boolean { return this.activeMinecraftSessions.has(guildId); }
  getActiveCount(): number { return this.sessions.size; }
}

export const sessionManager = new SessionManager();
