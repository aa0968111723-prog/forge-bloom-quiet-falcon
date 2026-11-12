import assert from "node:assert/strict";
import test from "node:test";

import { stepCloudDrift, stepWaterTime } from "../src/game/world/scenery-motion.ts";

test("reduced motion holds the river clock and the cloud drift", () => {
  assert.equal(stepWaterTime(4, 0.05, true), 4);
  assert.equal(stepWaterTime(4, 0.05, false), 4.05);
  assert.equal(stepWaterTime(4, -1, false), 4);
  assert.equal(stepCloudDrift(10, 0.5, true), 10);
  assert.equal(stepCloudDrift(10, 0.5, false), 10.8);
  assert.equal(stepCloudDrift(1599, 1, false), (1599 + 1.6) % 1600);
});
