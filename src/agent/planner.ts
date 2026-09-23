import { log } from "../logger";
import { Goal } from "./goals";
export interface PlanStep { id: string; goalId: string; description: string; tool: string; arguments: Record<string, unknown>; order: number; completed: boolean; }
export interface PlannerInput { goal: Goal; worldState: Record<string, unknown>; }
export class Planner {
  async createPlan(input: PlannerInput): Promise<PlanStep[]> {
    const { goal } = input;
    const steps: PlanStep[] = [];
    const desc = goal.description.toLowerCase();
    let order = 0;
    if (desc.includes("connect") || desc.includes("join")) steps.push({ id: crypto.randomUUID(), goalId: goal.id, description: "Connect", tool: "connect_server", arguments: {}, order: order++, completed: false });
    if (desc.includes("food") || desc.includes("secure")) steps.push({ id: crypto.randomUUID(), goalId: goal.id, description: "Secure food", tool: "find_and_eat", arguments: {}, order: order++, completed: false });
    if (desc.includes("shelter") || desc.includes("home")) steps.push({ id: crypto.randomUUID(), goalId: goal.id, description: "Build shelter", tool: "build_structure", arguments: {}, order: order++, completed: false });
    if (steps.length === 0) steps.push({ id: crypto.randomUUID(), goalId: goal.id, description: "Explore", tool: "observe_world", arguments: {}, order: order++, completed: false });
    return steps.sort((a, b) => a.order - b.order);
  }
}
export const planner = new Planner();
