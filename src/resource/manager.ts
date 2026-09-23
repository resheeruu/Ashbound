import os from "os";
import fs from "fs";
import { log } from "./logger";
import { eventBus } from "../events/bus";
import { ResourceLevel } from "../events/types";

const comp = "resource-manager";

export class ResourceManager {
  private static instance: ResourceManager;
  buckets: Record<string, { used: number; total: number; percent: number }>;
  databaseSize = 0;
  aiConcurrency: { active: number; max: number };
  minecraftSessions: { active: number; max: number };
  activeGoals: { count: number; max: number };
  actionQueue: { pending: number; max: number };
  discordEvents: { pending: number; max: number };

  private constructor() { this.buckets = this.initializeBuckets(); }

  static getInstance(): ResourceManager { if (!ResourceManager.instance) ResourceManager.instance = new ResourceManager(); return ResourceManager.instance; }

  private initializeBuckets(): Record<string, { used: number; total: number; percent: number }> { return { ram: { used: 0, total: os.totalMemory(), percent: 0 }, cpu: { used: 0, total: os.cpus().length * 100, percent: 0 }, storage: { used: 0, total: 0, percent: 0 } }; }

  checkRAM(): number { const total = os.totalMemory(); const used = total - os.freemem(); const percent = (used / total) * 100; this.buckets.ram = { used, total, percent }; return this.percentToLevel(percent); }
  checkStorage(): number { try { const usage = fs.statfsSync("/"); this.buckets.storage = { used: usage.blocks * usage.bsize - usage.bavail * usage.bsize, total: usage.blocks * usage.bsize, percent: ((usage.blocks * usage.bsize - usage.bavail * usage.bsize) / (usage.blocks * usage.bsize)) * 100 }; } catch { this.buckets.storage = { used: 0, total: 1, percent: 0 }; } return this.percentToLevel(this.buckets.storage.percent); }
  checkDatabaseSize(): number { try { this.databaseSize = fs.statSync("/data/data/com.termux/files/home/projects/Ashbound/data/ashbound.db").size; } catch { this.databaseSize = 0; } return this.percentToLevel((this.databaseSize / (350 * 1024 * 1024)) * 100); }
  checkAIConcurrency(): number { return this.percentToLevel(this.aiConcurrency.max > 0 ? (this.aiConcurrency.active / this.aiConcurrency.max) * 100 : 0); }
  checkSessions(): number { return this.percentToLevel(this.minecraftSessions.max > 0 ? (this.minecraftSessions.active / this.minecraftSessions.max) * 100 : 0); }

  check(): ResourceSnapshot { const levels = [this.checkRAM(), this.checkStorage(), this.checkAIConcurrency(), this.checkSessions()]; const priority = [ResourceLevel.EMERGENCY, ResourceLevel.RESTRICTED, ResourceLevel.WARNING, ResourceLevel.NORMAL]; let status: ResourceLevel = ResourceLevel.NORMAL; for (const p of priority) { if (levels.includes(p)) { status = p; break; } } log.info(comp, "resource_check", `RAM: ${this.buckets.ram.percent.toFixed(1)}%, Status: ${status}`); return { rssMB: Math.round(this.buckets.ram.used / 1048576), heapUsedMB: 0, heapTotalMB: 0, uptime: process.uptime(), activeSessions: this.minecraftSessions.active, activeGoals: this.activeGoals.count, pendingActions: this.actionQueue.pending, memoryUsagePercent: Math.round(this.buckets.ram.percent * 10) / 10, status: status as any }; }

  canAcceptSession(): boolean { const level = this.getResourceLevel(); return level !== ResourceLevel.EMERGENCY && !(level === ResourceLevel.RESTRICTED && this.minecraftSessions.active >= this.minecraftSessions.max); }
  canAcceptGoal(): boolean { const level = this.getResourceLevel(); return level !== ResourceLevel.EMERGENCY && !(level === ResourceLevel.RESTRICTED && this.activeGoals.count >= this.activeGoals.max); }
  canAcceptAIRequest(): boolean { const level = this.getResourceLevel(); return level !== ResourceLevel.EMERGENCY && !(level === ResourceLevel.RESTRICTED && this.aiConcurrency.active >= this.aiConcurrency.max); }
  canAcceptAction(): boolean { const level = this.getResourceLevel(); return level !== ResourceLevel.EMERGENCY && !(level === ResourceLevel.RESTRICTED && this.actionQueue.pending >= this.actionQueue.max); }

  updateAICount(delta: number): void { this.aiConcurrency.active = Math.max(0, this.aiConcurrency.active + delta); }
  updateSessionCount(delta: number): void { this.minecraftSessions.active = Math.max(0, this.minecraftSessions.active + delta); }
  updateGoalCount(delta: number): void { this.activeGoals.count = Math.max(0, this.activeGoals.count + delta); }
  updateActionQueue(delta: number): void { this.actionQueue.pending = Math.max(0, this.actionQueue.pending + delta); }

  getResourceLevel(): ResourceLevel { const levels = [this.checkRAM(), this.checkStorage(), this.checkAIConcurrency(), this.checkSessions()]; const priority = [ResourceLevel.EMERGENCY, ResourceLevel.RESTRICTED, ResourceLevel.WARNING, ResourceLevel.NORMAL]; for (const p of priority) { if (levels.includes(p)) return p; } return ResourceLevel.NORMAL; }
  percentToLevel(percent: number): ResourceLevel { if (percent >= 92) return ResourceLevel.EMERGENCY; if (percent >= 85) return ResourceLevel.RESTRICTED; if (percent >= 70) return ResourceLevel.WARNING; return ResourceLevel.NORMAL; }
}

export interface ResourceSnapshot { rssMB: number; heapUsedMB: number; heapTotalMB: number; uptime: number; activeSessions: number; activeGoals: number; pendingActions: number; memoryUsagePercent: number; status: string; }
export const resourceManager = ResourceManager.getInstance();
