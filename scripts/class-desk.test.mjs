import assert from "node:assert/strict";
import test from "node:test";

import { CLASSROOM_DESK, ROOM_TABLE_SIZE, ROOM_TABLES } from "../src/game/rpg/interior-layout.ts";
import { resolveInterior } from "../src/game/rpg/rules.ts";

test("the palace desk stops a body and leaves the reading room and the door open", () => {
  const desk = CLASSROOM_DESK;
  const blocked = resolveInterior(desk.x, desk.z, 0.42, true, false, true);
  assert.ok(Math.hypot(blocked.x - desk.x, blocked.z - desk.z) > 0.2);
  const reading = resolveInterior(desk.x, desk.z, 0.42, true, false);
  assert.ok(Math.hypot(reading.x - desk.x, reading.z - desk.z) < 0.05);
  const door = resolveInterior(0, 6.4, 0.42, true, false, true);
  assert.ok(Math.abs(door.x) < 0.05 && Math.abs(door.z - 6.4) < 0.05);
  const south = desk.z + desk.depth / 2 + 0.42;
  const dodged = resolveInterior(desk.x, south - 1.04, 0.42, true, false, true);
  assert.ok(dodged.z > desk.z, `dodge crossed the desk to ${dodged.z}`);
  let nearest = Infinity;
  for (const table of ROOM_TABLES) {
    const gapX = Math.abs(table.x - desk.x) - ROOM_TABLE_SIZE.width / 2 - desk.width / 2;
    const gapZ = Math.abs(table.z - desk.z) - ROOM_TABLE_SIZE.depth / 2 - desk.depth / 2;
    nearest = Math.min(nearest, Math.max(gapX, gapZ));
  }
  assert.ok(nearest > 0.6, `desk meets a student table by ${nearest}`);
});
