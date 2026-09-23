import { log } from "../../logger";
import { Position } from "../../events/types";
const comp = "navigation";
export class NavigationSystem {
  async navigateTo(from: Position, to: Position): Promise<{ path: Position[]; success: boolean }> {
    log.info(comp, "navigating", "From " + from.x + "," + from.y + "," + from.z + " to " + to.x + "," + to.y + "," + to.z);
    const path: Position[] = [];
    const dx = to.x - from.x; const dz = to.z - from.z; const steps = Math.max(Math.abs(dx), Math.abs(dz));
    if (steps > 0) { for (let i = 1; i <= steps; i++) { path.push({ x: from.x + Math.round(dx * (i / steps)), y: from.y, z: from.z + Math.round(dz * (i / steps)) }); } }
    return { path, success: path.length > 0 };
  }
}
export const navigation = new NavigationSystem();
