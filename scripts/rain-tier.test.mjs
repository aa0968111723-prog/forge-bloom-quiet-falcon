import assert from "node:assert/strict";
import test from "node:test";

import { rainStreaks } from "../src/game/world/rain-count.ts";

test("wet weather keeps rain on the low tier and spends less of it", () => {
  const low = rainStreaks("low");
  const high = rainStreaks("high");
  assert.ok(low > 0);
  assert.ok(high > low);
  assert.ok(high <= 400);
});
