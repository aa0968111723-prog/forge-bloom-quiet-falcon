import { resolveInterior } from "../rules.ts";
import { FIXED_DT } from "./clock.ts";

export type InteriorStep = {
  x: number;
  z: number;
  exited: boolean;
  hit: boolean;
};

const EXIT_HALF = 3;

/**
 * Indoors still uses resolveInterior.
 * The south gap |x| < 3 is the doorway, so a southward step may leave the room.
 */
export function stepInterior(
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
): InteriorStep {
  const slices = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.25));
  let cx = x;
  let cz = z;
  let exited = false;
  let hit = false;
  for (let i = 0; i < slices; i++) {
    const nx = cx + dx / slices;
    const nz = cz + dz / slices;
    const inGap = Math.abs(cx) <= EXIT_HALF - radius && Math.abs(nx) <= EXIT_HALF - radius;
    if (cz > 7 - radius || (inGap && nz > 7 - radius && cz > 4)) {
      if (Math.abs(nx) > EXIT_HALF - radius && cz <= 7.45) {
        hit = true;
        const held = resolveInterior(cx, Math.min(cz, 7 - radius), radius, true);
        cx = held.x;
        cz = held.z;
        continue;
      }
      cx = nx;
      cz = nz;
      if (cz > 7 - radius) exited = true;
      continue;
    }
    const held = resolveInterior(nx, nz, radius, true);
    if (Math.hypot(held.x - nx, held.z - nz) > 1e-6) hit = true;
    cx = held.x;
    cz = held.z;
  }
  return { x: cx, z: cz, exited, hit };
}

export function integrateInterior(
  x: number,
  z: number,
  vx: number,
  vz: number,
  steps: number,
  radius: number,
): InteriorStep {
  let cx = x;
  let cz = z;
  let exited = false;
  let hit = false;
  const count = Math.max(0, Math.floor(steps));
  for (let i = 0; i < count; i++) {
    const step = stepInterior(cx, cz, vx * FIXED_DT, vz * FIXED_DT, radius);
    cx = step.x;
    cz = step.z;
    exited = exited || step.exited;
    hit = hit || step.hit;
  }
  return { x: cx, z: cz, exited, hit };
}
