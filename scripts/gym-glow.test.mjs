import assert from "node:assert/strict";
import test from "node:test";

import { clerestoryGlow } from "../src/game/world-data/zones/secondary.ts";

test("the gym clerestory is dark by day and warm when the lamps are on", () => {
  const day = clerestoryGlow(false);
  const night = clerestoryGlow(true);
  assert.equal(day.emissive, "#000000");
  assert.equal(day.emissiveIntensity, 0);
  assert.equal(night.emissive, "#ffe6b4");
  assert.ok(night.emissiveIntensity > 0.4);
});
