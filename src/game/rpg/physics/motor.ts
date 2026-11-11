import type { AABB } from "../../world-data/colliders.ts";
import { FIXED_DT } from "./clock.ts";
import { GRAVITY, MAX_CLIMB_GRADE, STEP_UP_M, sampleContact } from "./contact.ts";
import { sweepCircle } from "./sweep.ts";

export type Walker = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  grounded: boolean;
};

export function createWalker(x: number, z: number, radius = 0.45): Walker {
  return {
    x,
    y: sampleContact(x, z).height,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    radius,
    grounded: true,
  };
}

function approach(current: number, wish: number, rate: number) {
  const delta = wish - current;
  const limit = rate * FIXED_DT;
  if (Math.abs(delta) <= limit) return wish;
  return current + Math.sign(delta) * limit;
}

/**
 * One or more fixed steps. Wish velocities are metres per second on the ground.
 * Falling does not bounce, and a short riser is a step rather than a wall.
 */
export function stepWalker(
  walker: Walker,
  wishX: number,
  wishZ: number,
  steps: number,
  extra: readonly AABB[] = [],
): Walker {
  const next = { ...walker };
  const count = Math.max(0, Math.floor(steps));
  for (let i = 0; i < count; i++) {
    const here = sampleContact(next.x, next.z);
    if (next.grounded) {
      const rate = 6 + here.friction * 18;
      next.vx = approach(next.vx, wishX, rate);
      next.vz = approach(next.vz, wishZ, rate);
      if (wishX === 0 && wishZ === 0) {
        const keep = Math.max(0, 1 - here.friction * 6 * FIXED_DT);
        next.vx *= keep;
        next.vz *= keep;
      }
    }
    const cast = sweepCircle({
      x: next.x,
      z: next.z,
      dx: next.vx * FIXED_DT,
      dz: next.vz * FIXED_DT,
      radius: next.radius,
      extra,
    });
    const nx = cast.end.x;
    const nz = cast.end.z;
    const ground = sampleContact(nx, nz).height;
    const rise = ground - here.height;
    const run = Math.hypot(nx - next.x, nz - next.z);
    const grade = run > 1e-6 ? rise / run : 0;
    if (next.grounded && rise > STEP_UP_M && grade > MAX_CLIMB_GRADE) {
      next.vx = 0;
      next.vz = 0;
      next.y = here.height;
      next.vy = 0;
    } else if (next.grounded && rise < -STEP_UP_M) {
      next.x = nx;
      next.z = nz;
      next.grounded = false;
      next.vy = Math.min(next.vy, 0);
    } else if (next.grounded) {
      next.x = nx;
      next.z = nz;
      next.y = ground;
      next.vy = 0;
      next.grounded = true;
    } else {
      next.x = nx;
      next.z = nz;
    }
    if (cast.hit) {
      const into = next.vx * cast.normal.x + next.vz * cast.normal.z;
      if (into < 0) {
        next.vx -= cast.normal.x * into;
        next.vz -= cast.normal.z * into;
      }
    }
    if (!next.grounded) {
      next.vy -= GRAVITY * FIXED_DT;
      next.y += next.vy * FIXED_DT;
      const floor = sampleContact(next.x, next.z).height;
      if (next.y <= floor) {
        next.y = floor;
        next.vy = 0;
        next.grounded = true;
      }
    }
  }
  return next;
}
