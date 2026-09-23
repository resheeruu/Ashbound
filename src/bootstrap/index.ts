import { log } from "../logger";
import { validateConfig } from "../config/env";
import { databaseManager } from "../storage/database";
import { discordClient } from "../discord/client";
import { registerDefaultTools } from "../minecraft/tools";
import { gracefulShutdown } from "./application";
const comp = "bootstrap";
export async function start(): Promise<void> {
  log.info(comp, "start", "Starting Ashbound");
  validateConfig();
  await databaseManager.migrate();
  registerDefaultTools();
  await discordClient.login();
  gracefulShutdown.onSignal(async () => {
    await discordClient.logout();
    databaseManager.close();
  });
  log.info(comp, "ready", "Ashbound running");
}
start().catch((error) => { log.error(comp, "fatal", "Failed: " + error); process.exit(1); });
