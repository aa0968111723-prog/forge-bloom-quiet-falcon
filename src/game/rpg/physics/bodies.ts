import type { AABB } from "../../world-data/colliders.ts";
import { FIXED_DT } from "./clock.ts";
import { sampleContact } from "./contact.ts";
import { sweepCircle } from "./sweep.ts";

export type PropKind = "crate" | "barrier";
export type Mobility = "fixed" | "movable";

export type DynBody = {
  id: string;
  kind: PropKind;
  mobility: Mobility;
  x: number;
  z: number;
  vx: number;
  vz: number;
  mass: number;
  friction: number;
  durability: number;
  maxDurability: number;
  awake: boolean;
  sleeping: boolean;
  radius: number;
  dropSettled: boolean;
  sleepSteps: number;
};

export type PropDrop = {
  id: string;
  kind: PropKind;
  x: number;
  z: number;
};

const SLEEP_SPEED = 0.08;
const SLEEP_STEPS = 8;

export function createProp(kind: PropKind, id: string, x: number, z: number): DynBody {
  if (kind === "barrier") {
    return {
      id,
      kind,
      mobility: "fixed",
      x,
      z,
      vx: 0,
      vz: 0,
      mass: 400,
      friction: 0.85,
      durability: 280,
      maxDurability: 280,
      awake: false,
      sleeping: true,
      radius: 0.75,
      dropSettled: false,
      sleepSteps: 0,
    };
  }
  return {
    id,
    kind,
    mobility: "movable",
    x,
    z,
    vx: 0,
    vz: 0,
    mass: 16,
    friction: 0.5,
    durability: 40,
    maxDurability: 40,
    awake: false,
    sleeping: true,
    radius: 0.42,
    dropSettled: false,
    sleepSteps: 0,
  };
}

function boxOf(body: DynBody): AABB {
  return {
    minX: body.x - body.radius,
    maxX: body.x + body.radius,
    minZ: body.z - body.radius,
    maxZ: body.z + body.radius,
  };
}

/**
 * One event id damages a body once. Fixed barriers take durability and do not move.
 */
export function applyImpulse(
  body: DynBody,
  impulseX: number,
  impulseZ: number,
  eventId: string,
  ledger: Set<string>,
): { body: DynBody; damaged: boolean } {
  const key = `${eventId}:${body.id}`;
  if (ledger.has(key) || body.dropSettled) return { body, damaged: false };
  ledger.add(key);
  const magnitude = Math.hypot(impulseX, impulseZ);
  const damage = magnitude * 0.15;
  const durability = Math.max(0, body.durability - damage);
  if (body.mobility === "fixed") {
    return {
      body: { ...body, durability, awake: damage > 0, sleeping: damage <= 0 },
      damaged: damage > 0,
    };
  }
  return {
    body: {
      ...body,
      durability,
      vx: body.vx + impulseX / body.mass,
      vz: body.vz + impulseZ / body.mass,
      awake: true,
      sleeping: false,
      sleepSteps: 0,
    },
    damaged: damage > 0,
  };
}

function collectDrops(bodies: DynBody[], drops: PropDrop[]) {
  for (const body of bodies) {
    if (body.durability > 0 || body.dropSettled) continue;
    body.dropSettled = true;
    body.durability = 0;
    body.vx = 0;
    body.vz = 0;
    body.awake = false;
    body.sleeping = true;
    drops.push({ id: body.id, kind: body.kind, x: body.x, z: body.z });
  }
}

/**
 * Fixed steps for a few crates and barriers.
 * Overlap damage is once per pair per step, and a broken prop drops once.
 */
export function stepDynamics(
  bodies: readonly DynBody[],
  steps: number,
  extra: readonly AABB[] = [],
): { bodies: DynBody[]; drops: PropDrop[] } {
  const current = bodies.map((body) => ({ ...body }));
  const drops: PropDrop[] = [];
  const count = Math.max(0, Math.floor(steps));
  for (let step = 0; step < count; step++) {
    const struck = new Set<string>();
    for (const body of current) {
      if (body.mobility !== "movable" || body.sleeping || body.dropSettled) continue;
      const mu = Math.max(body.friction, sampleContact(body.x, body.z).friction);
      const keep = Math.max(0, 1 - mu * 3.2 * FIXED_DT);
      const speedBefore = Math.hypot(body.vx, body.vz);
      body.vx *= keep;
      body.vz *= keep;
      const blockers = current
        .filter((other) => other.id !== body.id && other.mobility === "fixed" && !other.dropSettled)
        .map(boxOf);
      const cast = sweepCircle({
        x: body.x,
        z: body.z,
        dx: body.vx * FIXED_DT,
        dz: body.vz * FIXED_DT,
        radius: body.radius,
        extra: extra.concat(blockers),
      });
      body.x = cast.end.x;
      body.z = cast.end.z;
      if (cast.hit) {
        const into = body.vx * cast.normal.x + body.vz * cast.normal.z;
        if (into < 0) {
          body.vx -= cast.normal.x * into;
          body.vz -= cast.normal.z * into;
        }
        if (speedBefore > 0.5) {
          let nearest: DynBody | null = null;
          let nearestD = Infinity;
          for (const other of current) {
            if (other.mobility !== "fixed" || other.dropSettled) continue;
            const distance = Math.hypot(body.x - other.x, body.z - other.z);
            if (distance < nearestD) {
              nearest = other;
              nearestD = distance;
            }
          }
          if (nearest && nearestD < body.radius + nearest.radius + 0.25) {
            const pair = `${step}:${body.id}:${nearest.id}`;
            if (!struck.has(pair)) {
              struck.add(pair);
              const damage = speedBefore * 5;
              body.durability = Math.max(0, body.durability - damage);
              nearest.durability = Math.max(0, nearest.durability - damage);
              nearest.awake = true;
            }
          }
        }
      }
      const speed = Math.hypot(body.vx, body.vz);
      if (speed < SLEEP_SPEED) {
        body.sleepSteps += 1;
        if (body.sleepSteps >= SLEEP_STEPS) {
          body.sleeping = true;
          body.awake = false;
          body.vx = 0;
          body.vz = 0;
        }
      } else {
        body.sleepSteps = 0;
        body.awake = true;
        body.sleeping = false;
      }
    }
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const a = current[i];
        const b = current[j];
        if (!a || !b || a.dropSettled || b.dropSettled) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz) || 1e-8;
        const min = a.radius + b.radius;
        if (dist >= min) continue;
        const nx = dx / dist;
        const nz = dz / dist;
        const pen = min - dist;
        const aFixed = a.mobility === "fixed";
        const bFixed = b.mobility === "fixed";
        if (aFixed && bFixed) continue;
        if (bFixed) {
          a.x -= nx * pen;
          a.z -= nz * pen;
        } else if (aFixed) {
          b.x += nx * pen;
          b.z += nz * pen;
        } else {
          const share = a.mass / (a.mass + b.mass);
          a.x -= nx * pen * (1 - share);
          a.z -= nz * pen * (1 - share);
          b.x += nx * pen * share;
          b.z += nz * pen * share;
        }
        const closing = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (closing > 0.5) {
          const pair = `${step}:${a.id}:${b.id}`;
          if (!struck.has(pair)) {
            struck.add(pair);
            const damage = closing * 5;
            a.durability = Math.max(0, a.durability - damage);
            b.durability = Math.max(0, b.durability - damage);
          }
          if (aFixed) {
            const inward = b.vx * nx + b.vz * nz - (a.vx * nx + a.vz * nz);
            b.vx -= inward * nx;
            b.vz -= inward * nz;
          } else if (bFixed) {
            const vn = a.vx * nx + a.vz * nz;
            a.vx -= vn * nx;
            a.vz -= vn * nz;
          } else {
            const impulse = closing / (1 / a.mass + 1 / b.mass);
            a.vx -= (impulse / a.mass) * nx;
            a.vz -= (impulse / a.mass) * nz;
            b.vx += (impulse / b.mass) * nx;
            b.vz += (impulse / b.mass) * nz;
          }
        }
      }
    }
    collectDrops(current, drops);
  }
  return { bodies: current, drops };
}
