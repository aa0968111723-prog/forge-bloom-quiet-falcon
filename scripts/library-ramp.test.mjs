import assert from "node:assert/strict";
import test from "node:test";

import { LIBRARY } from "../src/game/world-data/landmarks.ts";
import { LIBRARY_RAMP, libraryRampLift, libraryRampTriangles } from "../src/game/world-data/library-ramp.ts";
import { PROPS } from "../src/game/world-data/props.ts";
import { terrainHeight } from "../src/game/world.ts";
import { sampleGroundElevation } from "../src/game/world-data/elevation.ts";

function normal([p, q, r]) {
  const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}

test("the library ramp rises to the plinth and stays outside the wall", () => {
  const southFace = LIBRARY.center[1] + LIBRARY.length / 2;
  const north = LIBRARY_RAMP.z - LIBRARY_RAMP.length / 2;
  const south = LIBRARY_RAMP.z + LIBRARY_RAMP.length / 2;
  assert.ok(north > southFace);
  assert.ok(north - southFace < 0.5);
  const low = libraryRampLift(LIBRARY_RAMP.x, south);
  const high = libraryRampLift(LIBRARY_RAMP.x, north);
  const mid = libraryRampLift(LIBRARY_RAMP.x, LIBRARY_RAMP.z);
  assert.ok(low < 0.05);
  assert.ok(Math.abs(high - LIBRARY_RAMP.rise) < 1e-9);
  assert.ok(mid > low && mid < high);
  const beside = libraryRampLift(LIBRARY_RAMP.x + LIBRARY_RAMP.width / 2 + LIBRARY_RAMP.skirt + 0.2, LIBRARY_RAMP.z);
  assert.equal(beside, 0);
  const skirt = libraryRampLift(LIBRARY_RAMP.x + LIBRARY_RAMP.width / 2 + LIBRARY_RAMP.skirt / 2, north);
  assert.ok(skirt > 0 && skirt < high);
  const [top] = libraryRampTriangles();
  assert.ok(normal(top)[1] > 0);
  const ground = sampleGroundElevation(LIBRARY_RAMP.x, north);
  assert.ok(Math.abs(terrainHeight(LIBRARY_RAMP.x, north) - (ground + high)) < 1e-9);
  const ramp = PROPS.find((p) => p.kind === "ramp");
  assert.equal(ramp.x, LIBRARY_RAMP.x);
  assert.equal(ramp.z, LIBRARY_RAMP.z);
  const bin = PROPS.find((p) => p.kind === "bin" && p.x < 0 && p.zone === "library");
  assert.equal(libraryRampLift(bin.x, bin.z), 0);
});
