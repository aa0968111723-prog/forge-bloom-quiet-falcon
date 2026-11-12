import assert from "node:assert/strict";
import test from "node:test";

import { sweepCircle } from "../src/game/rpg/physics/sweep.ts";
import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision, substepCollision } from "../src/game/world-data/colliders.ts";
import { textSignAabb, textSigns } from "../src/game/world-data/landmarks.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";
import { CURATED_PLANTS } from "../src/game/world-data/vegetation.ts";

test("named boards stop a body and the pilgrimage lines stay open", () => {
  const signs = textSigns();
  assert.equal(signs.length, 5);
  const gate = signs.find((sign) => sign.id === "kenan-bottom");
  assert.ok(gate);
  const face = textSignAabb(gate);
  const blocked = resolveCollision(gate.x, gate.z, 0.42);
  assert.ok(Math.hypot(blocked.x - gate.x, blocked.z - gate.z) > 0.2);
  const beside = resolveCollision(face.minX - 1.2, gate.z, 0.42);
  assert.ok(Math.abs(beside.x - (face.minX - 1.2)) < 0.05);
  for (const plant of CURATED_PLANTS) {
    for (const sign of signs) {
      const box = textSignAabb(sign);
      const inside = plant.x > box.minX && plant.x < box.maxX && plant.z > box.minZ && plant.z < box.maxZ;
      assert.equal(inside, false, `${plant.species} at ${plant.x},${plant.z} is inside ${sign.id}`);
    }
  }
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
  const radius = 0.42;
  const contact = face.minX - radius;
  const dodge = 0.08 * 13;
  const jumped = resolveCollision(contact + dodge, gate.z, radius);
  assert.ok(jumped.x > gate.x, `single step stayed at ${jumped.x}`);
  const held = substepCollision(contact, gate.z, dodge, 0, radius);
  assert.ok(held.x < face.minX, `substep crossed to ${held.x}`);
  const cast = sweepCircle({ x: contact - 0.4, z: gate.z, dx: dodge + 0.8, dz: 0, radius });
  assert.equal(cast.hit, true);
  assert.ok(cast.end.x < gate.x, `sweep crossed to ${cast.end.x}`);
});
