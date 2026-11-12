import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { courtMarkings, lineInsideCourt, parkingStalls } from "../src/game/world-data/court-lines.ts";
import { SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

test("open courts keep their painted lines inside the grass", () => {
  for (const id of ["wuhu-courts", "volleyball-court"]) {
    const court = SECONDARY_STRUCTURES.find((s) => s.id === id);
    assert.equal(court.kind, "court");
    const lines = courtMarkings(id, court.size);
    assert.ok(lines.length >= 5);
    assert.ok(lines.some((line) => line.net));
    for (const line of lines) assert.equal(lineInsideCourt(line, court.size), true);
  }
  const wuhu = courtMarkings("wuhu-courts", [70, 0, 44]);
  assert.equal(wuhu.filter((line) => line.net).length, 2);
  assert.equal(courtMarkings("track", [100, 0, 130]).length, 0);
  assert.equal(courtMarkings("parking", [60, 0, 34]).length, 0);
  const lot = SECONDARY_STRUCTURES.find((s) => s.id === "parking");
  const stalls = parkingStalls("parking", lot.size);
  assert.ok(stalls.length > 10);
  assert.equal(parkingStalls("wuhu-courts", lot.size).length, 0);
  for (const line of stalls) assert.equal(lineInsideCourt(line, lot.size), true);
  const aisle = stalls.every((line) => {
    const near = line.axis === "z" ? Math.abs(line.z) - line.length / 2 : Math.abs(line.z);
    return near >= 10;
  });
  assert.equal(aisle, true);
  const renderer = readFileSync(
    new URL("../src/game/world/ContextStructures.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(renderer.includes("s.size[2] * 0.75"), false);
});
