import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { DISCIPLINES } from "../src/game/rpg/data.ts";
import { SKILL_GLYPH } from "../src/game/rpg/skill-glyph.ts";

test("each college skill has its own glyph", () => {
  const names = Object.values(SKILL_GLYPH);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(Object.keys(SKILL_GLYPH).sort(), Object.keys(DISCIPLINES).sort());
  const hud = readFileSync(new URL("../src/game/rpg/AdventureHud.tsx", import.meta.url), "utf8");
  for (const name of names) assert.match(hud, new RegExp(name));
  assert.match(hud, /SkillGlyph/);
  const css = readFileSync(new URL("../src/game/rpg/adventure.css", import.meta.url), "utf8");
  assert.match(css, /\.ad-hurt\s*\{[^}]*box-shadow:\s*inset 0 0 72px 18px #b04c4799/);
});
