import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { rainStreaks } from "../src/game/world/rain-count.ts";

test("wet weather keeps rain on the low tier and spends less of it", () => {
  const low = rainStreaks("low");
  const high = rainStreaks("high");
  assert.ok(low > 0);
  assert.ok(high > low);
  assert.ok(high <= 400);
});

test("rain follows reduced-motion changes instead of reading the setting once", () => {
  const source = readFileSync(new URL("../src/game/world/Rain.tsx", import.meta.url), "utf8");
  assert.match(source, /useReducedArtMotion\(\)/);
  assert.doesNotMatch(source, /matchMedia/);
});
