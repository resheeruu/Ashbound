import "dotenv/config";
function required(n: string): string { const v = process.env[n]?.trim(); if (!v) throw new Error(`Missing required env: ${n}`); return v; }
function optional(n: string): string | undefined { return process.env[n]?.trim() || undefined; }
function num(n: string, f: number): number { const v = Number(process.env[n]); return Number.isFinite(v) ? v : f; }
export interface RuntimeConfig {
  discord: { token: string; clientId: string; guildId: string; };
  ai: { provider: string; apiKey: string; model: string; };
  database: { url: string; };
  minecraft: { defaultVersion: string; };
  logLevel: string; autonomy: string; server: { port: number; nodeEnv: string; };
}
export const config: RuntimeConfig = {
  discord: { token: required("DISCORD_TOKEN"), clientId: required("DISCORD_CLIENT_ID"), guildId: required("DISCORD_GUILD_ID") },
  ai: { provider: optional("AI_PROVIDER") || "openai", apiKey: required("AI_API_KEY"), model: optional("AI_MODEL") || "gpt-4o-mini" },
  database: { url: required("DATABASE_URL") },
  minecraft: { defaultVersion: optional("DEFAULT_MINECRAFT_VERSION") || "1.21.4" },
  logLevel: optional("LOG_LEVEL") || "info", autonomy: optional("DEFAULT_AUTONOMY_MODE") || "ASSISTED",
  server: { port: num("PORT", 9002), nodeEnv: optional("NODE_ENV") || "development" },
};
export function validateConfig(): void {
  const missing: string[] = [];
  if (!process.env.DISCORD_TOKEN) missing.push("DISCORD_TOKEN");
  if (!process.env.AI_API_KEY) missing.push("AI_API_KEY");
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (missing.length > 0) throw new Error(`Missing: ${missing.join("\n")}`);
}
export const VERSION = process.env.ASHBOUND_VERSION || "0.1.0";
export const COMMIT = process.env.ASHBOUND_COMMIT || "unknown";
export const BUILD_TIMESTAMP = process.env.ASHBOUND_BUILD_TIMESTAMP || new Date().toISOString();
export const ENVIRONMENT = process.env.NODE_ENV || "development";
export const buildInfo = { version: VERSION, commit: COMMIT, buildTimestamp: BUILD_TIMESTAMP, environment: ENVIRONMENT };
