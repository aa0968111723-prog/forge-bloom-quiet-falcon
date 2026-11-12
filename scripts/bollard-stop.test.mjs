import assert from "node:assert/strict";
import test from "node:test";

import { DOLPHIN_BOLLARD_EXIT, DOLPHIN_BOLLARD_NORTH, MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { BOLLARD, bollards } from "../src/game/world-data/landmarks.ts";
import { PROPS } from "../src/game/world-data/props.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("bollards stop a body and the pilgrimage lines stay open", () => {
  const posts = bollards();
  const placed = PROPS.filter((prop) => prop.kind === "bollard");
  const key = (row) => `${row.x.toFixed(3)},${row.z.toFixed(3)},${row.zone}`;
  assert.equal(posts.length, 12);
  assert.deepEqual(placed.map(key).sort(), posts.map(key).sort());
  const gate = posts.find((post) => post.zone === "kenan" && post.x < 0);
  assert.ok(gate);
  const blocked = resolveCollision(gate.x, gate.z, 0.42);
  assert.ok(Math.hypot(blocked.x - gate.x, blocked.z - gate.z) > 0.2);
  const beside = resolveCollision(gate.x, gate.z + 1.2, 0.42);
  assert.ok(Math.abs(beside.z - (gate.z + 1.2)) < 0.05);
  assert.equal(BOLLARD.diameter, 0.22);
  for (const [x, z] of [DOLPHIN_BOLLARD_EXIT, DOLPHIN_BOLLARD_NORTH]) {
    const held = resolveCollision(x, z, 0.42);
    assert.ok(Math.hypot(held.x - x, held.z - z) < 0.05, `exit ${x},${z} moved`);
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
  for (const lamp of PROPS.filter((prop) => prop.kind === "street-lamp")) {
    for (const post of posts) {
      const dx = Math.max(0, Math.abs(lamp.x - post.x) - BOLLARD.diameter / 2);
      const dz = Math.max(0, Math.abs(lamp.z - post.z) - BOLLARD.diameter / 2);
      assert.ok(Math.hypot(dx, dz) > 1.2, `street lamp ${lamp.x},${lamp.z} sits on a bollard`);
    }
  }
});
