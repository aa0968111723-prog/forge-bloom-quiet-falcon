import assert from "node:assert/strict";
import test from "node:test";

import { poolHallGlow } from "../src/game/world-data/zones/secondary.ts";

test("the pool hall glass is dark by day and cool when the lamps are on", () => {
  const day = poolHallGlow(false);
  const night = poolHallGlow(true);
  assert.equal(day.emissive, "#000000");
  assert.equal(day.emissiveIntensity, 0);
  assert.equal(night.emissive, "#9fd8e2");
  assert.ok(night.emissiveIntensity > 0.4);
  assert.notEqual(night.emissive, "#ffe6b4");
});
