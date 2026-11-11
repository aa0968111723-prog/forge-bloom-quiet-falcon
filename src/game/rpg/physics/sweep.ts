import { COLLIDERS, resolveCollision, type AABB } from "../../world-data/colliders.ts";
import { sampleGroundElevation } from "../../world-data/elevation.ts";

export type SweepQuery = {
  x: number;
  z: number;
  dx: number;
  dz: number;
  radius: number;
  extra?: readonly AABB[];
};

export type SweepResult = {
  hit: boolean;
  /** Contact along the cast, before the slide. y is ground height there. */
  landed: { x: number; z: number; y: number };
  normal: { x: number; z: number };
  /** Position after sliding along the wall. y is ground height there. */
  end: { x: number; z: number; y: number };
};

type RayHit = { t: number; nx: number; nz: number; inside: boolean };

function expand(box: AABB, radius: number): AABB {
  return {
    minX: box.minX - radius,
    maxX: box.maxX + radius,
    minZ: box.minZ - radius,
    maxZ: box.maxZ + radius,
  };
}

function pointInside(x: number, z: number, box: AABB) {
  const skin = 1e-6;
  return x > box.minX + skin && x < box.maxX - skin && z > box.minZ + skin && z < box.maxZ - skin;
}

function outward(x: number, z: number, box: AABB) {
  const left = x - box.minX;
  const right = box.maxX - x;
  const south = z - box.minZ;
  const north = box.maxZ - z;
  const nearest = Math.min(left, right, south, north);
  if (nearest === left) return { x: -1, z: 0 };
  if (nearest === right) return { x: 1, z: 0 };
  if (nearest === south) return { x: 0, z: -1 };
  return { x: 0, z: 1 };
}

function rayBox(ox: number, oz: number, dx: number, dz: number, box: AABB): RayHit | null {
  if (pointInside(ox, oz, box)) {
    const n = outward(ox, oz, box);
    return { t: 0, nx: n.x, nz: n.z, inside: true };
  }
  let tmin = 0;
  let tmax = 1;
  let nx = 0;
  let nz = 0;
  let entered = false;
  const slabs = [
    { d: dx, o: ox, min: box.minX, max: box.maxX, axis: "x" as const },
    { d: dz, o: oz, min: box.minZ, max: box.maxZ, axis: "z" as const },
  ];
  for (const slab of slabs) {
    if (Math.abs(slab.d) < 1e-12) {
      if (slab.o < slab.min || slab.o > slab.max) return null;
      continue;
    }
    let tNear = (slab.min - slab.o) / slab.d;
    let tFar = (slab.max - slab.o) / slab.d;
    let nNear = -1;
    if (tNear > tFar) {
      const swap = tNear;
      tNear = tFar;
      tFar = swap;
      nNear = 1;
    }
    if (tNear > tmin + 1e-8) {
      tmin = tNear;
      entered = true;
      if (slab.axis === "x") {
        nx = nNear;
        nz = 0;
      } else {
        nx = 0;
        nz = nNear;
      }
    } else if (entered && tNear > 0 && Math.abs(tNear - tmin) <= 1e-8) {
      if (slab.axis === "x") nx += nNear;
      else nz += nNear;
    }
    if (tFar < tmax) tmax = tFar;
    if (tmin > tmax + 1e-8) return null;
  }
  if (!entered || tmin > 1 || tmax < 0 || tmin < 0) return null;
  const length = Math.hypot(nx, nz) || 1;
  return { t: tmin, nx: nx / length, nz: nz / length, inside: false };
}

function groundAt(x: number, z: number) {
  return { x, z, y: sampleGroundElevation(x, z) };
}

/**
 * Circle cast against COLLIDERS plus optional extra boxes.
 * resolveCollision runs on the slid point so the old push-out still applies.
 */
export function sweepCircle(query: SweepQuery): SweepResult {
  const extra = query.extra ?? [];
  const blocks = extra.length ? COLLIDERS.concat(extra) : COLLIDERS;
  const expanded = blocks.map((box) => expand(box, query.radius));
  let x = query.x;
  let z = query.z;
  let dx = query.dx;
  let dz = query.dz;
  let hit = false;
  let nx = 0;
  let nz = 0;
  let landedX = x;
  let landedZ = z;
  for (let iter = 0; iter < 3; iter++) {
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-8) break;
    let best: RayHit | null = null;
    for (const box of expanded) {
      const cast = rayBox(x, z, dx, dz, box);
      if (!cast) continue;
      if (!best || cast.t < best.t) best = cast;
    }
    if (!best) {
      x += dx;
      z += dz;
      break;
    }
    hit = true;
    nx = best.nx;
    nz = best.nz;
    if (best.inside) break;
    const stop = Math.max(0, best.t * dist - 0.001);
    const t = Math.min(1, stop / dist);
    x += dx * t;
    z += dz * t;
    landedX = x;
    landedZ = z;
    let rx = dx * (1 - t);
    let rz = dz * (1 - t);
    const into = rx * nx + rz * nz;
    if (into < 0) {
      rx -= nx * into;
      rz -= nz * into;
    }
    dx = rx;
    dz = rz;
  }
  const resolved = resolveCollision(x, z, query.radius, extra);
  const pushX = resolved.x - x;
  const pushZ = resolved.z - z;
  const push = Math.hypot(pushX, pushZ);
  // resolveCollision can stop a step the ray still calls clear. That push is a hit.
  if (push > 1e-4) {
    const sawRay = hit;
    hit = true;
    nx = pushX / push;
    nz = pushZ / push;
    if (!sawRay) {
      landedX = resolved.x;
      landedZ = resolved.z;
    }
  }
  const end = groundAt(resolved.x, resolved.z);
  const landed = hit ? groundAt(landedX, landedZ) : end;
  return { hit, landed, normal: { x: nx, z: nz }, end };
}

/** Frozen name for the sweep cast. */
export const SWEEP = sweepCircle;
