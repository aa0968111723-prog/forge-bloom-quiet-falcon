import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { acUnitFootprint, acUnits } from "../src/game/world-data/landmarks.ts";
import { PROPS } from "../src/game/world-data/props.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("AC cabinets stop a body and the pilgrimage lines stay open", () => {
  const units = acUnits();
  const placed = PROPS.filter((prop) => prop.kind === "ac-unit");
  const key = (row) => `${row.x.toFixed(3)},${row.z.toFixed(3)}`;
  assert.equal(units.length, 20);
  assert.deepEqual(placed.map(key).sort(), units.map(key).sort());
  const west = units.find((unit) => unit.x < 0 && unit.z === -31.5);
  assert.ok(west);
  const blocked = resolveCollision(west.x - 1.2, west.z, 0.42);
  assert.ok(blocked.x < west.x - 0.3);
  const clear = resolveCollision(0, west.z, 0.42);
  assert.ok(Math.abs(clear.x) < 0.05);
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
    for (const unit of units) {
      const footprint = acUnitFootprint(unit);
      const dx = Math.max(0, Math.abs(lamp.x - footprint.x) - footprint.width / 2);
      const dz = Math.max(0, Math.abs(lamp.z - footprint.z) - footprint.depth / 2);
      assert.ok(Math.hypot(dx, dz) > 1.2, `street lamp ${lamp.x},${lamp.z} sits on an AC cabinet`);
    }
  }
});
