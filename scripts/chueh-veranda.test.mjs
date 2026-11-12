import assert from "node:assert/strict";
import test from "node:test";

import { chuehVerandaProfile, SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

test("Chueh Hsuan has its own veranda and the literature hall keeps the shared hip", () => {
  const hall = SECONDARY_STRUCTURES.find((s) => s.id === "chuehhsuan");
  const literature = SECONDARY_STRUCTURES.find((s) => s.id === "humanities");
  const garden = SECONDARY_STRUCTURES.find((s) => s.id === "yingyuan");
  assert.ok(hall);
  assert.equal(hall.kind, "veranda-hall");
  assert.equal(hall.accuracy, "estimated");
  assert.equal(literature?.kind, "hip-roof-block");
  assert.equal(garden?.kind, "garden-house");
  const profile = chuehVerandaProfile(hall.size);
  const sharedRadius = Math.hypot(hall.size[0], hall.size[2]) * 0.42;
  assert.ok(profile.roofH > 2.6);
  assert.ok(profile.roofR < sharedRadius);
  assert.ok(profile.porchZ - profile.porchD / 2 >= hall.size[2] / 2 - 0.02);
  assert.ok(profile.porchW < hall.size[0]);
  assert.ok(profile.glassZ > hall.size[2] / 2);
});
