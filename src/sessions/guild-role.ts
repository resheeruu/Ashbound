import { GuildRole } from "../events/types";

export function canCreateSession(role: GuildRole): boolean {
  return role === GuildRole.OWNER || role === GuildRole.OPERATOR;
}

export function canControlMinecraft(role: GuildRole): boolean {
  return role === GuildRole.OWNER || role === GuildRole.OPERATOR;
}

export function canCreateGoals(role: GuildRole): boolean {
  return role === GuildRole.OWNER || role === GuildRole.OPERATOR || role === GuildRole.MEMBER;
}

export function canManageMembers(role: GuildRole): boolean {
  return role === GuildRole.OWNER || role === GuildRole.OPERATOR;
}

export function canConfigureAI(role: GuildRole): boolean {
  return role === GuildRole.OWNER || role === GuildRole.OPERATOR;
}

export function canAccessMemory(role: GuildRole): boolean {
  return role !== GuildRole.VIEWER;
}

export function isOwner(role: GuildRole): boolean {
  return role === GuildRole.OWNER;
}

export function isOperatorOrAbove(role: GuildRole): boolean {
  return role === GuildRole.OWNER || role === GuildRole.OPERATOR;
}

export function canViewStatus(role: GuildRole): boolean {
  return true;
}
