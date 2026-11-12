import assert from "node:assert/strict";
import test from "node:test";

import { surfaceLuminance, wetSurface } from "../src/game/materials/wet.ts";

test("court grass darkens and smooths in the rain", () => {
  const dry = wetSurface("#5d8a52", 0, 0.5, 0.9);
  const wet = wetSurface("#5d8a52", 1, 0.5, 0.9);
  assert.equal(dry.color, "#5d8a52");
  assert.ok(surfaceLuminance(wet.color) < surfaceLuminance(dry.color));
  assert.ok(wet.roughness < dry.roughness);
  const asphaltDry = "#59666b";
  const asphalt = wetSurface(asphaltDry, 1, 1, 0.9);
  const trackDry = "#b77861";
  const track = wetSurface(trackDry, 1, 0.4, 0.95);
  assert.ok(surfaceLuminance(asphalt.color) < surfaceLuminance(asphaltDry));
  assert.ok(surfaceLuminance(track.color) < surfaceLuminance(trackDry));
  assert.ok(track.roughness < 0.95);
});
