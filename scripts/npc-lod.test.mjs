import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { npcDrawRange, npcUsesDetailedKit } from "../src/game/npc-lod.ts";

test("low quality keeps NPC walkers on the procedural stand-in", () => {
  assert.equal(npcDrawRange("high"), 140);
  assert.equal(npcDrawRange("low"), 90);
  assert.equal(npcUsesDetailedKit("high"), true);
  assert.equal(npcUsesDetailedKit("low"), false);
  const source = readFileSync(new URL("../src/game/Npcs.tsx", import.meta.url), "utf8");
  assert.match(source, /npcUsesDetailedKit\(tier\)/);
  assert.match(source, /npcDrawRange\(tier\)/);
  assert.match(source, /detailed \?/);
});
