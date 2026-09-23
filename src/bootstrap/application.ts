import { log } from "../logger";
export class GracefulShutdown {
  private shuttingDown = false;
  private timers: NodeJS.Timeout[] = [];
  private intervals: NodeJS.Timeout[] = [];
  private listeners: (() => void)[] = [];
  constructor() { process.on("SIGTERM", () => this.shutdown("SIGTERM")); process.on("SIGINT", () => this.shutdown("SIGINT")); }
  onSignal(cb: () => void): void { this.listeners.push(cb); }
  setTimer(t: NodeJS.Timeout): void { this.timers.push(t); }
  setInterval(i: NodeJS.Timeout): void { this.intervals.push(i); }
  async shutdown(reason: string): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    log.info("shutdown", "starting", "Shutdown: " + reason);
    for (const cb of this.listeners) { try { await cb(); } catch (e) { log.error("shutdown", "cleanup_error", String(e)); } }
    for (const t of this.timers) clearTimeout(t);
    for (const i of this.intervals) clearInterval(i);
    this.timers = []; this.intervals = [];
    log.info("shutdown", "complete", "Shutdown complete");
    process.exit(0);
  }
}
export const gracefulShutdown = new GracefulShutdown();
