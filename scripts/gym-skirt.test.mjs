import assert from "node:assert/strict";
import test from "node:test";

import { siteEntrance, CAMPUS_SITES } from "../src/game/rpg/campus.ts";
import { foundationSpan, SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

test("the gym skirt fills the downhill gap and leaves the south door clear", () => {
  const gym = SECONDARY_STRUCTURES.find((s) => s.id === "gymnasium");
  const site = CAMPUS_SITES.find((s) => s.id === "gym");
  assert.ok(gym);
  assert.ok(site);
  const span = foundationSpan(gym);
  assert.ok(span.gap > 2, `gap ${span.gap}`);
  assert.ok(span.low < span.deck);
  const door = siteEntrance(site);
  const skirtSouth = gym.position[1] + gym.size[2] / 2 + 0.2;
  assert.ok(door.z > skirtSouth);
  const flat = SECONDARY_STRUCTURES.find((s) => s.id === "white-hall");
  assert.ok(foundationSpan(flat).gap < 1.5);
});
