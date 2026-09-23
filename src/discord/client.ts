import { Client, GatewayIntentBits } from "discord.js";
import { log } from "../logger";
import { config } from "../config/env";
import { eventBus } from "../events/bus";
import { agentStateManager } from "../agent/evaluator";
const comp = "discord";
export class DiscordClient {
  private client: Client | null = null;
  async login(): Promise<void> {
    this.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
    this.client.on("ready", () => { log.info(comp, "ready", "Logged in"); agentStateManager.setDiscordState("CONNECTED"); });
    this.client.on("disconnect", () => { log.warn(comp, "disconnect", "Discord disconnected"); agentStateManager.setDiscordState("DISCONNECTED"); eventBus.emit("DiscordDisconnected", { reason: "disconnected" }); });
    await this.client.login(config.discord.token);
    log.info(comp, "discord_login", "Discord logged in");
  }
  async logout(): Promise<void> { await this.client?.destroy(); log.info(comp, "discord_logout", "Logged out"); }
  getClient(): Client | null { return this.client; }
}
export const discordClient = new DiscordClient();
