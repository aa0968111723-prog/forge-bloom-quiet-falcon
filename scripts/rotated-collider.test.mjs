import assert from "node:assert/strict";
import test from "node:test";

import { siteEntrance, CAMPUS_SITES } from "../src/game/rpg/campus.ts";
import { COLLIDERS, resolveCollision } from "../src/game/world-data/colliders.ts";
import { footprintCorner, rotatedFootprint, SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

function covers(box, x, z) {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

test("rotated buildings keep their corners solid and their doors outside", () => {
  for (const id of ["maritime-museum", "business-building"]) {
    const hall = SECONDARY_STRUCTURES.find((s) => s.id === id);
    assert.ok(hall);
    assert.ok(Math.abs(hall.rotationY) > 0.05);
    const span = rotatedFootprint(hall);
    const solid = COLLIDERS.find(
      (b) =>
        b.minX <= hall.position[0] &&
        b.maxX >= hall.position[0] &&
        b.minZ <= hall.position[1] &&
        b.maxZ >= hall.position[1] &&
        Math.abs(b.maxX - b.minX - span.halfW * 2) < 1e-6,
    );
    assert.ok(solid, id);
    const hx = hall.size[0] / 2;
    const hz = hall.size[2] / 2;
    const corner = footprintCorner(hall, -hx, hz);
    assert.ok(covers(solid, corner.x, corner.z), `${id} corner is outside the collider`);
    const old = {
      minX: hall.position[0] - hx,
      maxX: hall.position[0] + hx,
      minZ: hall.position[1] - hz,
      maxZ: hall.position[1] + hz,
    };
    assert.equal(covers(old, corner.x, corner.z), false);
    const pushed = resolveCollision(corner.x, corner.z, 0.42);
    assert.ok(Math.hypot(pushed.x - corner.x, pushed.z - corner.z) > 0.05);
  }
  const museum = CAMPUS_SITES.find((s) => s.id === "museum");
  const door = siteEntrance(museum);
  const held = resolveCollision(door.x, door.z, 0.42);
  assert.ok(Math.hypot(held.x - door.x, held.z - door.z) < 0.05);
  const flat = SECONDARY_STRUCTURES.find((s) => s.id === "white-hall");
  const flatSpan = rotatedFootprint(flat);
  assert.ok(Math.abs(flatSpan.halfW - flat.size[0] / 2) < 1e-6);
  assert.ok(Math.abs(flatSpan.halfD - flat.size[2] / 2) < 1e-6);
});
