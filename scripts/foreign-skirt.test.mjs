import assert from "node:assert/strict";
import test from "node:test";

import { siteEntrance, CAMPUS_SITES } from "../src/game/rpg/campus.ts";
import { footprintCorner, foundationSpan, SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

test("the language hall skirt fills the downhill gap and leaves the south door clear", () => {
  const hall = SECONDARY_STRUCTURES.find((s) => s.id === "foreign");
  const site = CAMPUS_SITES.find((s) => s.id === "foreign");
  assert.ok(hall);
  assert.ok(site);
  const span = foundationSpan(hall);
  assert.ok(span.gap > 2, `gap ${span.gap}`);
  const hx = hall.size[0] / 2;
  const hz = hall.size[2] / 2;
  const sw = footprintCorner(hall, -hx, hz);
  assert.ok(Math.abs(sw.x - (hall.position[0] - hx)) < 1e-6);
  assert.ok(Math.abs(sw.z - (hall.position[1] + hz)) < 1e-6);
  const door = siteEntrance(site);
  const dx = door.x - hall.position[0];
  const dz = door.z - hall.position[1];
  const sin = Math.sin(hall.rotationY);
  const cos = Math.cos(hall.rotationY);
  const localZ = dx * sin + dz * cos;
  assert.ok(localZ > hz + 0.2);
  const flat = SECONDARY_STRUCTURES.find((s) => s.id === "white-hall");
  assert.ok(foundationSpan(flat).gap < 1.5);
});
