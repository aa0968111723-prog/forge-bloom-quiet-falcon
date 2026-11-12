import assert from "node:assert/strict";
import test from "node:test";

import { businessHallProfile, SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

test("the business tower has a glass podium and a set-back shaft", () => {
  const hall = SECONDARY_STRUCTURES.find((s) => s.id === "business-building");
  const office = SECONDARY_STRUCTURES.find((s) => s.id === "administration");
  assert.ok(hall);
  assert.equal(hall.kind, "business-hall");
  assert.equal(hall.accuracy, "estimated");
  assert.equal(office?.kind, "office-block");
  const profile = businessHallProfile(hall.size);
  assert.ok(profile.podiumH < hall.size[1] * 0.3);
  assert.ok(profile.shaftW < hall.size[0]);
  assert.ok(profile.shaftD < hall.size[2]);
  assert.ok(profile.shaftSouth < hall.size[2] / 2);
  assert.ok(profile.glassZ > hall.size[2] / 2);
  assert.ok(profile.glassW > hall.size[0] * 0.4);
});
