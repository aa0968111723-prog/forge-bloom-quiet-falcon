import assert from "node:assert/strict";
import test from "node:test";

import { SECONDARY_STRUCTURES, shipBowCorners, shipProfile } from "../src/game/world-data/zones/secondary.ts";

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
});
