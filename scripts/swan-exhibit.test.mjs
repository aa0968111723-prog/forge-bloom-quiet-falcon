import assert from "node:assert/strict";
import test from "node:test";

import { MUSEUM_SWAN, ROOM_TABLE_SIZE, ROOM_TABLES } from "../src/game/rpg/interior-layout.ts";
import { stepInterior } from "../src/game/rpg/physics/interior.ts";
import { resolveInterior } from "../src/game/rpg/rules.ts";

const radius = 0.42;

function insideSwan(x, z) {
  const half = MUSEUM_SWAN.size / 2 + radius;
  return Math.abs(x - MUSEUM_SWAN.x) < half - 1e-6 && Math.abs(z - MUSEUM_SWAN.z) < half - 1e-6;
}

test("the museum swan keeps a body on the floor and inside the room", () => {
  const half = MUSEUM_SWAN.size / 2;
  assert.ok(half + radius > 1.04);
  const north = MUSEUM_SWAN.z - half - radius;
  assert.ok(north >= -7 + radius);

  const onExhibit = (x, z) => resolveInterior(x, z, radius, true, false, false, false, false, true);
  const centre = onExhibit(MUSEUM_SWAN.x, MUSEUM_SWAN.z);
  assert.equal(insideSwan(centre.x, centre.z), false);
  assert.ok(centre.z >= -7 + radius && centre.z <= 7 - radius);
  assert.ok(centre.x >= -9 + radius && centre.x <= 9 - radius);

  const door = onExhibit(0, 6.4);
  assert.equal(door.x, 0);
  assert.equal(door.z, 6.4);

  const walked = stepInterior(MUSEUM_SWAN.x, MUSEUM_SWAN.z, 0, 0.2, radius, true, false, false, false, false, true);
  assert.equal(insideSwan(walked.x, walked.z), false);

  const library = resolveInterior(MUSEUM_SWAN.x, MUSEUM_SWAN.z, radius, true, false);
  assert.equal(library.x, MUSEUM_SWAN.x);
  assert.equal(library.z, MUSEUM_SWAN.z);

  for (const table of ROOM_TABLES) {
    const gap = Math.hypot(table.x - MUSEUM_SWAN.x, table.z - MUSEUM_SWAN.z);
    assert.ok(gap > half + Math.max(ROOM_TABLE_SIZE.width, ROOM_TABLE_SIZE.depth) / 2);
  }
});
