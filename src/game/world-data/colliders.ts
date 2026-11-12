import { AXIS, DOLPHIN_ISLAND_RADIUS, PLAZA_FLAGPOLE, SCROLL_WEST_WALL } from "./axis.ts";
import { KENAN, KENAN_TOP_Z } from "./kenan.ts";
import { BOLLARD, CAMPUS_GATE, LANDMARKS, LANTERN_BASE, LIBRARY, LIBRARY_BASE_MARGIN, PALACE, READING_GIRL, SHEPHERD, TIGER_STELE, benchFootprint, benches, bollards, lanternPosts, libraryPorchPosts, noticeboardFootprint, noticeboards, palaceColumns, palaceHallZs, planterFootprint, planters, textSignAabb, textSigns, utilityBoxFootprint, utilityBoxes } from "./landmarks.ts";
import { LIBRARY_RAMP } from "./library-ramp.ts";
import { WORLD_BOUNDS } from "./origin.ts";
import { SHORE_X } from "./vista.ts";
import { exhibitFootprint, MUSEUM_EXHIBITS } from "./exhibits.ts";
import { SECONDARY_STRUCTURES, gatePiers, pavilionPosts, standBlocks } from "./zones/secondary.ts";

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
  for (const col of palaceColumns()) out.push(box(col.x, col.z, 0.4, 0.4));

  // 覺生紀念圖書館
  out.push(box(LIBRARY.center[0], LIBRARY.center[1], LIBRARY.width, LIBRARY.length));
  for (const post of libraryPorchPosts()) out.push(box(post.x, post.z, 0.7, 0.7));
  // The 1.1 m plinth skirt. The ramp keeps a gap in the south edge.
  {
    const margin = LIBRARY_BASE_MARGIN;
    const cx = LIBRARY.center[0];
    const cz = LIBRARY.center[1];
    const hx = LIBRARY.width / 2;
    const hz = LIBRARY.length / 2;
    const gapPad = 0.6;
    const gapMinX = LIBRARY_RAMP.x - LIBRARY_RAMP.width / 2 - LIBRARY_RAMP.skirt - gapPad;
    const gapMaxX = LIBRARY_RAMP.x + LIBRARY_RAMP.width / 2 + LIBRARY_RAMP.skirt + gapPad;
    out.push({ minX: cx - hx - margin, maxX: cx - hx, minZ: cz - hz - margin, maxZ: cz + hz + margin });
    out.push({ minX: cx + hx, maxX: cx + hx + margin, minZ: cz - hz - margin, maxZ: cz + hz + margin });
    out.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz - margin, maxZ: cz - hz });
    out.push({ minX: cx - hx, maxX: gapMinX, minZ: cz + hz, maxZ: cz + hz + margin });
    out.push({ minX: gapMaxX, maxX: cx + hx, minZ: cz + hz, maxZ: cz + hz + margin });
  }
  // 館前「閱讀的女孩」的石座。西側長椅，不壓在坡道上。
  out.push(box(READING_GIRL.x, READING_GIRL.z, READING_GIRL.pad, READING_GIRL.pad));

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

  for (const sign of textSigns()) {
    const face = textSignAabb(sign);
    out.push({ minX: face.minX, maxX: face.maxX, minZ: face.minZ, maxZ: face.maxZ });
  }

  // 坡底 entrance piers
  out.push(box(-KENAN.bottomApronWidth / 2 - 0.5, AXIS.gateZ, 1.1, 1.1));
  out.push(box(KENAN.bottomApronWidth / 2 + 0.5, AXIS.gateZ, 1.1, 1.1));

  // 水源街校門 piers. The beam stays open overhead.
  for (const side of [-1, 1] as const) {
    out.push(box(side * CAMPUS_GATE.halfSpan, CAMPUS_GATE.z, CAMPUS_GATE.pier, CAMPUS_GATE.pier));
  }

  // 驚聲銅像 plinth
  out.push(box(0, 0, 3.2, 3.2));
  out.push(box(PLAZA_FLAGPOLE.x, PLAZA_FLAGPOLE.z, PLAZA_FLAGPOLE.base, PLAZA_FLAGPOLE.base));

  // 牧羊草坪的紀念雕塑。石座連人一起擋，蓋章點留在南側。
  out.push(box(SHEPHERD.x, SHEPHERD.z, SHEPHERD.pad, SHEPHERD.pad));

  // 海豚里程碑 plinth on the roundabout island
  out.push(box(0, AXIS.dolphinZ, 3.4, 3.4));

  // 五虎碑。石座連同環繞的銅雕一起擋，蓋章點留在北側空地。
  out.push(box(TIGER_STELE.x, TIGER_STELE.z, TIGER_STELE.pad, TIGER_STELE.pad));

  for (const post of bollards()) out.push(box(post.x, post.z, BOLLARD.diameter, BOLLARD.diameter));

  // 書卷廣場 — four separate blades, walkable between.
  for (const [dx, dz] of [
    [-4.6, 4.6],
    [4.6, 4.6],
    [-4.6, -4.6],
    [4.6, -4.6],
  ] as const) {
    out.push(box(dx, AXIS.scrollPlazaZ + dz, 3.0, 3.0));
  }
  out.push(box(SCROLL_WEST_WALL.x, SCROLL_WEST_WALL.z, SCROLL_WEST_WALL.width, SCROLL_WEST_WALL.depth));

  // Near bank of the river vista. The water, far town, and ridges are scenery.
  out.push({
    minX: -620,
    maxX: SHORE_X,
    minZ: WORLD_BOUNDS.minZ - 20,
    maxZ: WORLD_BOUNDS.maxZ + 20,
  });

  // Out-of-scope context structures.
  for (const s of SECONDARY_STRUCTURES) {
    if (s.kind === "court") continue;
    if (s.kind === "gate") {
      for (const pier of gatePiers(s)) out.push(box(pier.x, pier.z, pier.w, pier.d));
      continue;
    }
    if (s.kind === "pavilion") {
      for (const post of pavilionPosts(s)) out.push(box(post.x, post.z, post.w, post.d));
      continue;
    }
    if (s.kind === "stand") {
      for (const block of standBlocks(s)) out.push(box(block.x, block.z, block.w, block.d));
      continue;
    }
    out.push(box(s.position[0], s.position[1], s.size[0], s.size[2]));
  }

  // 海事博物館舷側的展示機。機身連機翼一起擋，南門留在館外。
  for (const item of MUSEUM_EXHIBITS) {
    const foot = exhibitFootprint(item);
    out.push(box(foot.x, foot.z, foot.w, foot.d));
  }

  // 宮燈 stone bases. The 6 m paved centre stays open.
  for (const post of lanternPosts()) out.push(box(post.x, post.z, LANTERN_BASE, LANTERN_BASE));

  for (const board of noticeboards()) {
    const footprint = noticeboardFootprint(board);
    out.push(box(footprint.x, footprint.z, footprint.width, footprint.depth));
  }

  for (const cabinet of utilityBoxes()) {
    const footprint = utilityBoxFootprint(cabinet);
    out.push(box(footprint.x, footprint.z, footprint.width, footprint.depth));
  }

  for (const bed of planters()) {
    const footprint = planterFootprint(bed);
    out.push(box(footprint.x, footprint.z, footprint.width, footprint.depth));
  }

  for (const seat of benches()) {
    const footprint = benchFootprint(seat);
    out.push(box(footprint.x, footprint.z, footprint.width, footprint.depth));
  }

  // Library ramp rails. The bars are outside the 1.6 m deck; the centre stays open.
  for (const side of [-1, 1] as const) {
    out.push(box(LIBRARY_RAMP.x + side * 0.95, LIBRARY_RAMP.z, 0.12, LIBRARY_RAMP.length));
  }

  return out;
}

export const COLLIDERS: AABB[] = buildColliders();

/** Lamp poles are registered after props clear themselves off these boxes, so they stay out of COLLIDERS. */
let poleBoxes: AABB[] = [];

export function registerPoleBoxes(boxes: readonly AABB[]) {
  poleBoxes = boxes.slice();
}

/** Lamp shafts registered by props. Sweep casts read this; it stays out of COLLIDERS. */
export function poleAabbs(): readonly AABB[] {
  return poleBoxes;
}

/** Specimen trunks, registered by vegetation after placement. Kept out of COLLIDERS so a tree is not inside itself. */
let trunkBoxes: AABB[] = [];

export function registerTrunkBoxes(boxes: readonly AABB[]) {
  trunkBoxes = boxes.slice();
}

/** Specimen trunks registered by vegetation. Sweep casts read this; it stays out of COLLIDERS. */
export function trunkAabbs(): readonly AABB[] {
  return trunkBoxes;
}

/** Short enough that a 13 m/s dodge cannot step past a 0.18 m pole, a trunk centre, a 1 m gate pier, or a sign board. */
export const COLLISION_SUBSTEP = 0.2;

export function substepCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
  collide: (x: number, z: number, radius: number) => { x: number; z: number } = (px, pz, r) =>
    resolveCollision(px, pz, r),
): { x: number; z: number } {
  const dist = Math.hypot(dx, dz);
  const n = Math.max(1, Math.ceil(dist / COLLISION_SUBSTEP));
  let px = x;
  let pz = z;
  for (let i = 0; i < n; i++) {
    const next = collide(px + dx / n, pz + dz / n, radius);
    px = next.x;
    pz = next.z;
  }
  return { x: px, z: pz };
}

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
  extra: readonly AABB[] = [],
): { x: number; z: number } {
  let px = x;
  let pz = z;
  const blocks = extra.length
    ? COLLIDERS.concat(poleBoxes, trunkBoxes, extra as AABB[])
    : COLLIDERS.concat(poleBoxes, trunkBoxes);
  for (const b of blocks) {
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
  // The shore volume covers the whole map in Z. Near the north or south end the
  // nearest face is that Z edge, and the world clamp then drops the player
  // back inside the water. A saved position west of the bank always returns
  // to the walkable side instead.
  if (px < SHORE_X + radius) px = SHORE_X + radius;
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
