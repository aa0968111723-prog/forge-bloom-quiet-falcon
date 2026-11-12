import assert from "node:assert/strict";
import test from "node:test";

import { AXIS } from "../src/game/world-data/axis.ts";
import { GATE_CROSSWALK, gateCrosswalkBars } from "../src/game/world-data/crosswalk.ts";
import { KENAN } from "../src/game/world-data/kenan.ts";
import { bollards } from "../src/game/world-data/landmarks.ts";

test("the gate zebra stays on the apron between the piers", () => {
  const bars = gateCrosswalkBars();
  assert.equal(bars.length, GATE_CROSSWALK.bars);
  const pierInner = KENAN.bottomApronWidth / 2 - 0.05;
  const apronSouth = AXIS.gateZ;
  const apronNorth = KENAN.bottomZ;
  for (const bar of bars) {
    assert.ok(Math.abs(bar.x) + bar.w / 2 < pierInner);
    assert.ok(bar.z - bar.d / 2 > apronNorth);
    assert.ok(bar.z + bar.d / 2 < apronSouth);
  }
  const posts = bollards().filter((post) => post.zone === "kenan");
  for (const bar of bars) {
    for (const post of posts) {
      assert.ok(Math.hypot(bar.x - post.x, bar.z - post.z) > 0.8);
    }
  }
});
