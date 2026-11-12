import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  followEyeHeight,
  followPitchUnderCeiling,
  interiorCameraCap,
  INTERIOR_CEILING_THICKNESS,
  INTERIOR_CEILING_Y,
} from "../src/game/rpg/interior-ceiling.ts";

test("public interiors have a ceiling on the wall tops", () => {
  const src = readFileSync(new URL("../src/game/rpg/AdventureWorld.tsx", import.meta.url), "utf8");
  assert.match(src, /name="interior-ceiling"/);
  assert.match(src, /INTERIOR_CEILING_Y/);
  assert.match(src, /INTERIOR_CEILING_THICKNESS/);
  const wallTop = 2.2 + 4.4 / 2;
  const ceilingTop = INTERIOR_CEILING_Y + INTERIOR_CEILING_THICKNESS / 2;
  const underside = INTERIOR_CEILING_Y - INTERIOR_CEILING_THICKNESS / 2;
  assert.ok(Math.abs(ceilingTop - wallTop) < 0.02);
  assert.ok(interiorCameraCap(0) < underside);
});

test("a downward indoor look stays under the ceiling", () => {
  const underside = INTERIOR_CEILING_Y - INTERIOR_CEILING_THICKNESS / 2;
  const cap = followPitchUnderCeiling(0);
  assert.ok(cap < 0.6);
  const player = readFileSync(new URL("../src/game/rpg/AdventurePlayer.tsx", import.meta.url), "utf8");
  assert.match(player, /followPitchUnderCeiling/);
  assert.match(player, /interiorCameraCap/);
  for (const pitch of [0.6, 1.12]) {
    const open = followEyeHeight(0, pitch);
    const held = followEyeHeight(0, Math.min(pitch, cap));
    assert.ok(open > underside, `pitch ${pitch} would clear the slab without the cap`);
    assert.ok(held <= interiorCameraCap(0) + 1e-6);
    assert.ok(held < underside);
  }
});
