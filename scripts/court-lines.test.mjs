import assert from "node:assert/strict";
import test from "node:test";

import { courtMarkings, lineInsideCourt, lineInsideTrackOval, lineOnTrackBand, trackFinish, trackInnerAxes, trackInfield, trackOuterAxes } from "../src/game/world-data/court-lines.ts";
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
});

test("the track infield is a pitch inside the oval", () => {
  const track = SECONDARY_STRUCTURES.find((s) => s.id === "track");
  const lines = trackInfield(track.size);
  assert.equal(lines.length, 5);
  assert.equal(lines.some((line) => line.net), false);
  for (const line of lines) assert.equal(lineInsideTrackOval(line, track.size), true);
  assert.equal(trackInfield([20, 0, 20]).length, 0);
});

test("the track finish stripe crosses the south straight", () => {
  const track = SECONDARY_STRUCTURES.find((s) => s.id === "track");
  const lines = trackFinish(track.size);
  assert.equal(lines.length, 1);
  const line = lines[0];
  assert.equal(line.net, undefined);
  assert.equal(line.axis, "z");
  assert.equal(line.x, 0);
  const inner = trackInnerAxes(track.size);
  const outer = trackOuterAxes(track.size);
  assert.ok(Math.abs(line.length - (outer.z - inner.z)) < 1e-6);
  assert.equal(lineOnTrackBand(line, track.size), true);
  assert.equal(lineInsideTrackOval(line, track.size), false);
  assert.equal(trackFinish([8, 0, 8]).length, 0);
});
