import assert from "node:assert/strict";
import test from "node:test";

import { CURATED_PLANTS } from "../src/game/world-data/vegetation.ts";

test("the title camera is not inside a plaza canopy", () => {
  const close = CURATED_PLANTS.filter(
    (plant) => plant.species !== "azalea" && Math.hypot(plant.x + 13, plant.z - 13) < 14,
  );
  assert.deepEqual(close, []);
});
