import assert from "node:assert/strict";
import test from "node:test";

import { CAMPUS_SITES } from "../src/game/rpg/campus.ts";
import { classHallProfile, SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

test("the education hall has its own classroom canopy", () => {
  const hall = SECONDARY_STRUCTURES.find((s) => s.id === "education");
  const seminar = SECONDARY_STRUCTURES.find((s) => s.id === "hweiwen");
  const language = SECONDARY_STRUCTURES.find((s) => s.id === "foreign");
  assert.ok(hall);
  assert.equal(hall.kind, "class-hall");
  assert.equal(seminar?.kind, "seminar-hall");
  assert.equal(language?.kind, "language-hall");
  const site = CAMPUS_SITES.find((s) => s.id === "education");
  assert.ok(site);
  const profile = classHallProfile(hall.size, hall.floors ?? 5);
  assert.equal(profile.shadeY.length, (hall.floors ?? 5) - 1);
  assert.ok(profile.porchH > 2.2);
  assert.ok(profile.porchW < hall.size[0] * 0.5);
  assert.ok(profile.porchZ > hall.size[2] / 2);
  const doorZ = (site.entrance?.[1] ?? site.z + site.d / 2 + 2.5) - site.z;
  assert.ok(doorZ > hall.size[2] / 2);
  assert.ok(Math.abs(profile.postX) > 1.5);
});
