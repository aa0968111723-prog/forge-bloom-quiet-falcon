import { COLLIDERS, resolveCollision, type AABB } from "../../world-data/colliders.ts";
import { sampleGroundElevation } from "../../world-data/elevation.ts";

export type CameraPoint = { x: number; y: number; z: number };

function blocked(x: number, z: number, radius: number, extra: readonly AABB[]) {
  const boxes = extra.length ? COLLIDERS.concat(extra) : COLLIDERS;
  const limit = radius * radius - 1e-8;
  for (const box of boxes) {
    const cx = Math.min(Math.max(x, box.minX), box.maxX);
    const cz = Math.min(Math.max(z, box.minZ), box.maxZ);
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < limit) return true;
  }
  return false;
}

function clearAlong(
  focus: CameraPoint,
  desired: CameraPoint,
  radius: number,
  extra: readonly AABB[],
): CameraPoint {
  if (!blocked(desired.x, desired.z, radius, extra)) return { ...desired };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const x = focus.x + (desired.x - focus.x) * mid;
    const z = focus.z + (desired.z - focus.z) * mid;
    if (blocked(x, z, radius, extra)) hi = mid;
    else lo = mid;
  }
  const t = Math.max(0, lo - 0.02);
  return {
    x: focus.x + (desired.x - focus.x) * t,
    y: focus.y + (desired.y - focus.y) * t,
    z: focus.z + (desired.z - focus.z) * t,
  };
}

function lift(point: CameraPoint): CameraPoint {
  const floor = sampleGroundElevation(point.x, point.z) + 0.4;
  return point.y < floor ? { ...point, y: floor } : point;
}

/**
 * Pull a desired camera back to the last clear point, then blend from previous.
 * The blend is discarded when it would enter a collider.
 */
export function cameraClearance(input: {
  focus: CameraPoint;
  desired: CameraPoint;
  previous?: CameraPoint;
  radius?: number;
  extra?: readonly AABB[];
  blend?: number;
}): CameraPoint {
  const radius = input.radius ?? 0.35;
  const extra = input.extra ?? [];
  const clear = lift(clearAlong(input.focus, input.desired, radius, extra));
  const blend = Math.min(1, Math.max(0, input.blend ?? 0.35));
  const previous = input.previous ?? clear;
  let x = previous.x + (clear.x - previous.x) * blend;
  let y = previous.y + (clear.y - previous.y) * blend;
  let z = previous.z + (clear.z - previous.z) * blend;
  if (blocked(x, z, radius, extra)) {
    x = clear.x;
    y = clear.y;
    z = clear.z;
  }
  if (blocked(x, z, radius, extra)) {
    const pushed = resolveCollision(x, z, radius, extra);
    x = pushed.x;
    z = pushed.z;
  }
  const placed = lift({ x, y, z });
  // A hall corner can leave only a few centimetres of the view line clear.
  // Raise the camera until it is 2.2 m from the look point so the frame does
  // not sit inside the character's head.
  const MIN_RANGE = 2.2;
  const hx = placed.x - input.focus.x;
  const hz = placed.z - input.focus.z;
  const horizontal = Math.hypot(hx, hz);
  if (horizontal < MIN_RANGE) {
    const raised = input.focus.y + Math.sqrt(MIN_RANGE * MIN_RANGE - horizontal * horizontal);
    if (placed.y < raised) placed.y = raised;
  }
  return placed;
}
