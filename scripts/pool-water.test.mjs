import assert from "node:assert/strict";
import test from "node:test";

import { SWIMMING_POOL, interiorSpawn, poolBlockPositions, poolLaneOffsets } from "../src/game/rpg/interior-layout.ts";
import { stepInterior } from "../src/game/rpg/physics/interior.ts";
import { resolveInterior } from "../src/game/rpg/rules.ts";

const radius = 0.42;

function outsideWater(x, z) {
  return Math.abs(x) >= SWIMMING_POOL.halfX + radius - 1e-6 || Math.abs(z) >= SWIMMING_POOL.halfZ + radius - 1e-6;
}

test("the swimming hall keeps a body on the deck", () => {
  const lanes = poolLaneOffsets();
  const blocks = poolBlockPositions();
  assert.equal(lanes.length, SWIMMING_POOL.lanes - 1);
  assert.equal(blocks.length, SWIMMING_POOL.lanes);
  assert.ok(lanes.every((z) => Math.abs(z) < SWIMMING_POOL.halfZ));
  assert.ok(blocks.every((block) => block.x < -SWIMMING_POOL.halfX && Math.abs(block.z) < SWIMMING_POOL.halfZ));

  const onWater = (x, z) => resolveInterior(x, z, radius, false, false, false, false, true);
  const centre = onWater(0, 0);
  assert.ok(outsideWater(centre.x, centre.z));
  assert.ok(Math.abs(centre.x) <= 9 - radius && Math.abs(centre.z) <= 7 - radius);

  const deck = onWater(0, 5.2);
  assert.equal(deck.x, 0);
  assert.equal(deck.z, 5.2);
  const door = onWater(0, 6.4);
  assert.equal(door.x, 0);
  assert.equal(door.z, 6.4);

  const gym = resolveInterior(0, 0, radius, false, false);
  assert.equal(gym.x, 0);
  assert.equal(gym.z, 0);

  const beside = onWater(6.4, 0);
  assert.ok(beside.x > SWIMMING_POOL.halfX);
  assert.ok(beside.x <= 9 - radius);
  assert.equal(beside.z, 0);

  let walked = { x: 0, z: 5.6 };
  for (let i = 0; i < 40; i++) {
    walked = stepInterior(walked.x, walked.z, 0, -0.18, radius, false, false, false, false, true);
  }
  assert.equal(walked.x, 0);
  assert.ok(walked.z > 4.3 && walked.z < 4.7, `walked into the water ${walked.z}`);

  const gymWalk = stepInterior(0, 1, 0, -0.2, radius, false, true, false, false, false);
  assert.equal(gymWalk.x, 0);
  assert.ok(gymWalk.z < 1);

  const spawn = interiorSpawn("swimming");
  assert.ok(spawn.z >= SWIMMING_POOL.halfZ + radius + 0.5);
  const stood = onWater(spawn.x, spawn.z);
  assert.equal(stood.x, spawn.x);
  assert.equal(stood.z, spawn.z);
  assert.equal(interiorSpawn("gym").z, 4);
  assert.equal(interiorSpawn("palace").z, 4);
});
