import { log } from "../../logger";
import { eventBus } from "../../events/bus";
const comp = "tools";
export interface ToolDefinition { name: string; description: string; inputSchema: Record<string, { type: string; description: string }>; permissionRules: string[]; timeout: number; cancellable: boolean; execute: (args: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>; }
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  register(t: ToolDefinition): void { this.tools.set(t.name, t); }
  get(name: string): ToolDefinition | undefined { return this.tools.get(name); }
  getAll(): ToolDefinition[] { return [...this.tools.values()]; }
  async execute(name: string, args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const tool = this.tools.get(name);
    if (!tool) return { success: false, error: "Tool " + name + " not found" };
    for (const [field, schema] of Object.entries(tool.inputSchema)) {
      if (!args.hasOwnProperty(field) && schema.type !== "optional") return { success: false, error: "Missing: " + field };
    }
    log.info(comp, "tool_executing", "Executing " + name);
    return tool.execute(args);
  }
}
export const toolRegistry = new ToolRegistry();
export function registerDefaultTools(): void {
  toolRegistry.register({ name: "observe_world", description: "Observe world", inputSchema: {}, permissionRules: ["basic"], timeout: 10000, cancellable: false, execute: async () => ({ success: true, data: { observation: "world observed" } }) });
  toolRegistry.register({ name: "get_position", description: "Get position", inputSchema: {}, permissionRules: ["basic"], timeout: 5000, cancellable: false, execute: async () => ({ success: true, data: { x: 0, y: 64, z: 0 } }) });
  toolRegistry.register({ name: "get_health", description: "Get health", inputSchema: {}, permissionRules: ["basic"], timeout: 5000, cancellable: false, execute: async () => ({ success: true, data: { health: 20 } }) });
  toolRegistry.register({ name: "move_to", description: "Move", inputSchema: { x: { type: "number", description: "X" }, y: { type: "number", description: "Y" }, z: { type: "number", description: "Z" } }, permissionRules: ["move"], timeout: 30000, cancellable: true, execute: async () => ({ success: true, data: { moved: true } }) });
  toolRegistry.register({ name: "send_chat", description: "Send chat", inputSchema: { message: { type: "string", description: "Message" } }, permissionRules: ["basic"], timeout: 5000, cancellable: false, execute: async () => ({ success: true, data: { sent: true } }) });
}
