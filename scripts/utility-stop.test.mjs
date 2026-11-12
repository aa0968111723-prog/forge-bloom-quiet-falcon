import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { utilityBoxFootprint, utilityBoxes } from "../src/game/world-data/landmarks.ts";
import { PROPS } from "../src/game/world-data/props.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("utility cabinets stop a body and the pilgrimage lines stay open", () => {
  const cabinets = utilityBoxes();
  const placed = PROPS.filter((prop) => prop.kind === "utility-box");
  assert.equal(cabinets.length, 7);
  assert.deepEqual(
    placed.map((prop) => [prop.x, prop.z, prop.zone]),
    cabinets.map((cabinet) => [cabinet.x, cabinet.z, cabinet.zone]),
  );
  const gate = cabinets.find((cabinet) => cabinet.zone === "kenan");
  assert.ok(gate);
  const blocked = resolveCollision(gate.x, gate.z, 0.42);
  assert.ok(Math.hypot(blocked.x - gate.x, blocked.z - gate.z) > 0.2);
  const beside = resolveCollision(gate.x, gate.z + 1.6, 0.42);
  assert.ok(Math.hypot(beside.x - gate.x, beside.z - (gate.z + 1.6)) < 0.05);
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
    for (const cabinet of cabinets) {
      const footprint = utilityBoxFootprint(cabinet);
      const dx = Math.max(0, Math.abs(lamp.x - footprint.x) - footprint.width / 2);
      const dz = Math.max(0, Math.abs(lamp.z - footprint.z) - footprint.depth / 2);
      assert.ok(Math.hypot(dx, dz) > 1.2, `street lamp ${lamp.x},${lamp.z} sits on a utility cabinet`);
    }
  }
});
