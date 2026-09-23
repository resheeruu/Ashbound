import { log } from "../../logger";
import { GuildRole, ActionRisk, AutonomyMode } from "../../events/types";
import { toolRegistry } from "./index";

const comp = "safety";

export class ToolSafety {
  private static instance: ToolSafety;
  confirmedTools: Set<string> = new Set();

  private constructor() {}

  static getInstance(): ToolSafety {
    if (!ToolSafety.instance) ToolSafety.instance = new ToolSafety();
    return ToolSafety.instance;
  }

  validateRiskLevel(toolName: string, autonomyMode: AutonomyMode): { allowed: boolean; reason?: string } {
    const tool = toolRegistry.get(toolName);
    if (!tool) return { allowed: false, reason: "Tool not found" };
    const risk = tool.riskLevel;
    switch (autonomyMode) {
      case AutonomyMode.SAFE:
        return risk === ActionRisk.LOW ? { allowed: true } : { allowed: false, reason: `${toolName} risk level ${risk} not allowed in SAFE mode` };
      case AutonomyMode.ASSISTED:
        if (risk === ActionRisk.LOW) return { allowed: true };
        if (risk === ActionRisk.MEDIUM) return { allowed: true };
        return { allowed: false, reason: `${toolName} risk level ${risk} exceeds ASSISTED mode` };
      case AutonomyMode.AUTONOMOUS:
        return { allowed: true };
      default:
        return { allowed: false, reason: "Unknown autonomy mode" };
    }
  }

  confirmRequired(toolName: string, riskLevel: ActionRisk, autonomyMode: AutonomyMode): boolean {
    if (autonomyMode === AutonomyMode.SAFE) return riskLevel !== ActionRisk.LOW;
    if (autonomyMode === AutonomyMode.ASSISTED) return riskLevel === ActionRisk.MEDIUM && !this.isConfirmed(toolName);
    if (autonomyMode === AutonomyMode.AUTONOMOUS) return false;
    return true;
  }

  confirmTool(toolName: string): void { this.confirmedTools.add(toolName); }
  revokeConfirmation(toolName: string): void { this.confirmedTools.delete(toolName); }
  isConfirmed(toolName: string): boolean { return this.confirmedTools.has(toolName); }

  checkPermission(toolName: string, role: GuildRole): { allowed: boolean; reason?: string } {
    const tool = toolRegistry.get(toolName);
    if (!tool) return { allowed: false, reason: "Tool not found" };
    const roleLevels: Record<string, number> = { OWNER: 4, OPERATOR: 3, MEMBER: 2, VIEWER: 1 };
    const toolLevel = roleLevels[tool.permission] ?? 0;
    const userLevel = roleLevels[role] ?? 0;
    if (userLevel < toolLevel) return { allowed: false, reason: `Role ${role} insufficient for ${toolName}` };
    return { allowed: true };
  }

  evaluateAction(toolName: string, role: GuildRole, autonomyMode: AutonomyMode): { allowed: boolean; requiresConfirmation: boolean; reason?: string } {
    const tool = toolRegistry.get(toolName);
    if (!tool) return { allowed: false, requiresConfirmation: false, reason: "Tool not found" };
    const permCheck = this.checkPermission(toolName, role);
    if (!permCheck.allowed) return { ...permCheck, requiresConfirmation: false };
    const riskCheck = this.validateRiskLevel(toolName, autonomyMode);
    if (!riskCheck.allowed) return { ...riskCheck, requiresConfirmation: false };
    const requiresConfirmation = this.confirmRequired(toolName, tool.riskLevel, autonomyMode);
    return { allowed: true, requiresConfirmation };
  }
}

export const toolSafety = ToolSafety.getInstance();
