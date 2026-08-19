import { AXIS, DOLPHIN_ISLAND_RADIUS } from "./axis.ts";
import { KENAN, KENAN_TOP_Z } from "./kenan.ts";
import { LANDMARKS, LIBRARY, PALACE, palaceHallZs } from "./landmarks.ts";
import { WORLD_BOUNDS } from "./origin.ts";
import { SECONDARY_STRUCTURES } from "./zones/secondary.ts";

export type AABB = { minX: number; maxX: number; minZ: number; maxZ: number };

function box(cx: number, cz: number, width: number, depth: number): AABB {
  return { minX: cx - width / 2, maxX: cx + width / 2, minZ: cz - depth / 2, maxZ: cz + depth / 2 };
}

/**
 * Solid volumes, derived from the same data that builds the geometry so a
 * building can never drift away from its collider.
 *
 * The 克難坡 retaining walls are included deliberately: they stop the player
 * walking off a tread into the planted bank *and* stop the third-person camera
 * pushing through the wall on the way up.
 */
function buildColliders(): AABB[] {
  const out: AABB[] = [];

  // 宮燈教室 — five halls a side, long axis along the avenue.
  for (const z of palaceHallZs()) {
    out.push(box(-PALACE.offsetX, z, PALACE.hallDepth, PALACE.hallWidth));
    out.push(box(PALACE.offsetX, z, PALACE.hallDepth, PALACE.hallWidth));
  }

  // 覺生紀念圖書館
  out.push(box(LIBRARY.center[0], LIBRARY.center[1], LIBRARY.width, LIBRARY.length));

  // 克難坡 護牆 (left / right), stair section only — the aprons stay open.
  const wallOuter = KENAN.width / 2 + KENAN.wallThickness;
  const stairMinZ = KENAN_TOP_Z;
  const stairMaxZ = KENAN.bottomZ;
  out.push({
    minX: -wallOuter,
    maxX: -KENAN.width / 2,
    minZ: stairMinZ,
    maxZ: stairMaxZ,
  });
  out.push({
    minX: KENAN.width / 2,
    maxX: wallOuter,
    minZ: stairMinZ,
    maxZ: stairMaxZ,
  });

  // 坡底 entrance piers
  out.push(box(-KENAN.bottomApronWidth / 2 - 0.5, AXIS.gateZ, 1.1, 1.1));
  out.push(box(KENAN.bottomApronWidth / 2 + 0.5, AXIS.gateZ, 1.1, 1.1));

  // 驚聲銅像 plinth
  out.push(box(0, 0, 3.2, 3.2));

  // 海豚里程碑 plinth on the roundabout island
  out.push(box(0, AXIS.dolphinZ, 3.4, 3.4));

  // 書卷廣場 — four separate blades, walkable between.
  for (const [dx, dz] of [
    [-4.6, 4.6],
    [4.6, 4.6],
    [-4.6, -4.6],
    [4.6, -4.6],
  ] as const) {
    out.push(box(dx, AXIS.scrollPlazaZ + dz, 3.0, 3.0));
  }

  // Out-of-scope context structures.
  for (const s of SECONDARY_STRUCTURES) {
    if (s.kind === "court") continue;
    out.push(box(s.position[0], s.position[1], s.size[0], s.size[2]));
  }

  return out;
}

export const COLLIDERS: AABB[] = buildColliders();

/** Island kerb of the dolphin roundabout, kept out of COLLIDERS so it is walkable. */
export const DOLPHIN_ISLAND = {
  center: [0, AXIS.dolphinZ] as const,
  radius: DOLPHIN_ISLAND_RADIUS,
};

/**
 * Push a circle of `radius` out of every collider, then clamp to the world.
 * Kept as a pure function so the traversal tests can walk the route headlessly.
 */
export function resolveCollision(
  x: number,
  z: number,
  radius: number,
): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (const b of COLLIDERS) {
    const cx = Math.min(Math.max(px, b.minX), b.maxX);
    const cz = Math.min(Math.max(pz, b.minZ), b.maxZ);
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 < 1e-8) {
      const left = px - b.minX;
      const right = b.maxX - px;
      const top = pz - b.minZ;
      const bot = b.maxZ - pz;
      const m = Math.min(left, right, top, bot);
      if (m === left) px = b.minX - radius;
      else if (m === right) px = b.maxX + radius;
      else if (m === top) pz = b.minZ - radius;
      else pz = b.maxZ + radius;
      continue;
    }
    const d = Math.sqrt(d2);
    const push = (radius - d) / d;
    px += dx * push;
    pz += dz * push;
  }
  px = Math.min(Math.max(px, WORLD_BOUNDS.minX + 8), WORLD_BOUNDS.maxX - 8);
  pz = Math.min(Math.max(pz, WORLD_BOUNDS.minZ + 8), WORLD_BOUNDS.maxZ - 8);
  return { x: px, z: pz };
}

/** Nearest landmark whose stamp radius contains the point. */
export function landmarkAt(x: number, z: number) {
  let best: (typeof LANDMARKS)[number] | null = null;
  let bestD = Infinity;
  for (const l of LANDMARKS) {
    const d = Math.hypot(x - l.interact.x, z - l.interact.z);
    if (d < l.interact.radius && d < bestD) {
      best = l;
      bestD = d;
    }
  }
  return best;
}
