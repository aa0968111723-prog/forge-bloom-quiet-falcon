import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { LANDMARKS, SHEPHERD } from "../src/game/world-data/landmarks.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";
import { CURATED_PLANTS } from "../src/game/world-data/vegetation.ts";

test("the meadow figure blocks the body and leaves the stamp on the grass", () => {
  const sheep = LANDMARKS.find((item) => item.id === "sheep");
  assert.ok(sheep);
  assert.equal(sheep.accuracy, "estimated");
  const stamp = resolveCollision(sheep.interact.x, sheep.interact.z, 0.42);
  assert.ok(Math.hypot(stamp.x - sheep.interact.x, stamp.z - sheep.interact.z) < 0.01);
  const blocked = resolveCollision(SHEPHERD.x, SHEPHERD.z, 0.42);
  assert.ok(Math.hypot(blocked.x - SHEPHERD.x, blocked.z - SHEPHERD.z) > 0.2);
  const contactZ = SHEPHERD.z + SHEPHERD.pad / 2 + 0.42;
  const dodged = resolveCollision(SHEPHERD.x, contactZ - 1.04, 0.42);
  assert.ok(dodged.z > SHEPHERD.z, `dodge crossed the figure to ${dodged.z}`);
  for (const plant of CURATED_PLANTS) {
    const inside =
      Math.abs(plant.x - SHEPHERD.x) < SHEPHERD.pad / 2 && Math.abs(plant.z - SHEPHERD.z) < SHEPHERD.pad / 2;
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
          Math.abs(x - SHEPHERD.x) < SHEPHERD.pad / 2 + 0.42 && Math.abs(z - SHEPHERD.z) < SHEPHERD.pad / 2 + 0.42;
        assert.ok(!hit, `route sample ${x},${z} meets the figure`);
      }
    }
  }
});
