import { log } from "../logger";
import { databaseManager } from "../storage/database";
const comp = "security";
export class SecurityPolicy {
  validateHost(host: string): void { if (!host || host.trim().length === 0) throw new Error("INVALID_SERVER"); }
  validatePort(port: number): void { if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("INVALID_PORT"); }
  validateInput(value: string, maxLength = 255): void { if (value.length > maxLength) throw new Error("INPUT_TOO_LONG"); }
}
export const securityPolicy = new SecurityPolicy();
