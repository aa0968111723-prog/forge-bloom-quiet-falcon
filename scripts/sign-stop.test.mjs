import assert from "node:assert/strict";
import test from "node:test";

import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { signFootprint, signPosts } from "../src/game/world-data/landmarks.ts";
import { PROPS } from "../src/game/world-data/props.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("direction signs stop a body and the pilgrimage lines stay open", () => {
  const posts = signPosts();
  const placed = PROPS.filter((prop) => prop.kind === "sign-post");
  const key = (row) => `${row.x.toFixed(3)},${row.z.toFixed(3)},${row.zone}`;
  assert.equal(posts.length, 9);
  assert.deepEqual(placed.map(key).sort(), posts.map(key).sort());
  const avenue = posts.find((post) => post.zone === "avenue" && post.z === -20);
  assert.ok(avenue);
  const blocked = resolveCollision(avenue.x, avenue.z, 0.42);
  assert.ok(Math.abs(blocked.z - avenue.z) > 0.2);
  const beside = resolveCollision(avenue.x, avenue.z + 1.6, 0.42);
  assert.ok(Math.abs(beside.z - (avenue.z + 1.6)) < 0.05);
  for (const [x, z] of MAIN_ROUTE) {
    const held = resolveCollision(x, z, 0.42);
    assert.ok(Math.hypot(held.x - x, held.z - z) < 0.05, `route point ${x},${z} moved`);
  }
  for (const route of ROUTE_SPECS) {
    for (const [x, z] of route.polyline) {
      const held = resolveCollision(x, z, 0.42);
      assert.ok(Math.hypot(held.x - x, held.z - z) < 0.05, `${route.id} ${x},${z} moved`);
    }
  }
  for (const lamp of PROPS.filter((prop) => prop.kind === "street-lamp")) {
    for (const post of posts) {
      const footprint = signFootprint(post);
      const dx = Math.max(0, Math.abs(lamp.x - footprint.x) - footprint.width / 2);
      const dz = Math.max(0, Math.abs(lamp.z - footprint.z) - footprint.depth / 2);
      assert.ok(Math.hypot(dx, dz) > 1.2, `street lamp ${lamp.x},${lamp.z} sits on a sign`);
    }
  }
});
