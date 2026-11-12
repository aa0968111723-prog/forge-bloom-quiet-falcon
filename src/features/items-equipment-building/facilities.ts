import { FACILITY_USE } from "./catalog.ts";

export const FACILITY_REACH = 3.2;

export type FacilityHit = {
  id: string;
  kind: string;
  verb: string;
  x: number;
  z: number;
  distance: number;
};

export function nearestFacility(
  buildings: readonly { id: string; kind: string; x: number; z: number; hp: number }[],
  x: number,
  z: number,
  reach = FACILITY_REACH,
): FacilityHit | null {
  let best: FacilityHit | null = null;
  for (const building of buildings) {
    const verb = FACILITY_USE[building.kind];
    if (!verb || building.hp <= 0) continue;
    const distance = Math.hypot(building.x - x, building.z - z);
    if (distance > reach) continue;
    if (!best || distance < best.distance)
      best = { id: building.id, kind: building.kind, verb, x: building.x, z: building.z, distance };
  }
  return best;
}

/** Structural mesh counts. This is not a frame-time measurement. */
export const MESH_PARTS: Record<string, number> = {
  desk: 5,
  barrier: 2,
  lantern: 4,
  turret: 3,
  research: 5,
  supply: 4,
  board: 4,
  rest: 4,
  anomaly: 5,
};

export function meshBudget(buildings: readonly { kind: string }[]) {
  return buildings.reduce((sum, building) => sum + (MESH_PARTS[building.kind] ?? 0), 0);
}

const COVER_REACH = 2.4;

/**
 * A living barrier between the player and a hit. A healthy wall subtracts 4.
 * A battered wall subtracts 2. This is added once, beside gear mitigation.
 */
export function coverBonus(
  buildings: readonly { kind: string; x: number; z: number; hp: number }[],
  x: number,
  z: number,
) {
  let best = 0;
  for (const building of buildings) {
    if (building.kind !== "barrier" || building.hp <= 0) continue;
    if (Math.hypot(building.x - x, building.z - z) > COVER_REACH) continue;
    best = Math.max(best, building.hp >= 140 ? 4 : 2);
  }
  return best;
}
