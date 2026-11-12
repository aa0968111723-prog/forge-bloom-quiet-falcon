import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { POT, pottedPlants } from "../src/game/world-data/landmarks.ts";
import { PROPS } from "../src/game/world-data/props.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("potted plants stop a body and the pilgrimage lines stay open", () => {
  const pots = pottedPlants();
  const placed = PROPS.filter((prop) => prop.kind === "potted-plant");
  const key = (row) => `${row.x.toFixed(3)},${row.z.toFixed(3)},${row.zone}`;
  assert.equal(pots.length, 22);
  assert.deepEqual(placed.map(key).sort(), pots.map(key).sort());
  const west = pots.find((pot) => pot.x < 0 && pot.z === -33.8);
  assert.ok(west);
  const blocked = resolveCollision(west.x + 1.2, west.z, 0.42);
  assert.ok(blocked.x > west.x + 0.3);
  const centre = resolveCollision(0, west.z, 0.42);
  assert.ok(Math.abs(centre.x) < 0.05);
  assert.equal(POT.diameter, 0.64);
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
    for (const pot of pots) {
      const dx = Math.max(0, Math.abs(lamp.x - pot.x) - POT.diameter / 2);
      const dz = Math.max(0, Math.abs(lamp.z - pot.z) - POT.diameter / 2);
      assert.ok(Math.hypot(dx, dz) > 1.2, `street lamp ${lamp.x},${lamp.z} sits on a pot`);
    }
  }
});
