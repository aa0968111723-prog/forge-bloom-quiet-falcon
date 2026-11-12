import assert from "node:assert/strict";
import test from "node:test";

import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { sampleGroundElevation } from "../src/game/world-data/elevation.ts";
import { terrainHeight } from "../src/game/world.ts";
import { standRampGeometry, standRampHeight } from "../src/game/world-data/stand-ramp.ts";
import {
  SECONDARY_STRUCTURES,
  STAND_DECK_H,
  standDeckLift,
} from "../src/game/world-data/zones/secondary.ts";

test("the reviewing deck can be stood on and the booth still blocks", () => {
  const stand = SECONDARY_STRUCTURES.find((item) => item.id === "reviewing");
  assert.equal(stand?.kind, "stand");
  assert.equal(stand?.accuracy, "estimated");
  const deck = { x: stand.position[0], z: stand.position[1] + 2 };
  const stood = resolveCollision(deck.x, deck.z, 0.42);
  assert.ok(Math.hypot(stood.x - deck.x, stood.z - deck.z) < 0.05, "the south deck pushes the body off");
  const booth = resolveCollision(stand.position[0], stand.position[1] - stand.size[2] * 0.28, 0.42);
  assert.ok(Math.hypot(booth.x - stand.position[0], booth.z - (stand.position[1] - stand.size[2] * 0.28)) > 0.3);
  assert.ok(Math.abs(standDeckLift(deck.x, deck.z) - STAND_DECK_H) < 1e-6);
  const south = stand.position[1] + stand.size[2] / 2;
  assert.ok(Math.abs(standDeckLift(stand.position[0], south + 1.6) - STAND_DECK_H / 2) < 1e-6);
  assert.equal(standDeckLift(stand.position[0], south + 8), 0);
  const rise = terrainHeight(deck.x, deck.z) - sampleGroundElevation(deck.x, deck.z);
  assert.ok(Math.abs(rise - STAND_DECK_H) < 1e-6);
  const apron = { x: stand.position[0], z: south + 1.6 };
  assert.ok(Math.abs(standRampHeight(0, stand.size[2] / 2 + 1.6, stand.size[0], stand.size[2]) - standDeckLift(apron.x, apron.z)) < 1e-6);
  const ramp = standRampGeometry(stand.size[0], stand.size[2]);
  const position = ramp.getAttribute("position");
  let closest = Infinity;
  for (let i = 0; i < position.count; i++) {
    const dz = Math.abs(position.getZ(i) - (stand.size[2] / 2 + 1.6));
    const dx = Math.abs(position.getX(i));
    if (dx < 0.5 && dz < 0.5) closest = Math.min(closest, Math.abs(position.getY(i) - STAND_DECK_H / 2));
  }
  assert.ok(closest < 0.2, `ramp mesh does not meet the player height (${closest})`);
  ramp.dispose();
});
