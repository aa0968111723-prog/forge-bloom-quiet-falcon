import type { AABB } from "../../world-data/colliders.ts";
import { FIXED_DT } from "./clock.ts";
import { sampleContact } from "./contact.ts";
import { sweepCircle } from "./sweep.ts";

/**
 * Two integrations that were given the same step count stay inside this many metres.
 * Compared sequences must come from the clock; raw wall-clock time is not the input.
 */
export const POSITION_TOLERANCE_M = 1e-4;

const DRAG = 4;

export type KnockResult = {
  x: number;
  z: number;
  vx: number;
  vz: number;
  hit: boolean;
};

/**
 * Impulse is kg·m/s. Integration uses FIXED_DT only, `steps` times.
 * The end point is pushed out by sweepCircle, which calls resolveCollision.
 */
export function knockback(input: {
  x: number;
  z: number;
  impulseX: number;
  impulseZ: number;
  steps: number;
  mass?: number;
  radius?: number;
  extra?: readonly AABB[];
}): KnockResult {
  const mass = input.mass ?? 70;
  const radius = input.radius ?? 0.45;
  const extra = input.extra ?? [];
  let x = input.x;
  let z = input.z;
  let vx = input.impulseX / mass;
  let vz = input.impulseZ / mass;
  let hit = false;
  const steps = Math.max(0, Math.floor(input.steps));
  for (let i = 0; i < steps; i++) {
    const keep = Math.max(0, 1 - sampleContact(x, z).friction * DRAG * FIXED_DT);
    vx *= keep;
    vz *= keep;
    const cast = sweepCircle({
      x,
      z,
      dx: vx * FIXED_DT,
      dz: vz * FIXED_DT,
      radius,
      extra,
    });
    x = cast.end.x;
    z = cast.end.z;
    if (cast.hit) {
      hit = true;
      const into = vx * cast.normal.x + vz * cast.normal.z;
      if (into < 0) {
        vx -= cast.normal.x * into;
        vz -= cast.normal.z * into;
      }
    }
  }
  return { x, z, vx, vz, hit };
}
