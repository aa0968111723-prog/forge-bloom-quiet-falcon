import assert from "node:assert/strict";
import test from "node:test";

import { sweepCircle } from "../src/game/rpg/physics/sweep.ts";
import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision, substepCollision } from "../src/game/world-data/colliders.ts";
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

test("an 80 ms dodge and a sweep both stop on the near side of a trunk", () => {
  const palm = CURATED_PLANTS.find(
    (row) => row.species === "palm" && Math.abs(row.x + 8.5) < 0.01 && Math.abs(row.z + 210) < 0.01,
  );
  assert.ok(palm);
  const diameter = trunkDiameter(palm);
  assert.ok(diameter);
  const radius = 0.42;
  const west = palm.x - diameter / 2 - radius;
  const dodge = 0.08 * 13;
  const jumped = resolveCollision(west + dodge, palm.z, radius);
  assert.ok(jumped.x > palm.x, `single step stayed at ${jumped.x}`);
  const held = substepCollision(west, palm.z, dodge, 0, radius);
  assert.ok(held.x < palm.x - diameter / 2, `substep crossed to ${held.x}`);
  const cast = sweepCircle({ x: west - 0.4, z: palm.z, dx: dodge + 0.8, dz: 0, radius });
  assert.equal(cast.hit, true);
  assert.ok(cast.end.x < palm.x, `sweep crossed to ${cast.end.x}`);
});
