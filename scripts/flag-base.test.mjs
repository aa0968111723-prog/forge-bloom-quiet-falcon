import assert from "node:assert/strict";
import test from "node:test";

import { PLAZA_FLAGPOLE, MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { PROPS } from "../src/game/world-data/props.ts";

test("the plaza flagpole base stops a body and the statue approach stays open", () => {
  const { x, z, base } = PLAZA_FLAGPOLE;
  const blocked = resolveCollision(x, z, 0.42);
  assert.ok(Math.hypot(blocked.x - x, blocked.z - z) > 0.2);
  const beside = resolveCollision(x + 2.2, z, 0.42);
  assert.ok(Math.hypot(beside.x - (x + 2.2), beside.z - z) < 0.05);
  const statue = resolveCollision(0, -2.4, 0.42);
  assert.ok(Math.hypot(statue.x, statue.z + 2.4) < 0.05);
  for (const [rx, rz] of MAIN_ROUTE) {
    const held = resolveCollision(rx, rz, 0.42);
    assert.ok(Math.hypot(held.x - rx, held.z - rz) < 0.05, `route point ${rx},${rz} moved`);
  }
  for (const prop of PROPS) {
    const dx = Math.max(0, Math.abs(prop.x - x) - base / 2);
    const dz = Math.max(0, Math.abs(prop.z - z) - base / 2);
    const clear = prop.kind === "street-lamp" ? 1.2 : 0.05;
    assert.ok(Math.hypot(dx, dz) > clear, `${prop.kind} at ${prop.x},${prop.z} sits on the flagpole`);
  }
});
