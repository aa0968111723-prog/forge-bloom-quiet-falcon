import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVITY_COURT, activityCourtSegments, gymFloorMarks } from "../src/game/rpg/interior-layout.ts";

test("the activity room paints a court between the hoops", () => {
  const marks = activityCourtSegments();
  assert.equal(marks.length, 10);
  const { halfX, halfZ, rimX, poleX, laneDepth, laneHalfZ, line } = ACTIVITY_COURT;
  assert.ok(rimX < halfX && halfX < poleX);
  for (const mark of marks) {
    const [x, y, z] = mark.position;
    const [w, h, d] = mark.size;
    assert.ok(y < 0.1 && h < 0.05);
    assert.ok(Math.abs(x) + w / 2 <= halfX + line);
    assert.ok(Math.abs(z) + d / 2 <= halfZ + line);
    assert.ok(Math.abs(x) + w / 2 < 9);
    assert.ok(Math.abs(z) + d / 2 < 6.6);
  }
  const baselines = marks.filter((mark) => mark.size[0] === line && Math.abs(mark.position[0]) === halfX);
  assert.equal(baselines.length, 2);
  const freeThrows = marks.filter((mark) => mark.size[0] === line && Math.abs(mark.position[0]) === halfX - laneDepth);
  assert.equal(freeThrows.length, 2);
  assert.ok(freeThrows.every((mark) => mark.size[2] === laneHalfZ * 2));
  const sidelines = marks.filter((mark) => Math.abs(mark.position[2]) === halfZ);
  assert.equal(sidelines.length, 2);
  assert.ok(sidelines.every((mark) => mark.size[0] === halfX * 2));

  const floor = gymFloorMarks();
  assert.equal(floor.length, 11);
  const centre = floor.find((mark) => mark.position[0] === 0 && mark.position[2] === 0);
  assert.equal(centre.size[0], halfX * 2);
  assert.ok(floor.every((mark) => Math.abs(mark.position[0]) !== 8.5 && Math.abs(mark.position[2]) !== 5.5));
});
