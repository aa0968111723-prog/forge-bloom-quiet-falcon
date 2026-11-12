import assert from "node:assert/strict";
import test from "node:test";

import { WIND, stepWind } from "../src/game/world/wind.ts";

test("reduced motion stills the wind and a normal day brings it back", () => {
  WIND.strength.value = 1;
  WIND.time.value = 3;
  for (let i = 0; i < 40; i++) stepWind(0.05, 1, true);
  assert.ok(WIND.strength.value < 0.02, `strength stayed ${WIND.strength.value}`);
  assert.equal(WIND.time.value, 3);
  for (let i = 0; i < 40; i++) stepWind(0.05, 1, false);
  assert.ok(WIND.strength.value > 0.8, `strength only reached ${WIND.strength.value}`);
  assert.ok(WIND.time.value > 3);
  WIND.strength.value = 1;
  WIND.time.value = 0;
});
