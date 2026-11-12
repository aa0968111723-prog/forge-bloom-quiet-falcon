import assert from "node:assert/strict";
import test from "node:test";

import { HOOP_STANDS } from "../src/game/rpg/interior-layout.ts";
import { resolveInterior } from "../src/game/rpg/rules.ts";

test("activity-room hoop bases stop a body and leave the classroom open", () => {
  assert.equal(HOOP_STANDS.length, 2);
  const east = HOOP_STANDS[1];
  const blocked = resolveInterior(east.x, east.z, 0.42, false, true);
  assert.ok(Math.hypot(blocked.x - east.x, blocked.z - east.z) > 0.2);
  const classroom = resolveInterior(east.x, east.z, 0.42, true, false);
  assert.ok(Math.abs(classroom.x - east.x) < 0.05);
  const door = resolveInterior(0, 6.4, 0.42, false, true);
  assert.ok(Math.abs(door.x) < 0.05);
  assert.ok(Math.abs(door.z - 6.4) < 0.05);
  const face = east.x - east.size / 2 - 0.42;
  const dodged = resolveInterior(face + 1.04, east.z, 0.42, false, true);
  assert.ok(dodged.x < east.x, `dodge crossed the stand to ${dodged.x}`);
});
