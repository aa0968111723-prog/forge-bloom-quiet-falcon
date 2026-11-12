import assert from "node:assert/strict";
import test from "node:test";

import { courtMarkings, lineInsideCourt, lineInsideTrackOval, trackInfield, trackInnerAxes, trackPit } from "../src/game/world-data/court-lines.ts";
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

test("the sand pit sits on the grass beside the pitch", () => {
  const track = SECONDARY_STRUCTURES.find((s) => s.id === "track");
  const pit = trackPit(track.size);
  assert.ok(pit);
  const inner = trackInnerAxes(track.size);
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const x = pit.x + sx * pit.w / 2;
    const z = pit.z + sz * pit.d / 2;
    assert.ok((x / inner.x) ** 2 + (z / inner.z) ** 2 < 1);
  }
  const pitch = trackInfield(track.size);
  const side = pitch.find((line) => line.axis === "z" && line.x > 0);
  const end = pitch.find((line) => line.axis === "x" && line.z > 0);
  assert.ok(pit.x - pit.w / 2 > side.x);
  assert.ok(Math.abs(pit.z) + pit.d / 2 < end.z + 20);
  assert.equal(trackPit([20, 0, 20]), null);
});
