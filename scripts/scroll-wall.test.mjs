import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_ROUTE, SCROLL_WEST_WALL } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { PROPS } from "../src/game/world-data/props.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("the scroll plaza west wall stops a body and the plaza centre stays open", () => {
  const { x, z, width, depth } = SCROLL_WEST_WALL;
  const blocked = resolveCollision(x, z, 0.42);
  assert.ok(Math.abs(blocked.x - x) > 0.2);
  const plaza = resolveCollision(0, z, 0.42);
  assert.ok(Math.hypot(plaza.x, plaza.z - z) < 0.05);
  const inside = resolveCollision(x + 2, z, 0.42);
  assert.ok(Math.abs(inside.x - (x + 2)) < 0.05);
  const pastEnd = resolveCollision(x, z + depth / 2 + 1.2, 0.42);
  assert.ok(Math.abs(pastEnd.z - (z + depth / 2 + 1.2)) < 0.05);
  for (const [rx, rz] of MAIN_ROUTE) {
    const held = resolveCollision(rx, rz, 0.42);
    assert.ok(Math.hypot(held.x - rx, held.z - rz) < 0.05, `route point ${rx},${rz} moved`);
  }
  for (const route of ROUTE_SPECS) {
    for (const [rx, rz] of route.polyline) {
      const held = resolveCollision(rx, rz, 0.42);
      assert.ok(Math.hypot(held.x - rx, held.z - rz) < 0.05, `${route.id} ${rx},${rz} moved`);
    }
  }
  for (const prop of PROPS) {
    const dx = Math.max(0, Math.abs(prop.x - x) - width / 2);
    const dz = Math.max(0, Math.abs(prop.z - z) - depth / 2);
    const clear = prop.kind === "street-lamp" ? 1.2 : 0.05;
    assert.ok(Math.hypot(dx, dz) > clear, `${prop.kind} at ${prop.x},${prop.z} sits on the wall`);
  }
});
