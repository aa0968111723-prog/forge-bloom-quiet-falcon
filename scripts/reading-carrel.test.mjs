import assert from "node:assert/strict";
import test from "node:test";

import { READING_CARRELS, ROOM_TABLE_SIZE, ROOM_TABLES } from "../src/game/rpg/interior-layout.ts";
import { resolveInterior } from "../src/game/rpg/rules.ts";

test("reading carrels stop a body and leave the classroom aisle open", () => {
  const east = READING_CARRELS[1];
  const blocked = resolveInterior(east.x, east.z, 0.42, true, true);
  assert.ok(Math.hypot(blocked.x - east.x, blocked.z - east.z) > 0.2);
  const classroom = resolveInterior(east.x, east.z, 0.42, true, false);
  assert.ok(Math.hypot(classroom.x - east.x, classroom.z - east.z) < 0.05);
  const aisle = resolveInterior(0, east.z, 0.42, true, true);
  assert.ok(Math.abs(aisle.x) < 0.05 && Math.abs(aisle.z - east.z) < 0.05);
  const door = resolveInterior(0, 6.4, 0.42, true, true);
  assert.ok(Math.abs(door.z - 6.4) < 0.05);
  const south = east.z + east.depth / 2 + 0.42;
  const dodged = resolveInterior(east.x, south - 1.04, 0.42, true, true);
  assert.ok(dodged.z > east.z, `dodge crossed the carrel to ${dodged.z}`);
  const limit = 9 - 0.42;
  assert.ok(Math.abs(dodged.x) <= limit + 1e-6);
  assert.ok(Math.abs(dodged.z) <= 7 - 0.42 + 1e-6);
  for (const carrel of READING_CARRELS) {
    for (const table of ROOM_TABLES) {
      const gapX = Math.abs(table.x - carrel.x) - ROOM_TABLE_SIZE.width / 2 - carrel.width / 2;
      const gapZ = Math.abs(table.z - carrel.z) - ROOM_TABLE_SIZE.depth / 2 - carrel.depth / 2;
      assert.ok(Math.max(gapX, gapZ) > 0.6, `carrel meets a table by ${Math.max(gapX, gapZ)}`);
    }
  }
});
