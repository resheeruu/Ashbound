import express from "express";
import { log } from "../logger";
import { databaseManager } from "../storage/database";
import { config } from "../config/env";
import { eventBus } from "../events/bus";
import { agentStateManager } from "../agent/evaluator";
import { minecraftLifecycle } from "../minecraft/lifecycle";
import { goalEngine } from "../agent/goals";
import { authorizationService } from "../security/permissions";
import { resourceManager } from "../resource/manager";
import { sessionManager } from "../sessions/session-manager";
import type { EventMap } from "../events/bus";

const app = express();
const comp = "server";

app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  const state = agentStateManager.getState();
  const mcState = minecraftLifecycle.getConnectionState();
  const dbOk = databaseManager.getDb().prepare("SELECT 1 as ok").get() as { ok: number };
  const health = {
    status: dbOk?.ok === 1 ? "healthy" : "degraded",
    discord: state.discordState,
    database: dbOk?.ok === 1 ? "HEALTHY" : "ERROR",
    minecraft: mcState,
    agent: state.agentState,
    activeGoals: goalEngine.getAll().filter((g) => g.status === "RUNNING").length,
    activeSessions: sessionManager.getAllSessions().length,
    uptime: process.uptime(),
    resources: resourceManager.check(),
  };
  res.json(health);
});

// Detailed health (owner only)
app.get("/health/detailed", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authorizationService.isAuthorized(authHeader.replace("Bearer ", ""))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const state = agentStateManager.getState();
  res.json({
    ...state,
    memory: "available",
    providers: "configured",
    config: {
      maxSessionsPerGuild: config.limits.maxSessionsPerGuild,
      maxMinecraftSessions: config.minecraft.maxSessions,
      maxActiveGoals: config.limits.maxActiveGoalsPerSession,
      maxConcurrentAI: config.limits.maxConcurrentAIRequests,
      allowPaidAI: config.security.allowPaidAI,
    },
  });
});

// Provider status
app.get("/providers", (_req, res) => {
  res.json({ message: "Provider status endpoint" });
});

// Settings endpoint
app.get("/settings", (_req, res) => {
  res.json({ message: "Settings endpoint" });
});

export function startServer(): void {
  const port = config.server.port;
  app.listen(port, () => {
    log.info(comp, "http_server", `Ashbound HTTP server listening on port ${port}`);
    eventBus.emit("ServerStarted", { port } as EventMap["ServerStarted"]);
  });
}

export { app };
