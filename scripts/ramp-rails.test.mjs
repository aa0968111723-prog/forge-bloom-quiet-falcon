import assert from "node:assert/strict";
import test from "node:test";

import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { LIBRARY_RAMP } from "../src/game/world-data/library-ramp.ts";
import { PROPS, railingPostOffsets, railingPoint } from "../src/game/world-data/props.ts";

test("the library ramp has a railing on each side", () => {
  const ramp = PROPS.find((p) => p.kind === "ramp" && p.zone === "library");
  const rails = PROPS.filter((p) => p.kind === "railing" && p.zone === "library");
  assert.ok(ramp);
  assert.equal(ramp.x, LIBRARY_RAMP.x);
  assert.equal(ramp.z, LIBRARY_RAMP.z);
  assert.equal(ramp.length, LIBRARY_RAMP.length);
  assert.equal(rails.length, 2);
  assert.deepEqual(
    rails.map((rail) => rail.x).sort((a, b) => a - b),
    [LIBRARY_RAMP.x - 0.95, LIBRARY_RAMP.x + 0.95],
  );
  for (const rail of rails) {
    assert.equal(rail.z, LIBRARY_RAMP.z);
    assert.equal(rail.length, ramp.length);
    assert.ok(Math.abs(rail.x - LIBRARY_RAMP.x) > LIBRARY_RAMP.width / 2);
    const posts = railingPostOffsets(rail.length);
    assert.equal(posts[0], -rail.length / 2);
    assert.equal(posts[posts.length - 1], rail.length / 2);
    assert.ok(posts.length >= 8);
    const end = railingPoint(rail.x, rail.z, rail.rotationY, posts[0]);
    assert.equal(end.x, rail.x);
    assert.equal(end.z, rail.z - rail.length / 2);
  }
  assert.equal(PROPS.filter((p) => p.kind === "railing" && p.zone === "kenan").length, 0);
  const body = 0.42;
  const centre = resolveCollision(LIBRARY_RAMP.x, LIBRARY_RAMP.z, body);
  assert.ok(Math.hypot(centre.x - LIBRARY_RAMP.x, centre.z - LIBRARY_RAMP.z) < 0.05);
  for (const rail of rails) {
    const blocked = resolveCollision(rail.x, rail.z, body);
    assert.ok(Math.abs(blocked.x - rail.x) > 0.3, `${rail.x} still on the rail`);
  }
  const approach = resolveCollision(LIBRARY_RAMP.x, LIBRARY_RAMP.z + LIBRARY_RAMP.length / 2 + 1.2, body);
  assert.ok(Math.abs(approach.x - LIBRARY_RAMP.x) < 0.05);
  assert.ok(Math.abs(approach.z - (LIBRARY_RAMP.z + LIBRARY_RAMP.length / 2 + 1.2)) < 0.05);
});
