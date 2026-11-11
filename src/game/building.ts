/**
 * Player-placed structures. Occupancy is a pure AABB test against colliders,
 * landmark cores and already-placed props — no renderer required.
 */

import { COLLIDERS, type AABB } from "./world-data/colliders.ts";
import { LANDMARKS } from "./world-data/landmarks.ts";
import { WORLD_BOUNDS } from "./world-data/origin.ts";
import { skillModifiers } from "./departments.ts";

export const BUILD_KINDS = ["booth", "desk", "lamp-post", "banner"] as const;
export type BuildKind = (typeof BUILD_KINDS)[number];

export const BUILD_CATALOG: Record<
  BuildKind,
  { name: string; nameEn: string; width: number; depth: number; height: number }
> = {
  booth: { name: "攤位", nameEn: "Booth", width: 2.4, depth: 2.4, height: 2.2 },
  desk: { name: "書桌", nameEn: "Desk", width: 1.6, depth: 0.8, height: 1.0 },
  "lamp-post": { name: "燈柱", nameEn: "Lamp post", width: 0.8, depth: 0.8, height: 4.2 },
  banner: { name: "旗幟", nameEn: "Banner", width: 1.2, depth: 0.6, height: 3.4 },
};

export type PlacedStructure = {
  id: string;
  kind: BuildKind;
  x: number;
  z: number;
  width: number;
  depth: number;
};

export type PlaceFail = "overlap" | "bounds" | "unknown";
export type PlaceOk = { ok: true; placed: PlacedStructure[]; structure: PlacedStructure };
export type PlaceErr = { ok: false; reason: PlaceFail };
export type PlaceResult = PlaceOk | PlaceErr;

export function isBuildKind(value: unknown): value is BuildKind {
  return typeof value === "string" && (BUILD_KINDS as readonly string[]).includes(value);
}

export function structureAabb(s: { x: number; z: number; width: number; depth: number }): AABB {
  return {
    minX: s.x - s.width / 2,
    maxX: s.x + s.width / 2,
    minZ: s.z - s.depth / 2,
    maxZ: s.z + s.depth / 2,
  };
}

export function aabbsOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/**
 * Tight box around each landmark's physical anchor. Linear corridor stamps
 * (the avenue, the slope) still get a small core so you cannot plant a booth
 * on the bronze or inside a hall.
 */
export function landmarkCoreAabbs(): AABB[] {
  const out: AABB[] = [];
  for (const l of LANDMARKS) {
    const w = Math.max(4, (l.realWidth ?? 6) * 0.45);
    const d = Math.max(4, (l.realLength ?? 6) * 0.45);
    // Keep cores modest: 宮燈大道 is 200 m long and must stay walkable.
    const width = Math.min(w, 12);
    const depth = Math.min(d, 12);
    out.push(structureAabb({ x: l.worldPosition[0], z: l.worldPosition[2], width, depth }));
  }
  return out;
}

export function occupiedAabbs(placed: readonly PlacedStructure[]): AABB[] {
  return [...COLLIDERS, ...landmarkCoreAabbs(), ...placed.map(structureAabb)];
}

export function placementBlocked(
  x: number,
  z: number,
  width: number,
  depth: number,
  placed: readonly PlacedStructure[],
): boolean {
  const box = structureAabb({ x, z, width, depth });
  for (const other of occupiedAabbs(placed)) {
    if (aabbsOverlap(box, other)) return true;
  }
  return false;
}

export function inBuildBounds(x: number, z: number): boolean {
  return (
    x >= WORLD_BOUNDS.minX + 10 &&
    x <= WORLD_BOUNDS.maxX - 10 &&
    z >= WORLD_BOUNDS.minZ + 10 &&
    z <= WORLD_BOUNDS.maxZ - 10
  );
}

export function buildRangeFor(departmentId: string | null | undefined, base = 6): number {
  return base + skillModifiers(departmentId).buildRangeBonus;
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `build-${seq}`;
}

export function tryPlace(
  placed: readonly PlacedStructure[],
  kind: BuildKind,
  x: number,
  z: number,
  id?: string,
): PlaceResult {
  if (!isBuildKind(kind)) return { ok: false, reason: "unknown" };
  if (!inBuildBounds(x, z)) return { ok: false, reason: "bounds" };
  const spec = BUILD_CATALOG[kind];
  if (placementBlocked(x, z, spec.width, spec.depth, placed)) return { ok: false, reason: "overlap" };
  const structure: PlacedStructure = {
    id: id ?? nextId(),
    kind,
    x,
    z,
    width: spec.width,
    depth: spec.depth,
  };
  return { ok: true, placed: [...placed, structure], structure };
}

export function listStructures(placed: readonly PlacedStructure[]): PlacedStructure[] {
  return placed.map((s) => ({ ...s }));
}

export function buildingAabbs(placed: readonly PlacedStructure[]): AABB[] {
  return placed.map(structureAabb);
}

export function coerceBuildings(raw: unknown): PlacedStructure[] {
  if (!Array.isArray(raw)) return [];
  const out: PlacedStructure[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (!isBuildKind(r.kind)) continue;
    if (typeof r.x !== "number" || typeof r.z !== "number") continue;
    const spec = BUILD_CATALOG[r.kind];
    const id = typeof r.id === "string" && r.id.length > 0 ? r.id : nextId();
    out.push({
      id,
      kind: r.kind,
      x: r.x,
      z: r.z,
      width: spec.width,
      depth: spec.depth,
    });
  }
  return out;
}
