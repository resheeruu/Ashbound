import { log } from "../../logger";
import { ConnectionState } from "../../events/types";
const comp = "minecraft-lifecycle";
export class MinecraftLifecycleManager {
  private connectionState: ConnectionState = ConnectionState.CREATED;
  private host = ""; private port = 25565; private username = "";
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupCallbacks: (() => void)[] = [];
  getConnectionState(): ConnectionState { return this.connectionState; }
  async connect(host: string, port: number, username: string): Promise<void> {
    if (!host) throw new Error("INVALID_SERVER");
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("INVALID_PORT");
    if (!username) throw new Error("INVALID_USERNAME");
    this.host = host; this.port = port; this.username = username;
    this.connectionState = ConnectionState.CONNECTING;
    log.info(comp, "connecting", "To " + host + ":" + port);
    try {
      await new Promise((r) => setTimeout(r, 100));
      this.connectionState = ConnectionState.CONNECTED;
      this.startHeartbeat();
      log.info(comp, "connected", "Connected");
    } catch (e) { this.connectionState = ConnectionState.ERROR; throw e; }
  }
  async disconnect(): Promise<void> {
    this.connectionState = ConnectionState.STOPPING;
    this.cleanup();
    this.connectionState = ConnectionState.STOPPED;
  }
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => { if (this.connectionState !== ConnectionState.CONNECTED) return; }, 30000);
    this.cleanupCallbacks.push(() => { if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; } });
  }
  private cleanup(): void {
    for (const cb of this.cleanupCallbacks) { try { cb(); } catch {} }
    this.cleanupCallbacks = [];
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
  }
}
export const minecraftLifecycle = new MinecraftLifecycleManager();
