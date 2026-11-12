import assert from "node:assert/strict";
import test from "node:test";

import { sweepCircle } from "../src/game/rpg/physics/sweep.ts";
import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision, substepCollision } from "../src/game/world-data/colliders.ts";
import { CAMPUS_GATE } from "../src/game/world-data/landmarks.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("the campus gate piers stop a body and the opening stays open", () => {
  assert.equal(CAMPUS_GATE.pier, 1);
  const west = { x: -CAMPUS_GATE.halfSpan, z: CAMPUS_GATE.z };
  const blocked = resolveCollision(west.x, west.z, 0.42);
  assert.ok(Math.hypot(blocked.x - west.x, blocked.z - west.z) > 0.2);
  const opening = resolveCollision(0, CAMPUS_GATE.z, 0.42);
  assert.ok(Math.hypot(opening.x, opening.z - CAMPUS_GATE.z) < 0.05);
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
  const contact = west.x - CAMPUS_GATE.pier / 2 - radius;
  const dodge = 0.08 * 13;
  const jumped = resolveCollision(contact + dodge, west.z, radius);
  assert.ok(jumped.x > west.x, `single step stayed at ${jumped.x}`);
  const held = substepCollision(contact, west.z, dodge, 0, radius);
  assert.ok(held.x < west.x - CAMPUS_GATE.pier / 2, `substep crossed to ${held.x}`);
  const cast = sweepCircle({ x: contact - 0.5, z: west.z, dx: dodge + 1, dz: 0, radius });
  assert.equal(cast.hit, true);
  assert.ok(cast.end.x < west.x, `sweep crossed to ${cast.end.x}`);
});
