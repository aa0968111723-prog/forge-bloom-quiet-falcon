import assert from "node:assert/strict";
import test from "node:test";

import { wetSurface } from "../src/game/materials/wet.ts";

test("court grass darkens and smooths in the rain", () => {
  const dry = wetSurface("#5d8a52", 0, 0.5, 0.9);
  const wet = wetSurface("#5d8a52", 1, 0.5, 0.9);
  assert.equal(dry.color, "#5d8a52");
  assert.notEqual(wet.color, dry.color);
  assert.ok(wet.roughness < dry.roughness);
  const asphalt = wetSurface("#59666b", 1, 1, 0.9);
  const track = wetSurface("#b77861", 1, 0.4, 0.95);
  assert.notEqual(asphalt.color, "#59666b");
  assert.ok(track.roughness < 0.95);
});
