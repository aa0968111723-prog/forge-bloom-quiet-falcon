import assert from "node:assert/strict";
import test from "node:test";

import { resolveCollision } from "../src/game/world-data/colliders.ts";
import "../src/game/world-data/props.ts";
import { KENAN_APRON_SOUTH_Z, KENAN_HALF_WIDTH, KENAN_TOP_Z } from "../src/game/world-data/kenan.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

const BODY_RADIUS = 0.42;

function walk(polyline) {
  let x = polyline[0][0];
  let z = polyline[0][1];
  for (let i = 1; i < polyline.length; i++) {
    const [bx, bz] = polyline[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - x, bz - z) / 0.4));
    let cx = x;
    let cz = z;
    for (let k = 1; k <= n; k++) {
      const tx = x + ((bx - x) * k) / n;
      const tz = z + ((bz - z) * k) / n;
      const next = resolveCollision(tx, tz, BODY_RADIUS);
      const moved = Math.hypot(next.x - cx, next.z - cz);
      const wanted = Math.hypot(tx - cx, tz - cz);
      if (moved < wanted * 0.45 && wanted > 0.08) {
        return { stuck: { leg: i, from: [cx, cz], want: [tx, tz], got: [next.x, next.z] } };
      }
      cx = next.x;
      cz = next.z;
    }
    x = cx;
    z = cz;
  }
  const end = polyline[polyline.length - 1];
  return { arrive: Math.hypot(x - end[0], z - end[1]) };
}

test("the three pilgrimage lines reach their doors", () => {
  assert.equal(ROUTE_SPECS.length, 3);
  for (const route of ROUTE_SPECS) {
    assert.equal(route.accuracy, "estimated");
    const result = walk(route.polyline);
    assert.equal(result.stuck, undefined, `${route.id} ${JSON.stringify(result.stuck)}`);
    assert.ok(result.arrive < 0.6, `${route.id} stopped ${result.arrive} m short`);
  }
});

test("the Kenan centreline stays between the walls", () => {
  let x = 0;
  let z = KENAN_APRON_SOUTH_Z - 1;
  let guard = 0;
  while (z > KENAN_TOP_Z + 0.5 && guard < 400) {
    const next = resolveCollision(x, z - 0.35, BODY_RADIUS);
    assert.ok(Math.abs(next.x) < KENAN_HALF_WIDTH - 0.2, `left the stair at ${next.x}, ${next.z}`);
    assert.ok(next.z < z - 0.05, `stuck at ${next.z}`);
    x = next.x;
    z = next.z;
    guard += 1;
  }
  assert.ok(z <= KENAN_TOP_Z + 0.5);
});
