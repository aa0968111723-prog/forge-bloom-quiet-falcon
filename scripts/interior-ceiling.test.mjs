import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public interiors have a ceiling on the wall tops", () => {
  const src = readFileSync(new URL("../src/game/rpg/AdventureWorld.tsx", import.meta.url), "utf8");
  assert.match(src, /name="interior-ceiling"/);
  assert.match(src, /position=\{\[0, 4\.32, 0\]\}/);
  assert.match(src, /boxGeometry args=\{\[20, 0\.16, 16\]\}/);
  const wallTop = 2.2 + 4.4 / 2;
  const ceilingTop = 4.32 + 0.16 / 2;
  assert.ok(Math.abs(ceilingTop - wallTop) < 0.02);
});
