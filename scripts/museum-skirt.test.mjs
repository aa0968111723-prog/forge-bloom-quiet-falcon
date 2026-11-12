import assert from "node:assert/strict";
import test from "node:test";

import { footprintCorner, foundationSpan, SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

test("the maritime museum skirt follows the rotated hull", () => {
  const museum = SECONDARY_STRUCTURES.find((s) => s.id === "maritime-museum");
  assert.ok(museum);
  assert.ok(Math.abs(museum.rotationY) > 0.1);
  const span = foundationSpan(museum);
  assert.ok(span.gap > 2, `gap ${span.gap}`);
  assert.ok(span.low < span.deck);
  const hx = museum.size[0] / 2;
  const hz = museum.size[2] / 2;
  const sw = footprintCorner(museum, -hx, hz);
  const axisSouth = museum.position[1] + hz + 0.2;
  assert.ok(sw.z > axisSouth, "an axis-aligned skirt misses the rotated south-west corner");
  const dx = sw.x - museum.position[0];
  const dz = sw.z - museum.position[1];
  const cos = Math.cos(museum.rotationY);
  const sin = Math.sin(museum.rotationY);
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  assert.ok(Math.abs(localX) <= hx + 0.2);
  assert.ok(Math.abs(localZ) <= hz + 0.2);
  const door = { x: 150, z: -230 };
  const ddx = door.x - museum.position[0];
  const ddz = door.z - museum.position[1];
  const doorLocalZ = ddx * sin + ddz * cos;
  assert.ok(doorLocalZ > hz + 0.2, "the south approach stays outside the rotated skirt");
  const flat = SECONDARY_STRUCTURES.find((s) => s.id === "white-hall");
  assert.ok(flat);
  assert.ok(foundationSpan(flat).gap < 1.5);
});
