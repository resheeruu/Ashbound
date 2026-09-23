import { log } from "../../logger";
import { authorizationService } from "../../security/permissions";
import { minecraftClient } from "../../minecraft/client";
import { agent } from "../../agent/agent";
import { agentStateManager } from "../../agent/evaluator";
import { memoryManager } from "../../memory/memory";
const comp = "commands";
export class CommandHandler {
  async handleConnect(interaction: { user: { id: string }; reply: (c: string) => Promise<void> }): Promise<void> {
    authorizationService.requireAuthorization(interaction.user.id, "connect");
    await interaction.reply("Opening connection modal...");
  }
  async handleDisconnect(interaction: { user: { id: string }; reply: (c: string) => Promise<void> }): Promise<void> {
    authorizationService.requireAuthorization(interaction.user.id, "disconnect");
    await minecraftClient.disconnect();
    await interaction.reply("Disconnected from Minecraft.");
  }
  async handleStatus(interaction: { reply: (c: string) => Promise<void> }): Promise<void> {
    const state = agentStateManager.getState();
    await interaction.reply("**ASHBOUND**\nAgent: " + state.agentState + "\nMinecraft: " + state.minecraftState.connectionState + "\nHealth: " + state.minecraftState.health + "\nGoal: " + (state.currentGoalId || "None"));
  }
  async handlePause(interaction: { user: { id: string }; reply: (c: string) => Promise<void> }): Promise<void> {
    authorizationService.requireAuthorization(interaction.user.id, "pause");
    const state = agentStateManager.getState();
    if (state.currentGoalId) { await agent.pauseGoal(state.currentGoalId); await interaction.reply("Paused."); } else { await interaction.reply("No active goal."); }
  }
  async handleResume(interaction: { user: { id: string }; reply: (c: string) => Promise<void> }): Promise<void> {
    authorizationService.requireAuthorization(interaction.user.id, "resume");
    const state = agentStateManager.getState();
    if (state.currentGoalId) { await agent.resumeGoal(state.currentGoalId); await interaction.reply("Resumed."); } else { await interaction.reply("No active goal."); }
  }
  async handleStop(interaction: { user: { id: string }; reply: (c: string) => Promise<void> }): Promise<void> {
    authorizationService.requireAuthorization(interaction.user.id, "stop");
    const state = agentStateManager.getState();
    if (state.currentGoalId) { await agent.stopGoal(state.currentGoalId); await interaction.reply("Stopped."); } else { await interaction.reply("No active goal."); }
  }
  async handleGoal(interaction: { user: { id: string }; content: string; reply: (c: string) => Promise<void> }): Promise<void> {
    authorizationService.requireAuthorization(interaction.user.id, "create_goal");
    const goalText = interaction.content.replace("/goal", "").trim();
    if (!goalText) { await interaction.reply("Specify a goal."); return; }
    const goal = await agent.createGoal(goalText, interaction.user.id);
    await agent.startGoal(goal.id);
    await interaction.reply("Goal created: " + goal.id + "\n" + goal.description);
  }
  async handleSessions(interaction: { reply: (c: string) => Promise<void> }): Promise<void> {
    const sessions = (await import("../../storage/repositories/session-repo")).sessionRepository.getAll();
    await interaction.reply("**Sessions:**\n" + (sessions.length === 0 ? "No sessions." : sessions.map((s: any) => s.host + ":" + s.port + " - " + s.connectionState).join("\n")));
  }
  async handleMemory(interaction: { user: { id: string }; reply: (c: string) => Promise<void> }): Promise<void> {
    authorizationService.requireAuthorization(interaction.user.id, "access_memory");
    const memories = await memoryManager.getEpisodic();
    await interaction.reply("**Memories:**\n" + (memories.slice(0, 10).map((m: any) => m.content.slice(0, 100)).join("\n") || "No memories."));
  }
}
export const commandHandler = new CommandHandler();
