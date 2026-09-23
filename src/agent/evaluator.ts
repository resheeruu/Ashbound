import { log } from "../logger";
import { GoalStatus } from "../events/types";
export interface EvaluationResult { score: number; feedback: string; replan: boolean; suggestions: string[]; }
export class Evaluator {
  evaluate(goal: any, observation: Record<string, unknown>): EvaluationResult {
    const score = goal.progress;
    return { score, feedback: score >= 0.8 ? "Good progress" : score >= 0.5 ? "Moderate progress" : "Reassess", replan: score < 0.3, suggestions: score < 0.3 ? ["Replan needed"] : ["Continue"] };
  }
}
export const evaluator = new Evaluator();
export interface AgentStateData { agentState: string; currentGoalId: string | null; activity: string; minecraftState: Record<string, unknown>; discordState: string; aiState: "READY" | "BUSY" | "ERROR"; }
export class AgentStateManager {
  private state: AgentStateData = { agentState: "IDLE", currentGoalId: null, activity: "Waiting", minecraftState: { health: 20, food: 20, position: { x: 0, y: 64, z: 0 }, dimension: "overworld", connectionState: "DISCONNECTED" }, discordState: "DISCONNECTED", aiState: "READY" };
  getState(): AgentStateData { return { ...this.state }; }
  setAgentState(s: string): void { this.state.agentState = s; }
  setGoalId(id: string | null): void { this.state.currentGoalId = id; }
  setActivity(a: string): void { this.state.activity = a; }
  setMinecraftState(s: Record<string, unknown>): void { this.state.minecraftState = { ...this.state.minecraftState, ...s }; }
  setDiscordState(s: string): void { this.state.discordState = s; }
  setAiState(s: "READY" | "BUSY" | "ERROR"): void { this.state.aiState = s; }
}
export const agentStateManager = new AgentStateManager();
