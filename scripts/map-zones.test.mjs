import assert from "node:assert/strict";
import test from "node:test";

import { CAMPUS_SITES } from "../src/game/rpg/campus.ts";
import { ZONE_MARK, ZONE_MARK_ORDER, zoneMark, zoneNear } from "../src/game/rpg/map-zones.ts";

test("seven district marks are unique and sites resolve to one", () => {
  assert.equal(ZONE_MARK_ORDER.length, 7);
  const colors = ZONE_MARK_ORDER.map((id) => ZONE_MARK[id].color);
  const labels = ZONE_MARK_ORDER.map((id) => ZONE_MARK[id].label);
  assert.equal(new Set(colors).size, 7);
  assert.equal(new Set(labels).size, 7);
  const palace = zoneMark("palace");
  assert.equal(palace?.label, "軸線");
  assert.equal(zoneNear(-8, -76), "axis-54");
  assert.equal(zoneNear(18, -321), "library-55");
  let marked = 0;
  for (const site of CAMPUS_SITES) {
    if (zoneMark(site.id)) marked += 1;
  }
  assert.ok(marked >= 40);
});
