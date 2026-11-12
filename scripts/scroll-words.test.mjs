import assert from "node:assert/strict";
import test from "node:test";

import { SCROLL_BLADES, scrollPlaque } from "../src/game/world-data/scroll-blades.ts";

test("each scroll blade carries one character of 樸實剛毅 inside its box", () => {
  assert.deepEqual(
    SCROLL_BLADES.map((blade) => blade.character),
    ["樸", "實", "剛", "毅"],
  );
  for (const blade of SCROLL_BLADES) {
    const plaque = scrollPlaque(blade);
    assert.ok(Math.abs(plaque.x - blade.dx) < 1.5, `${blade.character} leaves the blade box in x`);
    assert.ok(Math.abs(plaque.z - blade.dz) < 1.5, `${blade.character} leaves the blade box in z`);
    assert.ok(Math.hypot(plaque.x, plaque.z) < Math.hypot(blade.dx, blade.dz));
  }
});
