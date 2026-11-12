import assert from "node:assert/strict";
import test from "node:test";

import { BIN } from "../src/game/world-data/landmarks.ts";
import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { bins } from "../src/game/world-data/landmarks.ts";
import { PROPS } from "../src/game/world-data/props.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("bins stop a body and the pilgrimage lines stay open", () => {
  const cans = bins();
  const placed = PROPS.filter((prop) => prop.kind === "bin");
  const key = (row) => `${row.x.toFixed(3)},${row.z.toFixed(3)},${row.zone}`;
  assert.equal(cans.length, 18);
  assert.deepEqual(placed.map(key).sort(), cans.map(key).sort());
  const plaza = cans.find((can) => can.zone === "plaza");
  assert.ok(plaza);
  const blocked = resolveCollision(plaza.x, plaza.z, 0.42);
  assert.ok(Math.hypot(blocked.x - plaza.x, blocked.z - plaza.z) > 0.2);
  const beside = resolveCollision(plaza.x + 1.4, plaza.z, 0.42);
  assert.ok(Math.abs(beside.x - (plaza.x + 1.4)) < 0.05);
  assert.equal(BIN.diameter, 0.56);
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
    for (const can of cans) {
      const dx = Math.max(0, Math.abs(lamp.x - can.x) - BIN.diameter / 2);
      const dz = Math.max(0, Math.abs(lamp.z - can.z) - BIN.diameter / 2);
      assert.ok(Math.hypot(dx, dz) > 1.2, `street lamp ${lamp.x},${lamp.z} sits on a bin`);
    }
  }
});
