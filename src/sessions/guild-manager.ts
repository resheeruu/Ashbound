import { log } from "../logger";
import { eventBus } from "../events/bus";
import { GuildRole } from "../events/types";
import { databaseManager } from "../storage/database";

const comp = "guild-manager";

export class GuildManager {
  private static instance: GuildManager;
  guilds: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): GuildManager {
    if (!GuildManager.instance) GuildManager.instance = new GuildManager();
    return GuildManager.instance;
  }

  async createGuild(guildId: string, ownerId: string): Promise<any> {
    if (this.guilds.has(guildId)) throw new Error(`Guild ${guildId} already exists`);
    const now = Date.now();
    const guild = {
      guildId, ownerId,
      members: new Map([[ownerId, GuildRole.OWNER]]),
      permissions: {}, settings: {},
      sessionId: null,
      responseMode: "MENTION_ONLY",
      loggingPreference: "INFO",
      allowedChannels: [],
      allowedRoles: [],
      autonomyMode: "ASSISTED",
      createdAt: now,
    };
    this.guilds.set(guildId, guild);
    try {
      const db = databaseManager.getDb();
      db.prepare(`INSERT INTO guilds (guild_id, owner_id, members, permissions, settings, session_id, response_mode, logging_preference, allowed_channels, allowed_roles, autonomy_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(guildId, ownerId, JSON.stringify([...guild.members.entries()]), JSON.stringify(guild.permissions), JSON.stringify(guild.settings), null, guild.responseMode, guild.loggingPreference, JSON.stringify(guild.allowedChannels), JSON.stringify(guild.allowedRoles), guild.autonomyMode, now);
    } catch {}
    log.info(comp, "createGuild", `Guild ${guildId} created by ${ownerId}`);
    return guild;
  }

  getGuild(guildId: string): any { return this.guilds.get(guildId); }
  getAllGuilds(): any[] { return Array.from(this.guilds.values()); }
  guildExists(guildId: string): boolean { return this.guilds.has(guildId); }

  async addMember(guildId: string, userId: string, role: GuildRole): Promise<void> {
    const guild = this.guilds.get(guildId);
    if (!guild) throw new Error(`Guild ${guildId} not found`);
    guild.members.set(userId, role);
    log.info(comp, "addMember", `User ${userId} added to guild ${guildId} as ${role}`);
  }

  async removeMember(guildId: string, userId: string): Promise<void> {
    const guild = this.guilds.get(guildId);
    if (!guild) throw new Error(`Guild ${guildId} not found`);
    guild.members.delete(userId);
    log.info(comp, "removeMember", `User ${userId} removed from guild ${guildId}`);
  }

  getMembers(guildId: string): Map<string, GuildRole> {
    const guild = this.guilds.get(guildId);
    return guild ? guild.members : new Map();
  }

  getMemberRole(guildId: string, userId: string): GuildRole | undefined {
    const guild = this.guilds.get(guildId);
    return guild?.members.get(userId);
  }

  hasRole(guildId: string, userId: string, role: GuildRole): boolean {
    const memberRole = this.getMemberRole(guildId, userId);
    const roleLevels: Record<string, number> = { VIEWER: 1, MEMBER: 2, OPERATOR: 3, OWNER: 4 };
    return (roleLevels[memberRole] ?? 0) >= (roleLevels[role] ?? 0);
  }

  async setGuildSetting(guildId: string, key: string, value: any): Promise<void> {
    const guild = this.guilds.get(guildId);
    if (!guild) throw new Error(`Guild ${guildId} not found`);
    guild.settings[key] = value;
    log.info(comp, "setGuildSetting", `Setting ${key} updated for guild ${guildId}`);
  }

  getGuildSetting(guildId: string, key: string): any {
    const guild = this.guilds.get(guildId);
    return guild?.settings[key];
  }

  async setSessionId(guildId: string, sessionId: string | null): Promise<void> {
    const guild = this.guilds.get(guildId);
    if (!guild) return;
    guild.sessionId = sessionId;
  }

  getGuildSessionId(guildId: string): string | null {
    const guild = this.guilds.get(guildId);
    return guild?.sessionId ?? null;
  }
}

export const guildManager = GuildManager.getInstance();
