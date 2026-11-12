import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { benchFootprint, benches } from "../src/game/world-data/landmarks.ts";
import { PROPS } from "../src/game/world-data/props.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("benches stop a body and the pilgrimage lines stay open", () => {
  const seats = benches();
  const placed = PROPS.filter((prop) => prop.kind === "bench");
  const key = (row) => `${row.x.toFixed(3)},${row.z.toFixed(3)},${row.zone}`;
  assert.equal(seats.length, 47);
  assert.deepEqual(placed.map(key).sort(), seats.map(key).sort());
  const south = seats.find((seat) => seat.zone === "plaza" && Math.abs(seat.x) < 0.1);
  assert.ok(south);
  const blocked = resolveCollision(south.x, south.z, 0.42);
  assert.ok(Math.abs(blocked.z - south.z) > 0.2);
  const centre = resolveCollision(0, -14, 0.42);
  assert.ok(Math.hypot(centre.x, centre.z + 14) < 0.05);
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
    for (const seat of seats) {
      const footprint = benchFootprint(seat);
      const dx = Math.max(0, Math.abs(lamp.x - footprint.x) - footprint.width / 2);
      const dz = Math.max(0, Math.abs(lamp.z - footprint.z) - footprint.depth / 2);
      assert.ok(Math.hypot(dx, dz) > 1.2, `street lamp ${lamp.x},${lamp.z} sits on a bench`);
    }
  }
});
