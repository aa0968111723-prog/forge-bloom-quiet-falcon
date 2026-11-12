import assert from "node:assert/strict";
import test from "node:test";

import { createSpring, stepSpring, swayTargets } from "../src/game/art/character/sway.ts";

test("reduced motion rests the hair tail and the turtle charm", () => {
  const moving = swayTargets(6, 2, 4, -3, false);
  assert.ok(Math.abs(moving.hairX) > 0.05);
  assert.ok(Math.abs(moving.charmX) > 0.05);
  const held = swayTargets(6, 2, 4, -3, true);
  assert.deepEqual(held, { hairX: 0, hairZ: 0, charmX: 0, charmZ: 0 });

  const charm = createSpring();
  charm.x = 0.45;
  charm.z = -0.3;
  for (let i = 0; i < 80; i++) stepSpring(charm, held.charmX, held.charmZ, 55, 5, 0.05);
  assert.ok(Math.hypot(charm.x, charm.z) < 0.02, `charm still at ${charm.x},${charm.z}`);

  const hair = createSpring();
  for (let i = 0; i < 30; i++) stepSpring(hair, moving.hairX, moving.hairZ, 70, 9, 0.05);
  assert.ok(Math.abs(hair.x) > 0.05);
});
