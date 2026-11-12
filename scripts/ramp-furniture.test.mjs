import assert from "node:assert/strict";
import test from "node:test";

import { LIBRARY_RAMP, libraryRampLift } from "../src/game/world-data/library-ramp.ts";
import { PROPS } from "../src/game/world-data/props.ts";

/** Low-tier bench is 1.7 m along X. The KayKit bench is 1.68 m. Use the longer one. */
const BENCH_HALF_X = 0.85;
const BENCH_HALF_Z = 0.25;
const PLANTER_HALF_X = 0.4;

function samples(x, z, halfX, halfZ) {
  const out = [];
  for (const dx of [-halfX, 0, halfX]) {
    for (const dz of [-halfZ, 0, halfZ]) out.push([x + dx, z + dz]);
  }
  return out;
}

test("library benches and planters stay off the ramp", () => {
  const benches = PROPS.filter((prop) => prop.kind === "bench" && prop.zone === "library");
  const planters = PROPS.filter((prop) => prop.kind === "planter" && prop.zone === "library");
  assert.equal(benches.length, 6);
  assert.equal(planters.length, 8);
  for (const bench of benches) {
    for (const [x, z] of samples(bench.x, bench.z, BENCH_HALF_X, BENCH_HALF_Z)) {
      assert.equal(libraryRampLift(x, z), 0, `bench ${bench.x},${bench.z} covers ${x},${z}`);
    }
  }
  for (const planter of planters) {
    const halfZ = (planter.length ?? 1) / 2;
    for (const [x, z] of samples(planter.x, planter.z, PLANTER_HALF_X, halfZ)) {
      assert.equal(libraryRampLift(x, z), 0, `planter ${planter.x},${planter.z} covers ${x},${z}`);
    }
  }
  const shifted = benches.find((bench) => bench.x === -4.8);
  assert.ok(shifted);
  const moved = planters.find((planter) => Math.abs(planter.x - LIBRARY_RAMP.x) < 1);
  assert.ok(moved);
  assert.ok(moved.z > LIBRARY_RAMP.z + LIBRARY_RAMP.length / 2);
});
