import { CAMPUS_ROADS, CAMPUS_SITES } from "../../game/rpg/campus.ts";
import { ENCOUNTERS } from "../../game/rpg/data.ts";
import { SPAWN } from "../../game/world-data/landmarks.ts";

/** Same body radius the player resolver uses. */
export const PASS_RADIUS = 0.42;

const GATE_REACH = 3.2;

function coversPoint(minX: number, maxX: number, minZ: number, maxZ: number, x: number, z: number) {
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}

function cross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number) {
  return (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
}

function segmentsCross(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
) {
  const d1 = cross(cx, cz, dx, dz, ax, az);
  const d2 = cross(cx, cz, dx, dz, bx, bz);
  const d3 = cross(ax, az, bx, bz, cx, cz);
  const d4 = cross(ax, az, bx, bz, dx, dz);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function segmentHitsRect(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
) {
  if (coversPoint(minX, maxX, minZ, maxZ, x0, z0) || coversPoint(minX, maxX, minZ, maxZ, x1, z1))
    return true;
  const midX = (x0 + x1) / 2;
  const midZ = (z0 + z1) / 2;
  if (coversPoint(minX, maxX, minZ, maxZ, midX, midZ)) return true;
  const edges: [number, number, number, number][] = [
    [minX, minZ, maxX, minZ],
    [maxX, minZ, maxX, maxZ],
    [maxX, maxZ, minX, maxZ],
    [minX, maxZ, minX, minZ],
  ];
  return edges.some(([ax, az, bx, bz]) => segmentsCross(x0, z0, x1, z1, ax, az, bx, bz));
}

/**
 * Blocks a footprint when a body of PASS_RADIUS could not use a road, gate,
 * quest anchor, or the rescue stand. The box is the building plus that radius.
 */
export function keepOut(x: number, z: number, width: number, depth: number): string | null {
  if (![x, z, width, depth].every((value) => Number.isFinite(value)) || width <= 0 || depth <= 0)
    return "無效的建造資料";
  const minX = x - width / 2 - PASS_RADIUS;
  const maxX = x + width / 2 + PASS_RADIUS;
  const minZ = z - depth / 2 - PASS_RADIUS;
  const maxZ = z + depth / 2 + PASS_RADIUS;
  if (coversPoint(minX, maxX, minZ, maxZ, SPAWN.x, SPAWN.z)) return "這會擋住救援位置";
  for (const site of CAMPUS_SITES) {
    if (site.form !== "gate") continue;
    const gateMinX = site.x - GATE_REACH;
    const gateMaxX = site.x + GATE_REACH;
    const gateMinZ = site.z - GATE_REACH;
    const gateMaxZ = site.z + GATE_REACH;
    if (minX < gateMaxX && maxX > gateMinX && minZ < gateMaxZ && maxZ > gateMinZ)
      return "這會堵住校門";
  }
  for (const road of CAMPUS_ROADS) {
    for (let index = 1; index < road.length; index += 1) {
      const [ax, az] = road[index - 1];
      const [bx, bz] = road[index];
      if (segmentHitsRect(ax, az, bx, bz, minX, maxX, minZ, maxZ)) return "這會堵住主路";
    }
  }
  for (const encounter of ENCOUNTERS) {
    if (coversPoint(minX, maxX, minZ, maxZ, encounter.x, encounter.z)) return "這會擋住任務出生點";
  }
  return null;
}
