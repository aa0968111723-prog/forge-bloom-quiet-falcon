/**
 * Compatibility facade over the reality data layer.
 *
 * Gameplay code (Player, Npcs, store, Overlay) keeps importing `./world`, so the
 * Reality Pass could re-found the whole coordinate system without touching
 * movement, saves or the HUD. New code should import from `./world-data`
 * directly; this file exists to keep the old surface stable.
 */
export type { TimeOfDay } from "./world-data/lighting.ts";
export { TIME_PRESETS, TIME_OF_DAY_VALUES, coerceTimeOfDay } from "./world-data/lighting.ts";
export type { AABB } from "./world-data/colliders.ts";
export { COLLIDERS, resolveCollision } from "./world-data/colliders.ts";
export { WORLD_BOUNDS } from "./world-data/origin.ts";

import { PLAZA_ELEVATION } from "./world-data/axis.ts";
import { landmarkAt as landmarkAtImpl } from "./world-data/colliders.ts";
import { sampleGroundElevation } from "./world-data/elevation.ts";
import { kenanStepElevation } from "./world-data/kenan.ts";
import { LANDMARKS as REALITY_LANDMARKS, SPAWN as REALITY_SPAWN } from "./world-data/landmarks.ts";
import type { RealityLandmark } from "./world-data/landmarks.ts";

export type { RealityLandmark };

/**
 * Landmark shape the HUD, codex and minimap were written against.
 * `x` / `z` / `radius` are the *stamp* point, which is not always where the
 * landmark physically is (you stamp 克難坡 on its mid landing).
 */
export type Landmark = {
  id: string;
  name: string;
  nameEn: string;
  year: string;
  blurb: string;
  x: number;
  z: number;
  radius: number;
  mapColor: string;
};

export const LANDMARKS: Landmark[] = REALITY_LANDMARKS.map((l) => ({
  id: l.id,
  name: l.name,
  nameEn: l.nameEn,
  year: l.year,
  blurb: l.blurb,
  x: l.interact.x,
  z: l.interact.z,
  radius: l.interact.radius,
  mapColor: l.mapColor,
}));

export const LANDMARK_BY_ID = Object.fromEntries(LANDMARKS.map((l) => [l.id, l])) as Record<
  string,
  Landmark
>;

export const SPAWN = { x: REALITY_SPAWN.x, y: REALITY_SPAWN.y + 0.1, z: REALITY_SPAWN.z };

/** Ground height the player walks on. Stepped through 克難坡. */
export function terrainHeight(x: number, z: number): number {
  return sampleGroundElevation(x, z);
}

/** Legacy helper: stair-centreline height, or null off the slope. */
export function kenanY(z: number): number | null {
  return kenanStepElevation(z, PLAZA_ELEVATION);
}

export function landmarkAt(x: number, z: number): Landmark | null {
  const hit = landmarkAtImpl(x, z);
  return hit ? LANDMARK_BY_ID[hit.id] : null;
}
