import { log } from "../../logger";
import { eventBus } from "../../events/bus";
import { GoalStatus } from "../../events/types";
const comp = "goals";
export interface Goal {
  id: string; ownerId: string; description: string; priority: number;
  status: GoalStatus; progress: number; constraints: string | null;
  parentGoalId: string | null; createdAt: string; startedAt: string | null;
  completedAt: string | null; failureReason: string | null;
}
export interface GoalCreateData { ownerId: string; description: string; priority?: number; constraints?: string | null; parentGoalId?: string | null; }
export class GoalEngine {
  private goals: Map<string, Goal> = new Map();
  create(data: GoalCreateData): Goal {
    const g: Goal = { id: crypto.randomUUID(), ownerId: data.ownerId, description: data.description, priority: data.priority != null ? data.priority : 0, status: GoalStatus.CREATED, progress: 0, constraints: data.constraints != null ? data.constraints : null, parentGoalId: data.parentGoalId != null ? data.parentGoalId : null, createdAt: new Date().toISOString(), startedAt: null, completedAt: null, failureReason: null };
    this.goals.set(g.id, g);
    log.info(comp, "goal_created", "Goal: " + g.id);
    (eventBus.emit as any)("GoalCreated", { goalId: g.id, description: g.description });
    return g;
  }
  get(id: string): Goal | undefined { return this.goals.get(id); }
  getAll(): Goal[] { return [...this.goals.values()]; }
  start(id: string): Goal | undefined {
    const g = this.goals.get(id);
    if (!g) return undefined;
    if (g.status !== GoalStatus.CREATED && g.status !== GoalStatus.PAUSED) throw new Error("Cannot start: " + g.status);
    g.status = GoalStatus.RUNNING; g.startedAt = new Date().toISOString();
    log.info(comp, "goal_started", "Goal: " + id);
    (eventBus.emit as any)("GoalStarted", { goalId: id });
    return g;
  }
  pause(id: string): Goal | undefined {
    const g = this.goals.get(id);
    if (!g || g.status !== GoalStatus.RUNNING) return undefined;
    g.status = GoalStatus.PAUSED;
    log.info(comp, "goal_paused", "Goal: " + id);
    return g;
  }
  resume(id: string): Goal | undefined {
    const g = this.goals.get(id);
    if (!g || g.status !== GoalStatus.PAUSED) return undefined;
    g.status = GoalStatus.RUNNING;
    (eventBus.emit as any)("GoalStarted", { goalId: id });
    return g;
  }
  complete(id: string): Goal | undefined {
    const g = this.goals.get(id);
    if (!g) return undefined;
    g.status = GoalStatus.COMPLETED; g.completedAt = new Date().toISOString(); g.progress = 1;
    log.info(comp, "goal_completed", "Goal: " + id);
    (eventBus.emit as any)("GoalCompleted", { goalId: id });
    return g;
  }
  fail(id: string, reason: string): Goal | undefined {
    const g = this.goals.get(id);
    if (!g) return undefined;
    g.status = GoalStatus.FAILED; g.failureReason = reason;
    (eventBus.emit as any)("GoalFailed", { goalId: id, reason });
    return g;
  }
  cancel(id: string): Goal | undefined {
    const g = this.goals.get(id);
    if (!g) return undefined;
    g.status = GoalStatus.CANCELLED;
    (eventBus.emit as any)("GoalCancelled", { goalId: id });
    return g;
  }
  updateProgress(id: string, progress: number): Goal | undefined {
    const g = this.goals.get(id);
    if (!g) return undefined;
    g.progress = Math.min(1, Math.max(0, progress));
    if (g.progress >= 1) return this.complete(id);
    (eventBus.emit as any)("GoalProgressed", { goalId: id, progress });
    return g;
  }
  remove(id: string): void { this.goals.delete(id); }
}
export const goalEngine = new GoalEngine();
