import assert from "node:assert/strict";
import test from "node:test";

import { SECONDARY_STRUCTURES, shipBowCorners, shipBowTriangles, shipProfile } from "../src/game/world-data/zones/secondary.ts";

function normal([p, q, r]) {
  const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
  const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}

test("the maritime museum bow covers the forward face", () => {
  const ship = SECONDARY_STRUCTURES.find((s) => s.id === "maritime-museum");
  assert.equal(ship.kind, "ship");
  const profile = shipProfile(ship.size);
  const { base, tip } = shipBowCorners(ship.size);
  assert.equal(base.length, 4);
  for (const [x, y, z] of base) {
    assert.ok(x < profile.faceX && x > profile.faceX - 0.2);
    assert.ok(y >= 0 && y <= profile.hullH);
    assert.ok(Math.abs(z) <= ship.size[2] / 2);
  }
  const ys = base.map((corner) => corner[1]);
  const zs = base.map((corner) => corner[2]);
  assert.equal(Math.min(...ys), 0);
  assert.equal(Math.max(...ys), profile.hullH);
  assert.equal(Math.min(...zs), -ship.size[2] / 2);
  assert.equal(Math.max(...zs), ship.size[2] / 2);
  assert.ok(tip[0] > profile.faceX);
  assert.equal(tip[1], profile.hullY);
  assert.equal(tip[2], 0);
  assert.ok(ship.size[0] * 0.56 > profile.faceX + 1);
  const [bottom, top, south, north] = shipBowTriangles(ship.size).map(normal);
  assert.ok(bottom[1] < 0, "bottom face points down");
  assert.ok(top[1] > 0, "top face points up");
  assert.ok(south[2] > 0, "south face points outward");
  assert.ok(north[2] < 0, "north face points outward");
});
