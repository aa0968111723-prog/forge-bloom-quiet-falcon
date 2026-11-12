import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { LANDMARKS, TIGER_STELE } from "../src/game/world-data/landmarks.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";
import { CURATED_PLANTS } from "../src/game/world-data/vegetation.ts";

test("the five-tigers stele blocks the body and leaves the stamp on open grass", () => {
  const stele = LANDMARKS.find((item) => item.id === "tigers");
  assert.ok(stele);
  assert.equal(stele.accuracy, "estimated");
  const stamp = resolveCollision(stele.interact.x, stele.interact.z, 0.42);
  assert.ok(Math.hypot(stamp.x - stele.interact.x, stamp.z - stele.interact.z) < 0.01);
  const blocked = resolveCollision(TIGER_STELE.x, TIGER_STELE.z, 0.42);
  assert.ok(Math.hypot(blocked.x - TIGER_STELE.x, blocked.z - TIGER_STELE.z) > 0.2);
  const contactZ = TIGER_STELE.z - TIGER_STELE.pad / 2 - 0.42;
  const dodged = resolveCollision(TIGER_STELE.x, contactZ + 1.04, 0.42);
  assert.ok(dodged.z < TIGER_STELE.z, `dodge crossed the stele to ${dodged.z}`);
  const gym = { x: 166, z: -122, w: 44, d: 30 };
  const south = TIGER_STELE.z + TIGER_STELE.pad / 2;
  assert.ok(south < gym.z - gym.d / 2, "the pad overlaps the gym");
  for (const plant of CURATED_PLANTS) {
    const inside =
      Math.abs(plant.x - TIGER_STELE.x) < TIGER_STELE.pad / 2 &&
      Math.abs(plant.z - TIGER_STELE.z) < TIGER_STELE.pad / 2;
    assert.ok(!inside, `${plant.species} at ${plant.x},${plant.z} stands on the pad`);
  }
  const routes = [MAIN_ROUTE, ...ROUTE_SPECS.map((route) => route.polyline)];
  for (const route of routes) {
    for (let i = 1; i < route.length; i++) {
      const [ax, az] = route[i - 1];
      const [bx, bz] = route[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        const hit =
          Math.abs(x - TIGER_STELE.x) < TIGER_STELE.pad / 2 + 0.42 &&
          Math.abs(z - TIGER_STELE.z) < TIGER_STELE.pad / 2 + 0.42;
        assert.ok(!hit, `route sample ${x},${z} meets the stele`);
      }
    }
  }
});
