import assert from "node:assert/strict";
import test from "node:test";

import { TITLE_ORBIT, titleCamera } from "../src/game/rpg/title-camera.ts";

test("reduced motion holds the title camera on the orbit centre", () => {
  const still = titleCamera(12.3, true);
  assert.deepEqual(still, { ...TITLE_ORBIT });
  const start = titleCamera(0, false);
  assert.equal(start.x, TITLE_ORBIT.x);
  assert.ok(Math.abs(start.z - (TITLE_ORBIT.z + 1.8)) < 1e-9);
  const later = titleCamera(10, false);
  assert.notEqual(later.x, still.x);
  assert.notEqual(later.z, start.z);
});
