import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { planterFootprint, planters } from "../src/game/world-data/landmarks.ts";
import { PROPS } from "../src/game/world-data/props.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("planters stop a body and the pilgrimage lines stay open", () => {
  const beds = planters();
  const placed = PROPS.filter((prop) => prop.kind === "planter");
  assert.equal(beds.length, 18);
  assert.deepEqual(
    placed.map((prop) => [prop.x, prop.z, prop.length, prop.zone]),
    beds.map((bed) => [bed.x, bed.z, bed.length, bed.zone]),
  );
  const west = beds.find((bed) => bed.zone === "avenue" && bed.x < 0 && bed.z === -73);
  assert.ok(west);
  const blocked = resolveCollision(west.x, west.z, 0.42);
  assert.ok(Math.abs(blocked.x - west.x) > 0.2);
  const gap = resolveCollision(11.7, beds.find((bed) => bed.zone === "library").z, 0.42);
  assert.ok(Math.abs(gap.x - 11.7) < 0.05);
  for (const [x, z] of MAIN_ROUTE) {
    const held = resolveCollision(x, z, 0.42);
    assert.ok(Math.hypot(held.x - x, held.z - z) < 0.05, `route point ${x},${z} moved`);
  }
  for (const route of ROUTE_SPECS) {
    for (const [x, z] of route.polyline) {
      const held = resolveCollision(x, z, 0.42);
      assert.ok(Math.hypot(held.x - x, held.z - z) < 0.05, `${route.id} ${x},${z} moved`);
    }
  }
  for (const lamp of PROPS.filter((prop) => prop.kind === "street-lamp")) {
    for (const bed of beds) {
      const footprint = planterFootprint(bed);
      const dx = Math.max(0, Math.abs(lamp.x - footprint.x) - footprint.width / 2);
      const dz = Math.max(0, Math.abs(lamp.z - footprint.z) - footprint.depth / 2);
      assert.ok(Math.hypot(dx, dz) > 1.2, `street lamp ${lamp.x},${lamp.z} sits on a planter`);
    }
  }
});
