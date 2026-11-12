import assert from "node:assert/strict";
import test from "node:test";

import { litHallProfile, SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

test("the literature hall has a flat eave and Chueh Hsuan keeps the hip roof", () => {
  const hall = SECONDARY_STRUCTURES.find((s) => s.id === "humanities");
  const pavilion = SECONDARY_STRUCTURES.find((s) => s.id === "chuehhsuan");
  assert.ok(hall);
  assert.equal(hall.kind, "lit-hall");
  assert.equal(hall.accuracy, "estimated");
  assert.equal(pavilion?.kind, "hip-roof-block");
  const profile = litHallProfile(hall.size);
  assert.ok(profile.eaveH < 1);
  assert.ok(profile.glassZ > hall.size[2] / 2);
  assert.ok(profile.glassW > 6);
  assert.ok(profile.bayH < hall.size[1] * 0.3);
});
