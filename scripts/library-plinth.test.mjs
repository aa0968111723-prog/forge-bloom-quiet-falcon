import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { LIBRARY, LIBRARY_BASE_MARGIN } from "../src/game/world-data/landmarks.ts";
import { LIBRARY_RAMP } from "../src/game/world-data/library-ramp.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("the library plinth skirt stops a body and the ramp gap stays open", () => {
  assert.equal(LIBRARY_BASE_MARGIN, 2.5);
  const south = LIBRARY.center[1] + LIBRARY.length / 2 + LIBRARY_BASE_MARGIN / 2;
  const blocked = resolveCollision(10, south, 0.42);
  assert.ok(Math.abs(blocked.z - south) > 0.2, `skirt did not push ${blocked.z}`);
  const face = LIBRARY.center[1] + LIBRARY.length / 2 + LIBRARY_BASE_MARGIN;
  const held = resolveCollision(10, face + 1.2, 0.42);
  assert.ok(Math.abs(held.z - (face + 1.2)) < 0.05);
  for (const x of [LIBRARY_RAMP.x, LIBRARY_RAMP.x - 0.5, LIBRARY_RAMP.x + 0.5]) {
    for (const z of [LIBRARY_RAMP.z, LIBRARY_RAMP.z - LIBRARY_RAMP.length / 2 + 0.3]) {
      const step = resolveCollision(x, z, 0.42);
      assert.ok(Math.hypot(step.x - x, step.z - z) < 0.05, `ramp ${x},${z} moved to ${step.x},${step.z}`);
    }
  }
  for (const [x, z] of MAIN_ROUTE) {
    const step = resolveCollision(x, z, 0.42);
    assert.ok(Math.hypot(step.x - x, step.z - z) < 0.05, `route point ${x},${z} moved`);
  }
  for (const route of ROUTE_SPECS) {
    for (const [x, z] of route.polyline) {
      const step = resolveCollision(x, z, 0.42);
      assert.ok(Math.hypot(step.x - x, step.z - z) < 0.05, `${route.id} ${x},${z} moved`);
    }
  }
});
