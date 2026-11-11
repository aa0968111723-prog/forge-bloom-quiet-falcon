import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { lessonMapLabel } from "../src/game/rpg/lesson-label.ts";

test("the campus map uses a two-character lesson label", () => {
  assert.equal(lessonMapLabel("department"), "選系");
  assert.equal(lessonMapLabel("move"), "移動");
  assert.equal(lessonMapLabel("supply"), "補給");
  assert.equal(lessonMapLabel("attack"), "普攻");
  assert.equal(lessonMapLabel("skill"), "技能");
  assert.equal(lessonMapLabel("done"), null);
  assert.equal(lessonMapLabel(null), null);
  for (const step of ["department", "move", "supply", "attack", "skill"]) {
    assert.equal([...lessonMapLabel(step)].length, 2);
  }
  const hud = readFileSync(new URL("../src/game/rpg/AdventureHud.tsx", import.meta.url), "utf8");
  assert.match(hud, /!compact && \(\s*<text[\s\S]{0,280}lessonMapLabel\(lesson\)/);
});
