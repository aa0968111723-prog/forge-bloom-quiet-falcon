import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";
import { CURATED_PLANTS, TRUNK_BASE, trunkDiameter } from "../src/game/world-data/vegetation.ts";

test("specimen trunks stop a body and the pilgrimage lines stay open", () => {
  const trunks = CURATED_PLANTS.filter((row) => trunkDiameter(row) !== null);
  assert.equal(trunks.length, 134);
  assert.equal(TRUNK_BASE.banyan, 0.52);
  const gate = trunks.find((row) => row.species === "banyan" && row.x < 0 && Math.abs(row.z - 82) < 0.01);
  assert.ok(gate);
  const diameter = trunkDiameter(gate);
  assert.ok(diameter);
  assert.ok(Math.abs(diameter - 0.52 * 2 * gate.scale) < 1e-9);
  const blocked = resolveCollision(gate.x, gate.z, 0.42);
  assert.ok(Math.hypot(blocked.x - gate.x, blocked.z - gate.z) > 0.2);
  const beside = resolveCollision(gate.x - 1.6, gate.z, 0.42);
  assert.ok(Math.abs(beside.x - (gate.x - 1.6)) < 0.05);
  const shrub = CURATED_PLANTS.find((row) => row.species === "shrub");
  assert.ok(shrub);
  assert.equal(trunkDiameter(shrub), null);
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
});
