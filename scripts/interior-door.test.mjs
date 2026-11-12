import assert from "node:assert/strict";
import test from "node:test";

import { INTERIOR_DOOR_HALF, integrateInterior, stepInterior } from "../src/game/rpg/physics/interior.ts";

test("the interior doorway matches the wall opening", () => {
  assert.equal(INTERIOR_DOOR_HALF, 2.5);
  const radius = 0.42;
  const left = stepInterior(0, 6.4, 0, 1.2, radius);
  assert.equal(left.exited, true);
  assert.ok(left.z > 7 - radius);
  const jamb = integrateInterior(2.8, 6.2, 0, 2, 30, radius);
  assert.equal(jamb.exited, false);
  assert.ok(jamb.z <= 7 - radius + 1e-6);
  const openGym = stepInterior(6, 0.6, 0, 0.8, radius, false);
  assert.equal(openGym.exited, false);
  assert.ok(Math.abs(openGym.x - 6) < 0.05);
  assert.ok(openGym.z > 1.2);
});
