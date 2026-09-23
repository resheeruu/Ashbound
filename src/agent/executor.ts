import { log } from "../logger";
import { eventBus } from "../events/bus";
const comp = "executor";
export interface ToolResult { success: boolean; data?: unknown; error?: string; }
export interface ActionQueueItem { id: string; goalId: string; tool: string; arguments: Record<string, unknown>; status: string; createdAt: string; startedAt: string | null; completedAt: string | null; result: unknown; error: string | null; }
export class Executor {
  private queue: Map<string, ActionQueueItem> = new Map();
  async enqueue(goalId: string, tool: string, args: Record<string, unknown>): Promise<string> {
    const id = crypto.randomUUID();
    this.queue.set(id, { id, goalId, tool, arguments: args, status: "QUEUED", createdAt: new Date().toISOString(), startedAt: null, completedAt: null, result: null, error: null });
    log.info(comp, "action_queued", "Action " + id);
    (eventBus.emit as any)("AgentActionStarted", { actionId: id, tool, args });
    return id;
  }
  async execute(actionId: string): Promise<ToolResult> {
    const item = this.queue.get(actionId);
    if (!item) throw new Error("Action " + actionId + " not found");
    item.status = "RUNNING"; item.startedAt = new Date().toISOString();
    log.info(comp, "action_executing", "Executing " + item.tool);
    try {
      const result = { success: true, data: { tool: item.tool, args: item.arguments } };
      item.status = "COMPLETED"; item.result = result; item.completedAt = new Date().toISOString();
      (eventBus.emit as any)("AgentActionCompleted", { actionId, result });
      return result;
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      item.status = "FAILED"; item.error = error;
      (eventBus.emit as any)("AgentActionFailed", { actionId, error });
      return { success: false, error };
    }
  }
  cancel(actionId: string): void {
    const item = this.queue.get(actionId);
    if (item && item.status === "QUEUED") { item.status = "CANCELLED"; }
  }
}
export const executor = new Executor();
