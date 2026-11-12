import assert from "node:assert/strict";
import test from "node:test";

import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { sampleGroundElevation } from "../src/game/world-data/elevation.ts";
import { terrainHeight } from "../src/game/world.ts";
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
});
