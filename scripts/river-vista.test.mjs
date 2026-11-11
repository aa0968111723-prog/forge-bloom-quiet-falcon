import assert from "node:assert/strict";
import test from "node:test";

import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { SHORE_X, VISTA_RIDGES, vistaTown } from "../src/game/world-data/vista.ts";

test("the river vista stays west of the last walkable shore", () => {
  const town = vistaTown();
  assert.equal(town.length, 46);
  for (const block of town) {
    assert.ok(block.x + block.w / 2 < SHORE_X - 40, `${block.x} is not on the far bank`);
  }
  for (const ridge of VISTA_RIDGES) {
    assert.ok(ridge.x + ridge.r < SHORE_X, `ridge ${ridge.x} reaches the walkable shore`);
  }
  for (const z of [-298, -80, 40, -520]) {
    const stood = resolveCollision(-180, z, 0.6);
    assert.ok(stood.x >= SHORE_X, `walked onto the vista at z ${z}: ${stood.x}`);
  }
  const meadow = resolveCollision(-70, -298, 0.6);
  assert.ok(meadow.x < -60, "the meadow west of the library stays walkable");
});

test("a saved position in the vista corner returns to the walkable shore", () => {
  for (const z of [-640, 100]) {
    const stood = resolveCollision(-180, z, 0.42);
    assert.ok(stood.x >= SHORE_X + 0.42 - 1e-6, `corner z ${z} stayed in the water at x ${stood.x}`);
    const again = resolveCollision(stood.x, stood.z, 0.42);
    assert.ok(Math.abs(again.x - stood.x) < 1e-6, `corner z ${z} was pushed back west`);
    assert.equal(again.z, stood.z);
  }
});
