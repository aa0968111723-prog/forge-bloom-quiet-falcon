import assert from "node:assert/strict";
import test from "node:test";

import { AXIS } from "../src/game/world-data/axis.ts";
import { LIBRARY } from "../src/game/world-data/landmarks.ts";
import { PROPS, railingPostOffsets, railingPoint } from "../src/game/world-data/props.ts";

test("the library ramp has a railing on each side", () => {
  const rampX = LIBRARY.center[0] - 20;
  const rampZ = AXIS.libraryFrontZ + 1.6;
  const ramp = PROPS.find((p) => p.kind === "ramp" && p.zone === "library");
  const rails = PROPS.filter((p) => p.kind === "railing" && p.zone === "library");
  assert.equal(ramp.length, 14);
  assert.equal(rails.length, 2);
  assert.deepEqual(
    rails.map((rail) => rail.x).sort((a, b) => a - b),
    [rampX - 0.95, rampX + 0.95],
  );
  for (const rail of rails) {
    assert.equal(rail.z, rampZ);
    assert.equal(rail.length, ramp.length);
    assert.ok(Math.abs(rail.x - rampX) > 0.8);
    const posts = railingPostOffsets(rail.length);
    assert.equal(posts[0], -rail.length / 2);
    assert.equal(posts[posts.length - 1], rail.length / 2);
    assert.ok(posts.length >= 8);
    const end = railingPoint(rail.x, rail.z, rail.rotationY, posts[0]);
    assert.equal(end.x, rail.x);
    assert.equal(end.z, rail.z - rail.length / 2);
  }
  assert.equal(PROPS.filter((p) => p.kind === "railing" && p.zone === "kenan").length, 0);
});
