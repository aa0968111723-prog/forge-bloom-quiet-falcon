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
  const limit = 9 - 0.42;
  for (const side of [1, -1]) {
    const slipped = resolveInterior(side * limit, 0.26, 0.42, false, true);
    assert.ok(Math.abs(slipped.x) <= limit + 1e-6, `pushed through the wall to ${slipped.x}`);
    assert.ok(Math.abs(slipped.z) <= 7 - 0.42 + 1e-6);
    const half = east.size / 2 + 0.42;
    const standX = side * east.x;
    assert.ok(
      Math.abs(slipped.x - standX) >= half - 1e-6 || Math.abs(slipped.z - east.z) >= half - 1e-6,
      `still inside the stand at ${slipped.x},${slipped.z}`,
    );
  }
});
