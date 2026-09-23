import { log } from "../logger";
import { minecraftLifecycle } from "./lifecycle";
import { ConnectionState } from "../events/types";
const comp = "minecraft-client";
export class MinecraftClient {
  private state: Record<string, unknown> = { health: 20, food: 20, position: { x: 0, y: 64, z: 0 }, dimension: "overworld", inventory: [], connectionState: "DISCONNECTED" };
  async connect(host: string, port: number, username: string): Promise<void> {
    await minecraftLifecycle.connect(host, port, username);
    this.state.connectionState = "CONNECTED";
    log.info(comp, "connected", "Connected to " + host + ":" + port);
  }
  async disconnect(): Promise<void> { await minecraftLifecycle.disconnect(); this.state.connectionState = "DISCONNECTED"; }
  getState(): Record<string, unknown> { return { ...this.state }; }
  getPosition(): { x: number; y: number; z: number } { return this.state.position as { x: number; y: number; z: number }; }
  getHealth(): number { return (this.state.health as number) || 20; }
  getFood(): number { return (this.state.food as number) || 20; }
  getInventory(): string[] { return (this.state.inventory as string[]) || []; }
  async sendChat(message: string): Promise<void> { log.info(comp, "chat", message); }
}
export const minecraftClient = new MinecraftClient();
