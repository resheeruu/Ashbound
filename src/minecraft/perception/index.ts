import { log } from "../../logger";
const comp = "perception";
export interface Observation { hostileMobs: string[]; animals: string[]; trees: number; food: string[]; water: boolean; structures: string[]; terrain: string; lightLevel: number; danger: boolean; resources: string[]; }
export class Perception {
  createObservation(raw: Record<string, unknown>): Observation {
    return { hostileMobs: (raw.hostileEntities as Array<{type: string}> || []).map((e) => e.type), animals: (raw.animalEntities as Array<{type: string}> || []).map((e) => e.type), trees: (raw.trees as number) || 0, food: (raw.inventory as string[]) || [], water: (raw.hasWater as boolean) || false, structures: (raw.nearbyStructures as string[]) || [], terrain: (raw.terrain as string) || "unknown", lightLevel: (raw.lightLevel as number) || 15, danger: (raw.hostileEntities as Array<{type: string}> || []).length > 0 || (raw.danger as boolean) || false, resources: (raw.inventory as string[]) || [] };
  }
  summarize(observation: Observation): string { return JSON.stringify(observation); }
}
export const perception = new Perception();
