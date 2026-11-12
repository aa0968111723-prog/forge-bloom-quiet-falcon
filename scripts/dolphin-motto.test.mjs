import assert from "node:assert/strict";
import test from "node:test";

import { DOLPHIN_MOTTO, dolphinMottoText } from "../src/game/world-data/dolphin-motto.ts";

test("the dolphin plinth carries all four phrases on two lines", () => {
  assert.deepEqual(DOLPHIN_MOTTO, ["立足淡江，放眼世界", "掌握資訊，開創未來"]);
  const text = dolphinMottoText();
  assert.equal(text.split("\n").length, 2);
  assert.ok(text.includes("掌握資訊"));
  assert.ok(text.includes("開創未來"));
  assert.ok(!text.startsWith("立足淡江 放眼世界") || text.includes("\n"));
});
