import assert from "node:assert/strict";
import test from "node:test";

import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { PALACE, palaceColumns } from "../src/game/world-data/landmarks.ts";

test("palace colonnade columns stop a body and the gaps stay open", () => {
  const cols = palaceColumns();
  assert.equal(cols.length, PALACE.halls * 2 * 8);
  const post = cols[3];
  const blocked = resolveCollision(post.x, post.z, 0.42);
  assert.ok(Math.hypot(blocked.x - post.x, blocked.z - post.z) > 0.2);
  const gap = {
    x: (cols[3].x + cols[4].x) / 2,
    z: (cols[3].z + cols[4].z) / 2,
  };
  const open = resolveCollision(gap.x, gap.z, 0.42);
  assert.ok(Math.hypot(open.x - gap.x, open.z - gap.z) < 0.05);
  const avenue = resolveCollision(0, cols[3].z, 0.42);
  assert.ok(Math.hypot(avenue.x, avenue.z - cols[3].z) < 0.05);
});
