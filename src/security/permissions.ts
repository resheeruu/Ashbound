import { log } from "../logger";
export class PermissionError extends Error {
  constructor(m: string) { super(m); this.name = "PermissionError"; }
}
export class AuthorizationService {
  private users: Map<string, boolean> = new Map();
  isAuthorized(userId: string): boolean {
    if (this.users.has(userId)) return true;
    const adminIds = (process.env.ADMIN_DISCORD_IDS || "").split(",").filter(Boolean);
    return adminIds.includes(userId);
  }
  requireAuthorization(userId: string, action: string): void {
    if (!this.isAuthorized(userId)) { log.warn("security", "unauthorized", `${userId} tried ${action}`); throw new PermissionError(`Not authorized: ${action}`); }
  }
  addAuthorizedUser(userId: string): void { this.users.set(userId, true); }
  removeAuthorizedUser(userId: string): void { this.users.delete(userId); }
}
export const authorizationService = new AuthorizationService();
