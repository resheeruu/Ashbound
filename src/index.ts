import { log } from "./logger";
import { validateConfig } from "./config/env";
import { databaseManager } from "./storage/database";
import { discordClient } from "./discord/client";
import { registerDefaultTools } from "./minecraft/tools";
import { gracefulShutdown } from "./bootstrap/application";
import { startServer } from "./server";
async function start(): Promise<void> {
  log.info("main", "start", "Starting Ashbound");
  validateConfig();
  await databaseManager.migrate();
  registerDefaultTools();
  await discordClient.login();
  startServer();
  gracefulShutdown.onSignal(async () => {
    await discordClient.logout();
    databaseManager.close();
    process.exit(0);
  });
  log.info("main", "ready", "Ashbound running");
}
start().catch((error) => { log.error("main", "fatal", `Failed: ${error}`); process.exit(1); });
