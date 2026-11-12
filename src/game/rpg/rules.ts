import { COLLIDERS, resolveCollision } from "../world-data/colliders.ts";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { WORLD_BOUNDS } from "../world-data/origin.ts";
import { terrainHeight } from "../world.ts";
import { CAMPUS_ROADS, CAMPUS_SITES, siteEntrance, type CampusSite } from "./campus.ts";
import { keepOut } from "../../features/items-equipment-building/keepout.ts";
import { RECIPES, type BuildKind } from "./data.ts";
import {
  CLASSROOM_DESK,
  HOOP_STANDS,
  MUSEUM_SWAN,
  READING_CARRELS,
  ROOM_TABLES,
  ROOM_TABLE_SIZE,
  SWIMMING_POOL,
} from "./interior-layout.ts";
export type Building = {
  id: string;
  kind: BuildKind;
  x: number;
  z: number;
  rotation: number;
  hp: number;
};
export const FACILITY_CAP = 48;
export const FACILITY_CAP_NOTICE = `基地已達 ${FACILITY_CAP} 座設施上限`;
export function footprint(kind: BuildKind, rotation: number) {
  const r = RECIPES.find((v) => v.id === kind)!;
  const swap = Math.round(rotation / (Math.PI / 2)) % 2 !== 0;
  return { width: swap ? r.depth : r.width, depth: swap ? r.width : r.depth };
}
const PASSAGE_BACK = 0.8;
const PASSAGE_FORWARD = 2.4;
const PASSAGE_WIDTH = 2.2;
const STAND_RADIUS = 0.42;
const STAND_HOLD = 0.05;

export type DoorOverlap = {
  entrance: boolean;
  exit: boolean;
  passage: boolean;
};

function unitOutward(site: CampusSite, entrance: { x: number; z: number }) {
  let x = entrance.x - site.x;
  let z = entrance.z - site.z;
  const length = Math.hypot(x, z);
  if (length < 1e-6) return { x: 0, z: 1 };
  return { x: x / length, z: z / length };
}

/** Outdoor stand and the short band in front of one campus door. */
export function siteDoor(site: CampusSite) {
  const entrance = siteEntrance(site);
  const outward = unitOutward(site, entrance);
  const length = PASSAGE_BACK + PASSAGE_FORWARD;
  const along = (PASSAGE_FORWARD - PASSAGE_BACK) / 2;
  return {
    entrance,
    exit: entrance,
    passage: {
      x: entrance.x + outward.x * along,
      z: entrance.z + outward.z * along,
      ux: outward.x,
      uz: outward.z,
      halfL: length / 2,
      halfW: PASSAGE_WIDTH / 2,
    },
  };
}

function pointInFootprint(
  x: number,
  z: number,
  hx: number,
  hz: number,
  px: number,
  pz: number,
) {
  return Math.abs(px - x) < hx && Math.abs(pz - z) < hz;
}

function separated(
  axisX: number,
  axisZ: number,
  a: number[][],
  b: number[][],
) {
  const project = (corners: number[][]) => {
    let min = Infinity;
    let max = -Infinity;
    for (const [px, pz] of corners) {
      const v = px * axisX + pz * axisZ;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return [min, max];
  };
  const [a0, a1] = project(a);
  const [b0, b1] = project(b);
  return a1 <= b0 || b1 <= a0;
}

function hitsPassage(
  x: number,
  z: number,
  hx: number,
  hz: number,
  passage: ReturnType<typeof siteDoor>["passage"],
) {
  const sx = -passage.uz;
  const sz = passage.ux;
  const box = [
    [x - hx, z - hz],
    [x + hx, z - hz],
    [x + hx, z + hz],
    [x - hx, z + hz],
  ];
  const signs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const band = signs.map(([a, b]) => [
    passage.x + passage.ux * passage.halfL * a + sx * passage.halfW * b,
    passage.z + passage.uz * passage.halfL * a + sz * passage.halfW * b,
  ]);
  const axes = [
    [1, 0],
    [0, 1],
    [passage.ux, passage.uz],
    [sx, sz],
  ];
  return axes.every(([ax, az]) => !separated(ax, az, box, band));
}

/** Which doorway parts this footprint covers. Restore does not consult it. */
export function doorOverlap(
  kind: BuildKind,
  x: number,
  z: number,
  rotation: number,
): DoorOverlap {
  const hit = { entrance: false, exit: false, passage: false };
  if (
    ![x, z, rotation].every(Number.isFinite) ||
    !RECIPES.some((r) => r.id === kind)
  )
    return hit;
  const f = footprint(kind, rotation);
  const hx = f.width / 2 + 0.4;
  const hz = f.depth / 2 + 0.4;
  for (const site of CAMPUS_SITES) {
    const door = siteDoor(site);
    if (pointInFootprint(x, z, hx, hz, door.entrance.x, door.entrance.z))
      hit.entrance = true;
    if (pointInFootprint(x, z, hx, hz, door.exit.x, door.exit.z))
      hit.exit = true;
    if (hitsPassage(x, z, hx, hz, door.passage)) hit.passage = true;
    if (hit.entrance && hit.exit && hit.passage) break;
  }
  return hit;
}

export function validatePlacement(
  kind: BuildKind,
  x: number,
  z: number,
  rotation: number,
  buildings: Building[],
  player?: { x: number; z: number },
  doors = true,
): string | null {
  if (
    ![x, z, rotation].every(Number.isFinite) ||
    !RECIPES.some((r) => r.id === kind)
  )
    return "無效的建造資料";
  const f = footprint(kind, rotation),
    hx = f.width / 2 + 0.4,
    hz = f.depth / 2 + 0.4;
  if (buildings.length >= FACILITY_CAP) return FACILITY_CAP_NOTICE;
  if (
    x - hx < WORLD_BOUNDS.minX + 10 ||
    x + hx > WORLD_BOUNDS.maxX - 10 ||
    z - hz < WORLD_BOUNDS.minZ + 10 ||
    z + hz > WORLD_BOUNDS.maxZ - 10 ||
    x < -112
  )
    return "此處不在可建造校園範圍";
  if (z > 2 && Math.abs(x) < 15) return "請保留克難坡通行空間";
  if (player && Math.hypot(x - player.x, z - player.z) < Math.max(hx, hz) + 0.8)
    return "設施離角色太近";
  if (
    COLLIDERS.some(
      (b) =>
        x + hx > b.minX &&
        x - hx < b.maxX &&
        z + hz > b.minZ &&
        z - hz < b.maxZ,
    )
  )
    return "與校園建築重疊";
  if (
    buildings.some((b) => {
      const other = footprint(b.kind, b.rotation);
      return (
        Math.abs(x - b.x) < hx + other.width / 2 &&
        Math.abs(z - b.z) < hz + other.depth / 2
      );
    })
  )
    return "與既有設施重疊";
  const ys = [
    [-hx, -hz],
    [hx, -hz],
    [-hx, hz],
    [hx, hz],
  ].map(([dx, dz]) => sampleGroundElevation(x + dx, z + dz));
  if (Math.max(...ys) - Math.min(...ys) > 0.7) return "坡度太大，請選平坦地面";
  const passage = keepOut(x, z, f.width, f.depth);
  if (passage) return passage;
  if (doors) {
    const door = doorOverlap(kind, x, z, rotation);
    if (door.entrance || door.exit || door.passage)
      return "請保留建築入口與門口通行空間";
  }
  return null;
}

/** Entrance when it still holds. Otherwise the nearest stand the resolver leaves put. */
export function approachStand(site: CampusSite, buildings: Building[]) {
  const door = siteEntrance(site);
  const bare = resolveBuildings(door.x, door.z, STAND_RADIUS, []);
  const occupied = resolveBuildings(door.x, door.z, STAND_RADIUS, buildings);
  if (Math.hypot(occupied.x - bare.x, occupied.z - bare.z) <= STAND_HOLD)
    return { x: door.x, z: door.z };
  const step = 0.5;
  for (let ring = 1; ring <= 24; ring++) {
    const radius = ring * step;
    const count = Math.max(8, Math.ceil((Math.PI * 2 * radius) / step));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = door.x + Math.cos(angle) * radius;
      const z = door.z + Math.sin(angle) * radius;
      const p = resolveBuildings(x, z, STAND_RADIUS, buildings);
      if (Math.hypot(p.x - x, p.z - z) > STAND_HOLD) continue;
      return { x, z };
    }
  }
  return { x: door.x, z: door.z };
}
/** Building footprints and a terrain step. The combat sight check uses this. */
export function clearSight(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  buildings: Building[],
) {
  const steps = Math.ceil(Math.hypot(ax - bx, az - bz) / 0.7);
  for (let i = 1; i < steps; i++) {
    const t = i / steps,
      x = ax + (bx - ax) * t,
      z = az + (bz - az) * t;
    const p = resolveBuildings(x, z, 0.1, buildings);
    if (Math.hypot(p.x - x, p.z - z) > 0.2) return false;
  }
  return Math.abs(terrainHeight(ax, az) - terrainHeight(bx, bz)) < 4;
}
export function resolveBuildings(
  x: number,
  z: number,
  radius: number,
  buildings: Building[],
) {
  let p = resolveCollision(x, z, radius);
  for (const b of buildings) {
    const f = footprint(b.kind, b.rotation),
      hx = f.width / 2 + radius,
      hz = f.depth / 2 + radius;
    const dx = p.x - b.x,
      dz = p.z - b.z;
    if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) continue;
    if (hx - Math.abs(dx) < hz - Math.abs(dz)) p.x = b.x + (dx >= 0 ? hx : -hx);
    else p.z = b.z + (dz >= 0 ? hz : -hz);
  }
  return p;
}
export function levelForXp(xp: number) {
  return Math.min(30, Math.floor(Math.sqrt(Math.max(0, xp) / 60)) + 1);
}
/** Same life cap maxHp() publishes. The badge adds 25. */
export function lifeCap(xp: number, equipped: boolean) {
  return 100 + (levelForXp(xp) - 1) * 8 + (equipped ? 25 : 0);
}
/** Same basic-attack damage attack() deals. The badge adds 5. */
export function basicAttackDamage(xp: number, equipped: boolean) {
  return 20 + (levelForXp(xp) - 1) * 2 + (equipped ? 5 : 0);
}
export function canPay(
  cost: Record<string, number>,
  count: (id: string) => number,
) {
  return Object.entries(cost).every(
    ([id, n]) => Number.isFinite(n) && n >= 0 && count(id) >= n,
  );
}
export function resolveInterior(
  x: number,
  z: number,
  radius: number,
  furnished = true,
  stands = false,
  podium = false,
  carrels = false,
  water = false,
  exhibit = false,
) {
  const minX = -9 + radius, maxX = 9 - radius, minZ = -7 + radius, maxZ = 7 - radius;
  let px = Math.max(minX, Math.min(maxX, x)),
    pz = Math.max(minZ, Math.min(maxZ, z));
  if (stands) {
    for (const stand of HOOP_STANDS) {
      const half = stand.size / 2 + radius;
      if (Math.abs(px - stand.x) >= half || Math.abs(pz - stand.z) >= half) continue;
      const pushX = stand.x + (px >= stand.x ? half : -half);
      const pushZ = stand.z + (pz >= stand.z ? half : -half);
      const penX = half - Math.abs(px - stand.x);
      const penZ = half - Math.abs(pz - stand.z);
      const xOk = pushX >= minX && pushX <= maxX;
      const zOk = pushZ >= minZ && pushZ <= maxZ;
      if (penX < penZ && xOk) px = pushX;
      else if (zOk) pz = pushZ;
      else if (xOk) px = pushX;
      else {
        px = Math.max(minX, Math.min(maxX, px));
        pz = Math.max(minZ, Math.min(maxZ, pz));
      }
    }
  }
  if (podium) {
    const hx = CLASSROOM_DESK.width / 2 + radius;
    const hz = CLASSROOM_DESK.depth / 2 + radius;
    if (Math.abs(px - CLASSROOM_DESK.x) < hx && Math.abs(pz - CLASSROOM_DESK.z) < hz) {
      if (hx - Math.abs(px - CLASSROOM_DESK.x) < hz - Math.abs(pz - CLASSROOM_DESK.z))
        px = CLASSROOM_DESK.x + (px >= CLASSROOM_DESK.x ? hx : -hx);
      else pz = CLASSROOM_DESK.z + (pz >= CLASSROOM_DESK.z ? hz : -hz);
    }
  }
  if (carrels) {
    for (const carrel of READING_CARRELS) {
      const hx = carrel.width / 2 + radius;
      const hz = carrel.depth / 2 + radius;
      if (Math.abs(px - carrel.x) >= hx || Math.abs(pz - carrel.z) >= hz) continue;
      const pushX = carrel.x + (px >= carrel.x ? hx : -hx);
      const pushZ = carrel.z + (pz >= carrel.z ? hz : -hz);
      const penX = hx - Math.abs(px - carrel.x);
      const penZ = hz - Math.abs(pz - carrel.z);
      const xOk = pushX >= minX && pushX <= maxX;
      const zOk = pushZ >= minZ && pushZ <= maxZ;
      if (penX < penZ && xOk) px = pushX;
      else if (zOk) pz = pushZ;
      else if (xOk) px = pushX;
      else {
        px = Math.max(minX, Math.min(maxX, px));
        pz = Math.max(minZ, Math.min(maxZ, pz));
      }
    }
  }
  if (water) {
    const hx = SWIMMING_POOL.halfX + radius;
    const hz = SWIMMING_POOL.halfZ + radius;
    if (Math.abs(px) < hx && Math.abs(pz) < hz) {
      if (hx - Math.abs(px) < hz - Math.abs(pz)) px = px >= 0 ? hx : -hx;
      else pz = pz >= 0 ? hz : -hz;
    }
  }
  if (exhibit) {
    const hx = MUSEUM_SWAN.size / 2 + radius;
    const hz = hx;
    const dx = px - MUSEUM_SWAN.x;
    const dz = pz - MUSEUM_SWAN.z;
    if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
      const pushX = MUSEUM_SWAN.x + (dx >= 0 ? hx : -hx);
      const pushZ = MUSEUM_SWAN.z + (dz >= 0 ? hz : -hz);
      const xFits = pushX >= minX && pushX <= maxX;
      const zFits = pushZ >= minZ && pushZ <= maxZ;
      if (hx - Math.abs(dx) <= hz - Math.abs(dz)) {
        if (xFits) px = pushX;
        else if (zFits) pz = pushZ;
      } else if (zFits) pz = pushZ;
      else if (xFits) px = pushX;
    }
  }
  if (!furnished) return { x: px, z: pz };
  const hx = ROOM_TABLE_SIZE.width / 2 + radius;
  const hz = ROOM_TABLE_SIZE.depth / 2 + radius;
  for (const { x: tableX, z: tableZ } of ROOM_TABLES) {
    if (Math.abs(px - tableX) >= hx || Math.abs(pz - tableZ) >= hz) continue;
    if (hx - Math.abs(px - tableX) < hz - Math.abs(pz - tableZ))
      px = tableX + (px >= tableX ? hx : -hx);
    else pz = tableZ + (pz >= tableZ ? hz : -hz);
  }
  return { x: px, z: pz };
}
export const BASIC_ATTACK_RANGE = 3.7;
export function withinAttack(
  px: number,
  pz: number,
  yaw: number,
  x: number,
  z: number,
  range: number,
  omni = false,
) {
  const dx = x - px,
    dz = z - pz,
    distance = Math.hypot(dx, dz);
  if (distance > range) return false;
  return (
    omni ||
    distance < 0.8 ||
    (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / distance > 0.15
  );
}
export function clearSegment(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  radius = 0.5,
  buildings: Building[] = [],
) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.75));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      x = ax + (bx - ax) * t,
      z = az + (bz - az) * t;
    const p = resolveBuildings(x, z, radius, buildings);
    if (Math.hypot(p.x - x, p.z - z) > 0.05) return false;
  }
  return true;
}
/** Bounded local A*: used by campus entry walks and Yuka steering waypoints. */
export function findWalkablePath(
  start: { x: number; z: number },
  end: { x: number; z: number },
  radius = 0.5,
  buildings: Building[] = [],
): [number, number][] {
  if (clearSegment(start.x, start.z, end.x, end.z, radius, buildings))
    return [
      [start.x, start.z],
      [end.x, end.z],
    ];
  const step = 2,
    margin = 24;
  const minX = Math.floor((Math.min(start.x, end.x) - margin) / step) * step,
    minZ = Math.floor((Math.min(start.z, end.z) - margin) / step) * step;
  const maxX = Math.max(start.x, end.x) + margin,
    maxZ = Math.max(start.z, end.z) + margin;
  const key = (x: number, z: number) => x + "," + z;
  const snap = (p: { x: number; z: number }): [number, number] => [
    Math.round((p.x - minX) / step),
    Math.round((p.z - minZ) / step),
  ];
  const from = snap(start),
    to = snap(end),
    goal = key(to[0], to[1]);
  const open = new Set([key(from[0], from[1])]),
    costs = new Map([[key(from[0], from[1]), 0]]),
    parent = new Map<string, string>(),
    nodes = new Map([[key(from[0], from[1]), from]]);
  const clear = new Map<string, boolean>();
  let attempts = 0;
  while (open.size && attempts++ < 5000) {
    let current = "",
      score = Infinity;
    for (const id of open) {
      const p = nodes.get(id)!;
      const f = costs.get(id)! + Math.hypot(to[0] - p[0], to[1] - p[1]);
      if (f < score) {
        score = f;
        current = id;
      }
    }
    if (current === goal) {
      const route: [number, number][] = [[end.x, end.z]];
      let id = current;
      while (parent.has(id)) {
        const p = nodes.get(id)!;
        route.push([minX + p[0] * step, minZ + p[1] * step]);
        id = parent.get(id)!;
      }
      route.push([start.x, start.z]);
      route.reverse();
      const smooth: [number, number][] = [route[0]];
      let at = 0;
      while (at < route.length - 1) {
        let next = route.length - 1;
        while (
          next > at + 1 &&
          !clearSegment(
            route[at][0],
            route[at][1],
            route[next][0],
            route[next][1],
            radius,
            buildings,
          )
        )
          next--;
        smooth.push(route[next]);
        at = next;
      }
      return smooth;
    }
    open.delete(current);
    const p = nodes.get(current)!;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const nx = p[0] + dx,
        nz = p[1] + dz,
        x = minX + nx * step,
        z = minZ + nz * step,
        id = key(nx, nz);
      if (x < minX || z < minZ || x > maxX || z > maxZ) continue;
      const cost = costs.get(current)! + Math.hypot(dx, dz);
      if (cost >= (costs.get(id) ?? Infinity)) continue;
      const edge = current + "|" + id;
      if (!clear.has(edge))
        clear.set(
          edge,
          clearSegment(
            minX + p[0] * step,
            minZ + p[1] * step,
            x,
            z,
            radius,
            buildings,
          ),
        );
      if (!clear.get(edge)) continue;
      costs.set(id, cost);
      parent.set(id, current);
      nodes.set(id, [nx, nz]);
      open.add(id);
    }
  }
  return [];
}

/**
 * Walk from a site door to a clear point on the estimated road grid.
 * The nearest geometric point can sit inside the building, so the link
 * tries the closest standable samples instead. These links are not a survey.
 */
export function entranceRoadPath(site: CampusSite): [number, number][] {
  const door = siteEntrance(site);
  const ranked = roadStandPoints()
    .map((p) => ({ p, d: (p[0] - door.x) ** 2 + (p[1] - door.z) ** 2 }))
    .sort((a, b) => a.d - b.d);
  for (const cand of ranked.slice(0, 8)) {
    const path = findWalkablePath(door, { x: cand.p[0], z: cand.p[1] }, 1.1);
    if (path.length >= 2) return path;
  }
  return [];
}

let standPoints: [number, number][] | null = null;

function roadStandPoints(): [number, number][] {
  if (standPoints) return standPoints;
  const out: [number, number][] = [];
  for (const poly of CAMPUS_ROADS) {
    for (let i = 1; i < poly.length; i++) {
      const [ax, az] = poly[i - 1];
      const [bx, bz] = poly[i];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / 4));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        const p = resolveCollision(x, z, 1.1);
        if (Math.hypot(p.x - x, p.z - z) < 0.05) out.push([x, z]);
      }
    }
  }
  standPoints = out;
  return out;
}
