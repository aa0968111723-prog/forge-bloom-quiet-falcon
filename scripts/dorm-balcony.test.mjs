import assert from "node:assert/strict";
import test from "node:test";

import { dormBalconies, SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

test("each Sungtao dorm has a south balcony on every upper floor", () => {
  const blocks = ["sungtao", "sungtao-3", "sungtao-4", "sungtao-5"];
  for (const id of blocks) {
    const hall = SECONDARY_STRUCTURES.find((s) => s.id === id);
    assert.equal(hall?.kind, "dorm-block");
    const rows = dormBalconies(hall.size, hall.floors ?? 6);
    assert.equal(rows.length, (hall.floors ?? 6) - 1);
    for (const row of rows) {
      assert.ok(row.z - row.depth / 2 > hall.size[2] / 2);
      assert.ok(row.y < hall.size[1]);
      assert.ok(row.width < hall.size[0]);
    }
  }
  const front = SECONDARY_STRUCTURES.find((s) => s.id === "sungtao-2");
  assert.equal(front?.kind, "dorm-front");
  const frontRows = dormBalconies(front.size, front.floors ?? 6);
  assert.equal(frontRows.length, (front.floors ?? 6) - 1);
  for (const row of frontRows) {
    assert.ok(row.z - row.depth / 2 > front.size[2] / 2);
    assert.ok(row.y < front.size[1]);
  }
  assert.notEqual(SECONDARY_STRUCTURES.find((s) => s.id === "faculty")?.kind, "dorm-block");
  assert.notEqual(SECONDARY_STRUCTURES.find((s) => s.id === "reitaku")?.kind, "dorm-block");
});
