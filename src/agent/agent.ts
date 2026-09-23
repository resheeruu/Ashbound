import { log } from "../logger";
import { goalEngine } from "./goals";
import { agentStateManager } from "./evaluator";
import { executor } from "./executor";
import { GoalStatus } from "../events/types";
import { planner } from "./planner";
import { PlanStep } from "./planner";
const comp = "agent";
export class Agent {
  private running = false;
  async createGoal(description: string, ownerId: string) {
    const goal = goalEngine.create({ ownerId, description });
    log.info(comp, "goal_created", "Goal: " + goal.id);
    return goal;
  }
  async startGoal(goalId: string): Promise<void> {
    goalEngine.start(goalId);
    agentStateManager.setGoalId(goalId);
    agentStateManager.setAgentState("RUNNING");
    const plan = await planner.createPlan({ goal: goalEngine.get(goalId)!, worldState: {} });
    for (const step of plan) {
      if (goalEngine.get(goalId)?.status !== GoalStatus.RUNNING) break;
      await executor.enqueue(goalId, step.tool, step.arguments);
      goalEngine.updateProgress(goalId, (plan.indexOf(step) + 1) / plan.length);
    }
    if (goalEngine.get(goalId)?.status === GoalStatus.RUNNING) {
      goalEngine.complete(goalId);
      agentStateManager.setAgentState("IDLE");
    }
  }
  async pauseGoal(goalId: string): Promise<void> { goalEngine.pause(goalId); agentStateManager.setAgentState("PAUSED"); }
  async resumeGoal(goalId: string): Promise<void> { goalEngine.resume(goalId); }
  async stopGoal(goalId: string): Promise<void> { goalEngine.cancel(goalId); agentStateManager.setAgentState("IDLE"); agentStateManager.setGoalId(null); }
}
export const agent = new Agent();
